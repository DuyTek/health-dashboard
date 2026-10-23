import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { controlledSseResponse, sseFrames, sseResponse } from '@/test/sse'
import { CHAT_LIMITS, type ChatMessage, type ChatRequest } from '@/types/chat'
import { makeStore } from './index'
import reducer, {
	assistantStarted,
	buildHistory,
	clearConversation,
	closed,
	deltaReceived,
	opened,
	retryLast,
	selectCanRetry,
	selectIsStreaming,
	sendMessage,
	stopGeneration,
	streamCompleted,
	streamFailed,
	toggled,
	userMessageAdded,
} from './chatSlice'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
	fetchMock.mockReset()
	vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
	vi.unstubAllGlobals()
})

function lastRequest(): ChatRequest {
	const init = fetchMock.mock.lastCall?.[1]
	return JSON.parse(String(init?.body)) as ChatRequest
}

function message(
	partial: Partial<ChatMessage> & Pick<ChatMessage, 'role' | 'content'>,
): ChatMessage {
	return {
		id: Math.random().toString(36),
		status: 'complete',
		meta: null,
		error: null,
		createdAt: 0,
		...partial,
	}
}

describe('chat reducers', () => {
	it('opens, closes and toggles the panel', () => {
		let state = reducer(undefined, opened())
		expect(state.isOpen).toBe(true)
		state = reducer(state, closed())
		expect(state.isOpen).toBe(false)
		state = reducer(state, toggled())
		expect(state.isOpen).toBe(true)
	})

	it('streams deltas into the pending assistant message and completes it', () => {
		let state = reducer(undefined, userMessageAdded('Hi'))
		state = reducer(state, assistantStarted('a1'))
		expect(state.pendingId).toBe('a1')
		state = reducer(state, deltaReceived({ id: 'a1', text: 'Hel' }))
		state = reducer(state, deltaReceived({ id: 'a1', text: 'lo' }))
		state = reducer(state, streamCompleted({ id: 'a1' }))
		expect(state.pendingId).toBeNull()
		expect(state.messages[1]).toMatchObject({ content: 'Hello', status: 'complete' })
		// Late deltas after completion are ignored.
		state = reducer(state, deltaReceived({ id: 'a1', text: '!' }))
		expect(state.messages[1].content).toBe('Hello')
	})

	it('marks an empty completed answer as an empty_response error', () => {
		let state = reducer(undefined, assistantStarted('a1'))
		state = reducer(state, streamCompleted({ id: 'a1' }))
		expect(state.messages[0]).toMatchObject({
			status: 'error',
			error: { code: 'empty_response' },
		})
	})

	it('flags unread replies that finish while the panel is closed', () => {
		let state = reducer(undefined, assistantStarted('a1'))
		state = reducer(state, streamFailed({ id: 'a1', code: 'timeout', message: 'x' }))
		expect(state.hasUnread).toBe(true)
		state = reducer(state, opened())
		expect(state.hasUnread).toBe(false)
	})
})

describe('buildHistory', () => {
	it('drops failed exchanges and keeps the trailing question', () => {
		const history = buildHistory([
			message({ role: 'user', content: 'q1' }),
			message({ role: 'assistant', content: 'a1' }),
			message({ role: 'user', content: 'q2' }),
			message({ role: 'assistant', content: '', status: 'error' }),
			message({ role: 'user', content: 'q3' }),
			message({ role: 'assistant', content: 'partial', status: 'stopped' }),
			message({ role: 'user', content: 'q4' }),
		])
		expect(history).toEqual([
			{ role: 'user', content: 'q1' },
			{ role: 'assistant', content: 'a1' },
			{ role: 'user', content: 'q3' },
			{ role: 'assistant', content: 'partial' },
			{ role: 'user', content: 'q4' },
		])
	})

	it('trims to maxHistoryTurns and starts with a user turn', () => {
		const messages: ChatMessage[] = []
		for (let i = 0; i < 20; i++) {
			messages.push(message({ role: 'user', content: `q${i}` }))
			messages.push(message({ role: 'assistant', content: `a${i}` }))
		}
		messages.push(message({ role: 'user', content: 'latest' }))
		const history = buildHistory(messages)
		expect(history.length).toBeLessThanOrEqual(CHAT_LIMITS.maxHistoryTurns)
		expect(history[0].role).toBe('user')
		expect(history.at(-1)).toEqual({ role: 'user', content: 'latest' })
	})
})

