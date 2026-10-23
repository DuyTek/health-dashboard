import type { AssistantMeta, ChatErrorCode, ChatStreamEvent } from '@/types/chat'

// Client-side reader for the /api/chat Server-Sent Events stream.
//
// The generator always ends with exactly one terminal event (`done` or
// `error`), even when the server misbehaves: HTTP errors, a wrong content type,
// a broken connection or a stream that stops without a terminal frame are all
// turned into an `error` event. Only an abort (via `signal`) throws, with the
// signal's reason, so callers can tell "user pressed Stop" apart from failures.

const ERROR_CODES: readonly ChatErrorCode[] = [
	'invalid_request',
	'rate_limited',
	'timeout',
	'blocked',
	'empty_response',
	'config_error',
	'upstream_error',
]

export const STREAM_ENDED_MESSAGE = 'Connection ended unexpectedly.'

type ErrorEvent = Extract<ChatStreamEvent, { type: 'error' }>

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

export function isChatErrorCode(value: unknown): value is ChatErrorCode {
	return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value)
}

function isAssistantMeta(value: unknown): value is AssistantMeta {
	return isRecord(value) && isStringArray(value.citedMetrics) && isStringArray(value.followUps)
}

/** Validates an unknown (parsed JSON) value against the ChatStreamEvent union. */
export function parseChatStreamEvent(value: unknown): ChatStreamEvent | null {
	if (!isRecord(value)) return null
	switch (value.type) {
		case 'delta':
			return typeof value.text === 'string' ? { type: 'delta', text: value.text } : null
		case 'meta':
			return isAssistantMeta(value.meta)
				? {
						type: 'meta',
						meta: { citedMetrics: value.meta.citedMetrics, followUps: value.meta.followUps },
					}
				: null
		case 'error':
			return isChatErrorCode(value.code) && typeof value.message === 'string'
				? { type: 'error', code: value.code, message: value.message }
				: null
		case 'done':
			return { type: 'done' }
		default:
			return null
	}
}

/**
 * Extracts the joined `data:` payload of one SSE frame (the text between two
 * blank lines). Returns null for frames without data (comments, `event:`-only).
 */
export function parseFrameData(frame: string): string | null {
	const data: string[] = []
	for (const line of frame.split('\n')) {
		if (line === '' || line.startsWith(':')) continue
		const colon = line.indexOf(':')
		const field = colon === -1 ? line : line.slice(0, colon)
		if (field !== 'data') continue
		let value = colon === -1 ? '' : line.slice(colon + 1)
		if (value.startsWith(' ')) value = value.slice(1)
		data.push(value)
	}
	return data.length > 0 ? data.join('\n') : null
}

function statusToCode(status: number): ChatErrorCode {
	if (status === 429) return 'rate_limited'
	if (status === 408 || status === 504) return 'timeout'
	if (status >= 400 && status < 500) return 'invalid_request'
	return 'upstream_error'
}

/** Builds an error event from a non-2xx (or non-SSE) response, using its JSON body when it has one. */
async function errorFromResponse(response: Response): Promise<ErrorEvent> {
	let code = response.ok ? 'upstream_error' : statusToCode(response.status)
	let message = response.ok
		? 'Unexpected response from the assistant.'
		: `Request failed (${response.status}).`
	try {
		const body: unknown = await response.json()
		const source = isRecord(body) && isRecord(body.error) ? body.error : body
		if (isRecord(source)) {
			if (isChatErrorCode(source.code)) code = source.code
			if (typeof source.message === 'string' && source.message.trim()) message = source.message
		}
	} catch {
		// Body is not JSON: keep the status-based defaults.
	}
	return { type: 'error', code, message }
}

function throwIfAborted(signal?: AbortSignal) {
	if (signal?.aborted) {
		throw signal.reason instanceof Error
			? signal.reason
			: new DOMException('The operation was aborted.', 'AbortError')
	}
}

/**
 * Reads a `text/event-stream` response from /api/chat and yields validated
 * ChatStreamEvents. Malformed or unknown frames are skipped. Stops after the
 * first terminal (`done` / `error`) event.
 */
export async function* readChatStream(
	response: Response,
	signal?: AbortSignal,
): AsyncGenerator<ChatStreamEvent, void, undefined> {
	const contentType = response.headers.get('content-type') ?? ''
	if (!response.ok || !contentType.includes('text/event-stream') || !response.body) {
		yield await errorFromResponse(response)
		return
	}

	const reader = response.body.getReader()
	const decoder = new TextDecoder()
	let buffer = ''
	const onAbort = () => {
		reader.cancel().catch(() => {})
	}
	signal?.addEventListener('abort', onAbort, { once: true })

	try {
		throwIfAborted(signal)
		while (true) {
			let chunk: ReadableStreamReadResult<Uint8Array>
			try {
				chunk = await reader.read()
			} catch {
				throwIfAborted(signal)
				yield { type: 'error', code: 'upstream_error', message: STREAM_ENDED_MESSAGE }
				return
			}
			throwIfAborted(signal)

			if (chunk.done) {
				buffer += decoder.decode()
			} else {
				buffer += decoder.decode(chunk.value, { stream: true })
			}
			// Normalise CRLF / CR line endings so frames always split on "\n\n". A
			// trailing "\r" is kept until the next chunk, which may start with "\n".
			buffer = chunk.done ? buffer.replace(/\r\n?/g, '\n') : buffer.replace(/\r\n|\r(?!$)/g, '\n')

			// On EOF, flush a final frame that lacks its trailing blank line.
			if (chunk.done && buffer.trim() !== '') buffer += '\n\n'

			let boundary = buffer.indexOf('\n\n')
			while (boundary !== -1) {
				const frame = buffer.slice(0, boundary)
				buffer = buffer.slice(boundary + 2)
				boundary = buffer.indexOf('\n\n')

				const data = parseFrameData(frame)
				if (data === null) continue
				let parsed: unknown
				try {
					parsed = JSON.parse(data)
				} catch {
					continue
				}
				const event = parseChatStreamEvent(parsed)
				if (!event) continue
				yield event
				if (event.type === 'done' || event.type === 'error') return
			}

			if (chunk.done) {
				yield { type: 'error', code: 'upstream_error', message: STREAM_ENDED_MESSAGE }
				return
			}
		}
	} finally {
		signal?.removeEventListener('abort', onAbort)
		// Releases the connection if the consumer stopped early or a terminal event arrived.
		reader.cancel().catch(() => {})
	}
}
