import { z } from 'zod'
import { getHealthData } from '../src/data/index.js'
import { buildHealthSummary } from '../src/lib/health/summary.js'
import {
	CHAT_LIMITS,
	type ChatErrorCode,
	type ChatStreamEvent,
	type ChatTurn,
} from '../src/types/chat.js'
import type { HealthData, HealthSummary } from '../src/types/health.js'
import { getServerConfig, type ThinkingLevelSetting } from './config.js'
import {
	BENIGN_FINISH_CODES,
	classifyUpstreamError,
	defaultLogger,
	describeThrown,
	ERROR_MESSAGES,
	redactSecrets,
	type ServerLogger,
} from './errors.js'
import { MetaStreamSplitter } from './meta.js'
import type { AgentRunner } from './runner.js'

// Framework-agnostic core of /api/chat: validates the request, runs the agent
// and turns raw ADK events into the ChatStreamEvent wire contract. Always
// ends with exactly one `done` or `error` (unless the client went away).

/** Prior assistant turns are capped so a long answer can't bloat the prompt. */
export const MAX_ASSISTANT_TURN_CHARS = 4000
const MAX_MESSAGES_IN_BODY = 200

const requestSchema = z.object({
	messages: z
		.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() }))
		.min(1)
		.max(MAX_MESSAGES_IN_BODY),
})

export type ValidatedChat =
	{ ok: true; history: ChatTurn[]; message: string } | { ok: false; message: string }

/** Validates and normalises a request body (trim, drop empties, cap history). */
export function validateChatRequest(body: unknown): ValidatedChat {
	const parsed = requestSchema.safeParse(body)
	if (!parsed.success) {
		return { ok: false, message: 'Invalid request: expected { messages: [{ role, content }] }.' }
	}
	const turns: ChatTurn[] = []
	for (const turn of parsed.data.messages) {
		const content = turn.content.trim()
		if (turn.role === 'user' && content.length > CHAT_LIMITS.maxInputChars) {
			return {
				ok: false,
				message: `Messages can be at most ${CHAT_LIMITS.maxInputChars} characters.`,
			}
		}
		if (!content) continue
		turns.push({
			role: turn.role,
			content:
				turn.role === 'assistant' && content.length > MAX_ASSISTANT_TURN_CHARS
					? `${content.slice(0, MAX_ASSISTANT_TURN_CHARS)}…`
					: content,
		})
	}
	const last = parsed.data.messages[parsed.data.messages.length - 1]
	if (last.role !== 'user') {
		return { ok: false, message: 'The last message must come from the user.' }
	}
	if (!last.content.trim()) {
		return { ok: false, message: 'Please type a question first.' }
	}

	const recent = turns.slice(-CHAT_LIMITS.maxHistoryTurns)
	// The model's context should start with a user turn.
	while (recent.length > 1 && recent[0].role !== 'user') recent.shift()
	const message = recent.pop()?.content ?? ''
	return { ok: true, history: recent, message }
}

interface AdkEventView {
	partial: boolean
	text: string
	errorCode: string | undefined
	errorMessage: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null
}

/** Narrows an ADK event (typed loosely here so tests can feed plain objects). */
export function readAdkEvent(event: unknown): AdkEventView {
	const view: AdkEventView = { partial: false, text: '', errorCode: undefined, errorMessage: '' }
	if (!isRecord(event)) return view
	view.partial = event.partial === true
	if (typeof event.errorCode === 'string' && event.errorCode) view.errorCode = event.errorCode
	if (typeof event.errorMessage === 'string') view.errorMessage = event.errorMessage
	const content = event.content
	if (isRecord(content) && Array.isArray(content.parts)) {
		for (const part of content.parts) {
			// Skip thoughts and function calls/responses; only answer text is shown.
			if (isRecord(part) && typeof part.text === 'string' && part.thought !== true) {
				view.text += part.text
			}
		}
	}
	return view
}

export interface StreamChatDeps {
	/** Defaults to `getServerConfig()`. */
	config?: { apiKey: string; model: string; thinkingLevel?: ThinkingLevelSetting | null }
	/** Defaults to the shared dataset + summary builder. */
	loadHealth?: () => { data: HealthData; summary: HealthSummary }
	/** Defaults to the ADK runner (loaded lazily). */
	runAgent?: AgentRunner
	/** Aborted when the client disconnects. */
	signal?: AbortSignal
	timeoutMs?: number
	log?: ServerLogger
}

function errorEvent(code: ChatErrorCode, message = ERROR_MESSAGES[code]): ChatStreamEvent {
	return { type: 'error', code, message }
}

function defaultLoadHealth(): { data: HealthData; summary: HealthSummary } {
	const data = getHealthData()
	return { data, summary: buildHealthSummary(data) }
}

