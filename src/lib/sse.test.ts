import { describe, expect, it } from 'vitest'
import { controlledSseResponse, sseFrames, sseResponse } from '@/test/sse'
import type { ChatStreamEvent } from '@/types/chat'
import { STREAM_ENDED_MESSAGE, parseFrameData, readChatStream } from './sse'

async function collect(response: Response, signal?: AbortSignal): Promise<ChatStreamEvent[]> {
	const events: ChatStreamEvent[] = []
	for await (const event of readChatStream(response, signal)) events.push(event)
	return events
}

const unexpectedEnd: ChatStreamEvent = {
	type: 'error',
	code: 'upstream_error',
	message: STREAM_ENDED_MESSAGE,
}

describe('parseFrameData', () => {
	it('joins multiple data lines with a newline and strips one leading space', () => {
		expect(parseFrameData('data: a\ndata:b\ndata:  c')).toBe('a\nb\n c')
	})

	it('ignores comments and unknown fields', () => {
		expect(parseFrameData(': keep-alive')).toBeNull()
		expect(parseFrameData('event: message\nid: 1\nretry: 10\ndata: x')).toBe('x')
	})
})

describe('readChatStream', () => {
	it('yields events in order and stops at done', async () => {
		const events: ChatStreamEvent[] = [
			{ type: 'delta', text: 'Hello' },
			{ type: 'delta', text: ' world' },
			{ type: 'meta', meta: { citedMetrics: ['steps'], followUps: ['More?'] } },
			{ type: 'done' },
		]
		expect(await collect(sseResponse(sseFrames(events)))).toEqual(events)
	})

	it('reassembles frames split across arbitrary chunk boundaries', async () => {
		const text = sseFrames([{ type: 'delta', text: 'Héllo 👋' }, { type: 'done' }])
		// Split the encoded bytes one at a time, including inside multi-byte characters.
		const bytes = new TextEncoder().encode(text)
		const body = new ReadableStream<Uint8Array>({
			start(controller) {
				for (const byte of bytes) controller.enqueue(new Uint8Array([byte]))
				controller.close()
			},
		})
		const response = new Response(body, { headers: { 'Content-Type': 'text/event-stream' } })
		expect(await collect(response)).toEqual([{ type: 'delta', text: 'Héllo 👋' }, { type: 'done' }])
	})

	it('handles CRLF line endings, even when \\r and \\n land in different chunks', async () => {
		const response = sseResponse([
			'data: {"type":"delta","text":"a"}\r',
			'\n\r\ndata: {"type":"done"}\r\n\r\n',
		])
		expect(await collect(response)).toEqual([{ type: 'delta', text: 'a' }, { type: 'done' }])
	})

	it('parses JSON spread over multiple data lines', async () => {
		const response = sseResponse(
			'data: {"type":"delta",\ndata: "text":"multi"}\n\ndata: {"type":"done"}\n\n',
		)
		expect(await collect(response)).toEqual([{ type: 'delta', text: 'multi' }, { type: 'done' }])
	})

	it('skips comments, malformed JSON and unknown or invalid events', async () => {
		const response = sseResponse(
			[
				': ping',
				'data: not json',
				'data: {"type":"mystery"}',
				'data: {"type":"delta","text":42}',
				'data: {"type":"error","code":"nope","message":"x"}',
				'event: delta',
				'data: {"type":"delta","text":"ok"}',
				'data: {"type":"done"}',
			].join('\n\n') + '\n\n',
		)
		expect(await collect(response)).toEqual([{ type: 'delta', text: 'ok' }, { type: 'done' }])
	})

	it('stops after a server error event', async () => {
		const response = sseResponse(
			sseFrames([
				{ type: 'delta', text: 'partial' },
				{ type: 'error', code: 'rate_limited', message: 'Slow down' },
				{ type: 'delta', text: 'ignored' },
			]),
		)
		expect(await collect(response)).toEqual([
			{ type: 'delta', text: 'partial' },
			{ type: 'error', code: 'rate_limited', message: 'Slow down' },
		])
	})

	it('flushes a final frame without a trailing blank line', async () => {
		const response = sseResponse('data: {"type":"done"}')
		expect(await collect(response)).toEqual([{ type: 'done' }])
	})

	it('yields a synthetic error when the stream ends without done', async () => {
		const response = sseResponse(sseFrames([{ type: 'delta', text: 'cut' }]))
		expect(await collect(response)).toEqual([{ type: 'delta', text: 'cut' }, unexpectedEnd])
	})

	it('yields a synthetic error when the connection breaks mid-stream', async () => {
		const stream = controlledSseResponse()
		const pending = collect(stream.response)
		stream.push(sseFrames([{ type: 'delta', text: 'a' }]))
		stream.error(new TypeError('network'))
		expect(await pending).toEqual([{ type: 'delta', text: 'a' }, unexpectedEnd])
	})

	it('maps a non-2xx JSON error body to an error event', async () => {
		const response = new Response(
			JSON.stringify({ type: 'error', code: 'config_error', message: 'Missing key' }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } },
		)
		expect(await collect(response)).toEqual([
			{ type: 'error', code: 'config_error', message: 'Missing key' },
		])
	})

	it('maps a non-2xx response without a JSON body by status', async () => {
		expect(await collect(new Response('nope', { status: 405 }))).toEqual([
			{ type: 'error', code: 'invalid_request', message: 'Request failed (405).' },
		])
		expect(await collect(new Response('', { status: 429 }))).toEqual([
			expect.objectContaining({ type: 'error', code: 'rate_limited' }),
		])
		expect(await collect(new Response('', { status: 502 }))).toEqual([
			expect.objectContaining({ type: 'error', code: 'upstream_error' }),
		])
	})

	it('treats a 2xx response that is not an event stream as an error', async () => {
		const response = new Response('<html></html>', {
			status: 200,
			headers: { 'Content-Type': 'text/html' },
		})
		expect(await collect(response)).toEqual([
			expect.objectContaining({ type: 'error', code: 'upstream_error' }),
		])
	})

	it('throws when aborted, so callers can tell a stop from a failure', async () => {
		const stream = controlledSseResponse()
		const controller = new AbortController()
		const seen: ChatStreamEvent[] = []
		const run = (async () => {
			for await (const event of readChatStream(stream.response, controller.signal)) {
				seen.push(event)
				controller.abort()
			}
		})()
		stream.push(sseFrames([{ type: 'delta', text: 'a' }]))
		await expect(run).rejects.toMatchObject({ name: 'AbortError' })
		expect(seen).toEqual([{ type: 'delta', text: 'a' }])
	})
})