describe('sendMessage', () => {
	it('posts the history and streams a reply with meta', async () => {
		fetchMock.mockResolvedValue(
			sseResponse(
				sseFrames([
					{ type: 'delta', text: '**Great** ' },
					{ type: 'delta', text: 'progress' },
					{ type: 'meta', meta: { citedMetrics: ['steps'], followUps: ['What next?'] } },
					{ type: 'done' },
				]),
			),
		)
		const store = makeStore()
		const result = await store.dispatch(sendMessage('  How am I doing?  '))

		expect(result).toBe('sent')
		expect(fetchMock).toHaveBeenCalledWith('/api/chat', expect.objectContaining({ method: 'POST' }))
		expect(lastRequest()).toEqual({ messages: [{ role: 'user', content: 'How am I doing?' }] })
		const [user, assistant] = store.getState().chat.messages
		expect(user).toMatchObject({ role: 'user', content: 'How am I doing?' })
		expect(assistant).toMatchObject({
			role: 'assistant',
			content: '**Great** progress',
			status: 'complete',
			meta: { citedMetrics: ['steps'], followUps: ['What next?'] },
		})
		expect(selectIsStreaming(store.getState())).toBe(false)
	})

	it('sends prior completed turns as history', async () => {
		fetchMock.mockImplementation(async () =>
			sseResponse(sseFrames([{ type: 'delta', text: 'ok' }, { type: 'done' }])),
		)
		const store = makeStore()
		await store.dispatch(sendMessage('first'))
		await store.dispatch(sendMessage('second'))
		expect(lastRequest().messages).toEqual([
			{ role: 'user', content: 'first' },
			{ role: 'assistant', content: 'ok' },
			{ role: 'user', content: 'second' },
		])
	})

	it('rejects empty, too-long and concurrent messages without calling the server', async () => {
		const store = makeStore()
		expect(await store.dispatch(sendMessage('   '))).toBe('empty')
		expect(await store.dispatch(sendMessage('x'.repeat(CHAT_LIMITS.maxInputChars + 1)))).toBe(
			'too_long',
		)
		expect(fetchMock).not.toHaveBeenCalled()

		const stream = controlledSseResponse()
		fetchMock.mockResolvedValue(stream.response)
		const first = store.dispatch(sendMessage('one'))
		expect(await store.dispatch(sendMessage('two'))).toBe('busy')
		stream.push(sseFrames([{ type: 'delta', text: 'a' }, { type: 'done' }]))
		stream.close()
		await first
		expect(fetchMock).toHaveBeenCalledTimes(1)
	})

	it('stores server error events on the assistant message', async () => {
		fetchMock.mockResolvedValue(
			sseResponse(sseFrames([{ type: 'error', code: 'rate_limited', message: 'quota' }])),
		)
		const store = makeStore()
		await store.dispatch(sendMessage('hi'))
		expect(store.getState().chat.messages[1]).toMatchObject({
			status: 'error',
			error: { code: 'rate_limited', message: 'quota' },
		})
		expect(selectCanRetry(store.getState())).toBe(true)
	})

	it('turns a network failure into an upstream_error', async () => {
		fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
		const store = makeStore()
		await store.dispatch(sendMessage('hi'))
		expect(store.getState().chat.messages[1]).toMatchObject({
			status: 'error',
			error: { code: 'upstream_error' },
		})
		expect(store.getState().chat.pendingId).toBeNull()
	})

	it('stops generation, keeping partial text and aborting the request', async () => {
		const stream = controlledSseResponse()
		fetchMock.mockResolvedValue(stream.response)
		const store = makeStore()
		const pending = store.dispatch(sendMessage('hi'))
		stream.push(sseFrames([{ type: 'delta', text: 'Partial' }]))
		await vi.waitFor(() => expect(store.getState().chat.messages[1].content).toBe('Partial'))

		store.dispatch(stopGeneration())
		const signal = fetchMock.mock.lastCall?.[1]?.signal
		expect(signal?.aborted).toBe(true)
		await pending
		stream.push(sseFrames([{ type: 'delta', text: ' ignored' }]))
		expect(store.getState().chat.messages[1]).toMatchObject({
			content: 'Partial',
			status: 'stopped',
		})
		expect(store.getState().chat.pendingId).toBeNull()
	})

	it('retries the last question after an error', async () => {
		fetchMock.mockResolvedValueOnce(
			sseResponse(sseFrames([{ type: 'error', code: 'timeout', message: 'slow' }])),
		)
		fetchMock.mockResolvedValueOnce(
			sseResponse(sseFrames([{ type: 'delta', text: 'Answer' }, { type: 'done' }])),
		)
		const store = makeStore()
		await store.dispatch(sendMessage('question'))
		await store.dispatch(retryLast())

		expect(lastRequest()).toEqual({ messages: [{ role: 'user', content: 'question' }] })
		const messages = store.getState().chat.messages
		expect(messages).toHaveLength(2)
		expect(messages[1]).toMatchObject({ content: 'Answer', status: 'complete' })
	})

	it('clearConversation aborts the stream and empties messages', async () => {
		const stream = controlledSseResponse()
		fetchMock.mockResolvedValue(stream.response)
		const store = makeStore()
		const pending = store.dispatch(sendMessage('hi'))
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
		store.dispatch(clearConversation())
		await pending
		expect(store.getState().chat.messages).toEqual([])
		expect(store.getState().chat.pendingId).toBeNull()
	})
})
