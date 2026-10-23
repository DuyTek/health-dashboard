// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import {
	CHAT_LIMITS,
	type ChatErrorCode,
	type ChatStreamEvent,
	type ChatTurn,
} from '../src/types/chat.js'
import { ERROR_MESSAGES } from './errors.js'
import { fixtureData, fixtureSummary } from './__fixtures__/health.js'
import { readAdkEvent, streamChat, validateChatRequest, type StreamChatDeps } from './chat.js'
import type { AgentRunInput, AgentRunner } from './runner.js'

const META = '<meta>{"citedMetrics":["steps"],"followUps":["What about sleep?"]}</meta>'

function partial(text: string): unknown {
	return { partial: true, content: { role: 'model', parts: [{ text }] } }
}
function final(text: string, extra: Record<string, unknown> = {}): unknown {
	return { partial: false, content: { role: 'model', parts: [{ text }] }, ...extra }
}

function fakeRunner(events: unknown[], onInput?: (input: AgentRunInput) => void): AgentRunner {
	return async function* (input) {
		onInput?.(input)
		for (const event of events) yield event
	}
}

function deps(overrides: Partial<StreamChatDeps> = {}): StreamChatDeps {
	return {
		config: { apiKey: 'test-key-123456', model: 'fake-model' },
		loadHealth: () => ({ data: fixtureData, summary: fixtureSummary }),
		log: () => {},
		...overrides,
	}
}

async function collect(gen: AsyncGenerator<ChatStreamEvent>): Promise<ChatStreamEvent[]> {
	const out: ChatStreamEvent[] = []
	for await (const event of gen) out.push(event)
	return out
}

const ask = (content = 'How am I progressing?') => ({ messages: [{ role: 'user', content }] })

function deltaText(events: ChatStreamEvent[]): string {
	return events.map((e) => (e.type === 'delta' ? e.text : '')).join('')
}