const defaultRunAgent: AgentRunner = async function* (input) {
	// Lazy so the (large) ADK import only happens when a real run is needed.
	const { runHealthAgent } = await import('./runner.js')
	yield* runHealthAgent(input)
}

class RunAborted extends Error {}

export async function* streamChat(
	request: unknown,
	deps: StreamChatDeps = {},
): AsyncGenerator<ChatStreamEvent, void, undefined> {
	const log = deps.log ?? defaultLogger
	const validated = validateChatRequest(request)
	if (!validated.ok) {
		yield errorEvent('invalid_request', validated.message)
		return
	}

	const config = deps.config ?? getServerConfig()
	if (!config.apiKey) {
		log('GEMINI_API_KEY is not set; cannot answer chat requests.')
		yield errorEvent('config_error')
		return
	}
	const logError = (context: string, error: unknown): void => {
		const { code, message } = describeThrown(error)
		log(`${context}: ${redactSecrets(`${code ?? ''} ${message}`.trim(), config.apiKey)}`)
	}

	let health: { data: HealthData; summary: HealthSummary }
	try {
		health = (deps.loadHealth ?? defaultLoadHealth)()
	} catch (error) {
		logError('Failed to load health data', error)
		yield errorEvent('upstream_error')
		return
	}

	const controller = new AbortController()
	let timedOut = false
	const timer = setTimeout(() => {
		timedOut = true
		controller.abort()
	}, deps.timeoutMs ?? CHAT_LIMITS.requestTimeoutMs)
	const onClientAbort = (): void => controller.abort()
	if (deps.signal?.aborted) controller.abort()
	deps.signal?.addEventListener('abort', onClientAbort, { once: true })
	const aborted = new Promise<never>((_, reject) => {
		const fail = (): void => reject(new RunAborted('aborted'))
		if (controller.signal.aborted) fail()
		else controller.signal.addEventListener('abort', fail, { once: true })
	})
	aborted.catch(() => {})

	const splitter = new MetaStreamSplitter()
	/** Everything sent as `delta` so far (the answer without the meta block). */
	let shownText = ''
	let sawPartialSinceFinal = false
	let iterator: AsyncIterator<unknown> | undefined

	try {
		iterator = (deps.runAgent ?? defaultRunAgent)({
			apiKey: config.apiKey,
			model: config.model,
			thinkingLevel: config.thinkingLevel,
			data: health.data,
			summary: health.summary,
			history: validated.history,
			message: validated.message,
			signal: controller.signal,
		})[Symbol.asyncIterator]()

		for (;;) {
			const next = await Promise.race([iterator.next(), aborted])
			if (next.done) break
			const event = readAdkEvent(next.value)

			if (event.errorCode && !BENIGN_FINISH_CODES.has(event.errorCode.toUpperCase())) {
				const code = classifyUpstreamError(event.errorCode, event.errorMessage)
				log(
					`Model returned ${redactSecrets(`${event.errorCode}: ${event.errorMessage}`, config.apiKey)}`,
				)
				yield errorEvent(code)
				return
			}

			// SSE mode: partial events carry incremental text, then a non-partial
			// event repeats the aggregated text. Forward partials only, and fall
			// back to the aggregated text if no partials preceded it.
			let text = ''
			if (event.partial) {
				text = event.text
				if (text) sawPartialSinceFinal = true
			} else {
				if (!sawPartialSinceFinal) text = event.text
				sawPartialSinceFinal = false
			}
			if (!text) continue
			const safe = splitter.push(text)
			if (safe) {
				shownText += safe
				yield { type: 'delta', text: safe }
			}
		}
	} catch (error) {
		if (error instanceof RunAborted || controller.signal.aborted) {
			if (timedOut) {
				log(`Model run timed out after ${deps.timeoutMs ?? CHAT_LIMITS.requestTimeoutMs} ms.`)
				yield errorEvent('timeout')
			}
			// Client disconnected: nobody is listening, end quietly.
			return
		}
		logError('Model run failed', error)
		const { code, message } = describeThrown(error)
		yield errorEvent(classifyUpstreamError(code, message))
		return
	} finally {
		clearTimeout(timer)
		deps.signal?.removeEventListener('abort', onClientAbort)
		controller.abort()
		// Don't await: a hung upstream must not block the response from ending.
		void iterator?.return?.().catch(() => {})
	}

	const end = splitter.finish()
	if (end.text) {
		shownText += end.text
		yield { type: 'delta', text: end.text }
	}
	if (!shownText.trim()) {
		log('Model returned no answer text.')
		yield errorEvent('empty_response')
		return
	}
	if (end.meta) yield { type: 'meta', meta: end.meta }
	else log('Answer had no valid <meta> block; sending without follow-ups.')
	yield { type: 'done' }
}