describe('streamChat', () => {
	it('streams deltas, then meta, then done', async () => {
		const events = await collect(
			streamChat(
				ask(),
				deps({
					runAgent: fakeRunner([
						partial('You walked '),
						partial('8,800 steps.\n'),
						partial(META),
						final(`You walked 8,800 steps.\n${META}`),
					]),
				}),
			),
		)
		expect(events.map((e) => e.type)).toEqual(['delta', 'delta', 'meta', 'done'])
		expect(deltaText(events)).toBe('You walked 8,800 steps.\n')
		expect(events[2]).toEqual({
			type: 'meta',
			meta: { citedMetrics: ['steps'], followUps: ['What about sleep?'] },
		})
	})

	it('does not repeat the aggregated final text after partials', async () => {
		const events = await collect(
			streamChat(
				ask(),
				deps({ runAgent: fakeRunner([partial('Hello'), partial(' there'), final('Hello there')]) }),
			),
		)
		expect(deltaText(events)).toBe('Hello there')
		expect(events.at(-1)).toEqual({ type: 'done' })
	})

	it('uses the final text when no partials were streamed', async () => {
		const events = await collect(
			streamChat(ask(), deps({ runAgent: fakeRunner([final(`Answer.${META}`)]) })),
		)
		expect(deltaText(events)).toBe('Answer.')
		expect(events.map((e) => e.type)).toEqual(['delta', 'meta', 'done'])
	})

	it('ignores function call/response events and thought parts', async () => {
		const events = await collect(
			streamChat(
				ask(),
				deps({
					runAgent: fakeRunner([
						{ content: { role: 'model', parts: [{ functionCall: { name: 'get_goals', args: {} } }] } },
						{
							content: {
								role: 'user',
								parts: [{ functionResponse: { name: 'get_goals', response: {} } }],
							},
						},
						partial('Thinking...'),
						{ partial: true, content: { parts: [{ text: 'secret thought', thought: true }] } },
						final('Thinking...'),
						partial(' Done.'),
						final(' Done.'),
					]),
				}),
			),
		)
		expect(deltaText(events)).toBe('Thinking... Done.')
	})

	it('sends done without meta when the block is missing or invalid', async () => {
		const events = await collect(
			streamChat(ask(), deps({ runAgent: fakeRunner([partial('Answer <meta>{bad</meta>')]) })),
		)
		expect(deltaText(events)).toBe('Answer ')
		expect(events.map((e) => e.type)).toEqual(['delta', 'done'])
	})

	it('passes the trimmed message and prior turns to the runner', async () => {
		let seen: AgentRunInput | undefined
		const messages: ChatTurn[] = [
			{ role: 'user', content: 'Hi' },
			{ role: 'assistant', content: 'Hello!' },
			{ role: 'user', content: '  How is my sleep?  ' },
		]
		await collect(
			streamChat(
				{ messages },
				deps({ runAgent: fakeRunner([final('ok')], (input) => (seen = input)) }),
			),
		)
		expect(seen?.message).toBe('How is my sleep?')
		expect(seen?.history).toEqual(messages.slice(0, 2))
		expect(seen?.data).toBe(fixtureData)
		expect(seen?.summary).toBe(fixtureSummary)
		expect(seen?.model).toBe('fake-model')
	})

	it.each([
		[undefined],
		[{}],
		[{ messages: [] }],
		[{ messages: [{ role: 'system', content: 'x' }] }],
		[{ messages: [{ role: 'assistant', content: 'x' }] }],
		[{ messages: [{ role: 'user', content: '   ' }] }],
		[{ messages: [{ role: 'user', content: 'x'.repeat(CHAT_LIMITS.maxInputChars + 1) }] }],
	])('rejects invalid request %#', async (body) => {
		const runAgent = vi.fn<AgentRunner>(fakeRunner([final('never')]))
		const events = await collect(streamChat(body, deps({ runAgent })))
		expect(events).toHaveLength(1)
		expect(events[0]).toMatchObject({ type: 'error', code: 'invalid_request' })
		expect(runAgent).not.toHaveBeenCalled()
	})

	it('reports config_error when the API key is missing', async () => {
		const events = await collect(
			streamChat(ask(), deps({ config: { apiKey: '', model: 'm' }, runAgent: fakeRunner([]) })),
		)
		expect(events).toEqual([expect.objectContaining({ type: 'error', code: 'config_error' })])
	})

	it('reports upstream_error when health data cannot be loaded', async () => {
		const events = await collect(
			streamChat(
				ask(),
				deps({
					loadHealth: () => {
						throw new Error('not implemented')
					},
				}),
			),
		)
		expect(events).toEqual([expect.objectContaining({ type: 'error', code: 'upstream_error' })])
	})

	it.each([
		[
			{ errorCode: 'UNKNOWN_ERROR', errorMessage: 'got status: 429 Too Many Requests' },
			'rate_limited',
		],
		[{ errorCode: '429', errorMessage: 'RESOURCE_EXHAUSTED' }, 'rate_limited'],
		[{ errorCode: 'SAFETY', errorMessage: '' }, 'blocked'],
		[{ errorCode: 'PROHIBITED_CONTENT', errorMessage: '' }, 'blocked'],
		[{ errorCode: 'UNKNOWN_ERROR', errorMessage: 'API key not valid' }, 'config_error'],
		[{ errorCode: '500', errorMessage: 'Internal' }, 'upstream_error'],
	])('maps model error event %j to %s', async (errorEvent, code) => {
		const events = await collect(streamChat(ask(), deps({ runAgent: fakeRunner([errorEvent]) })))
		expect(events).toEqual([expect.objectContaining({ type: 'error', code })])
		// Upstream details never reach the client: only the canned message.
		expect((events[0] as { message: string }).message).toBe(ERROR_MESSAGES[code as ChatErrorCode])
	})

	it('maps a thrown 429 ApiError to rate_limited', async () => {
		const runAgent: AgentRunner = async function* () {
			yield partial('Start')
			throw Object.assign(new Error('{"error":{"code":429}}'), { status: 429 })
		}
		const events = await collect(streamChat(ask(), deps({ runAgent })))
		expect(events.map((e) => e.type)).toEqual(['delta', 'error'])
		expect(events[1]).toMatchObject({ code: 'rate_limited' })
	})

	it('logs upstream errors without the API key', async () => {
		const log = vi.fn<(message: string) => void>()
		const runAgent: AgentRunner = async function* () {
			yield* []
			throw new Error(
				'request to https://x/?key=test-key-123456 failed (AIzaSyA1234567890abcdefghijklmnop)',
			)
		}
		await collect(streamChat(ask(), deps({ runAgent, log })))
		const logged = log.mock.calls.map((c) => String(c[0])).join('\n')
		expect(logged).toContain('failed')
		expect(logged).not.toContain('test-key-123456')
		expect(logged).not.toContain('AIzaSy')
	})

	it('keeps text when the model stops at MAX_TOKENS', async () => {
		const events = await collect(
			streamChat(
				ask(),
				deps({
					runAgent: fakeRunner([
						partial('Partial answer'),
						final('Partial answer', { errorCode: 'MAX_TOKENS', finishReason: 'MAX_TOKENS' }),
					]),
				}),
			),
		)
		expect(events.map((e) => e.type)).toEqual(['delta', 'done'])
	})

	it('reports empty_response when the model returns no text', async () => {
		const events = await collect(
			streamChat(ask(), deps({ runAgent: fakeRunner([final(''), partial(META)]) })),
		)
		expect(events).toEqual([expect.objectContaining({ type: 'error', code: 'empty_response' })])
	})

	it('times out a hung model run and cancels it', async () => {
		let upstreamSignal: AbortSignal | undefined
		const runAgent: AgentRunner = async function* (input) {
			upstreamSignal = input.signal
			yield partial('Working')
			await new Promise(() => {})
		}
		const events = await collect(streamChat(ask(), deps({ runAgent, timeoutMs: 20 })))
		expect(events.map((e) => e.type)).toEqual(['delta', 'error'])
		expect(events[1]).toMatchObject({ code: 'timeout' })
		expect(upstreamSignal?.aborted).toBe(true)
	})

	it('ends quietly when the client disconnects', async () => {
		const client = new AbortController()
		const runAgent: AgentRunner = async function* () {
			yield partial('Hello')
			client.abort()
			await new Promise(() => {})
		}
		const events = await collect(streamChat(ask(), deps({ runAgent, signal: client.signal })))
		expect(events.map((e) => e.type)).toEqual(['delta'])
	})
})

describe('validateChatRequest', () => {
	it('keeps only the most recent turns and starts with a user turn', () => {
		const messages: ChatTurn[] = []
		for (let i = 0; i < 20; i++) {
			messages.push({ role: 'user', content: `q${i}` }, { role: 'assistant', content: `a${i}` })
		}
		messages.push({ role: 'user', content: 'latest' })
		const result = validateChatRequest({ messages })
		if (!result.ok) throw new Error('expected ok')
		expect(result.message).toBe('latest')
		expect(result.history.length).toBeLessThanOrEqual(CHAT_LIMITS.maxHistoryTurns - 1)
		expect(result.history[0].role).toBe('user')
		expect(result.history.at(-1)).toEqual({ role: 'assistant', content: 'a19' })
	})

	it('drops empty turns and truncates long assistant turns', () => {
		const result = validateChatRequest({
			messages: [
				{ role: 'user', content: 'a' },
				{ role: 'assistant', content: '' },
				{ role: 'assistant', content: 'x'.repeat(5000) },
				{ role: 'user', content: 'b' },
			],
		})
		if (!result.ok) throw new Error('expected ok')
		expect(result.history).toHaveLength(2)
		expect(result.history[1].content.length).toBe(4001)
	})

	it('rejects an over-long earlier user message', () => {
		const result = validateChatRequest({
			messages: [
				{ role: 'user', content: 'x'.repeat(CHAT_LIMITS.maxInputChars + 1) },
				{ role: 'user', content: 'ok' },
			],
		})
		expect(result.ok).toBe(false)
	})
})

describe('readAdkEvent', () => {
	it('tolerates junk', () => {
		expect(readAdkEvent(null)).toEqual({
			partial: false,
			text: '',
			errorCode: undefined,
			errorMessage: '',
		})
		expect(readAdkEvent({ content: { parts: 'nope' } }).text).toBe('')
	})
})
