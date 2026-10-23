// @vitest-environment node
import type { ServerResponse } from 'node:http'
import { describe, expect, it } from 'vitest'
import type { ChatStreamEvent } from '../src/types/chat.js'
import { encodeSseEvent, pipeSse, SSE_HEADERS } from './sse.js'

class FakeResponse {
	status = 0
	headers: Record<string, string> = {}
	chunks: string[] = []
	writableEnded = false
	destroyed = false
	flushed = false

	writeHead(status: number, headers: Record<string, string>): this {
		this.status = status
		this.headers = headers
		return this
	}
	flushHeaders(): void {
		this.flushed = true
	}
	write(chunk: string): boolean {
		this.chunks.push(chunk)
		return true
	}
	end(): this {
		this.writableEnded = true
		return this
	}
}

async function* events(list: ChatStreamEvent[], onFinally?: () => void) {
	try {
		for (const event of list) yield event
	} finally {
		onFinally?.()
	}
}

describe('encodeSseEvent', () => {
	it('encodes one event per data frame, escaping newlines', () => {
		expect(encodeSseEvent({ type: 'delta', text: 'a\nb' })).toBe(
			'data: {"type":"delta","text":"a\\nb"}\n\n',
		)
		expect(encodeSseEvent({ type: 'done' })).toBe('data: {"type":"done"}\n\n')
	})
})

describe('pipeSse', () => {
	it('writes SSE headers, frames and ends the response', async () => {
		const res = new FakeResponse()
		await pipeSse(
			res as unknown as ServerResponse,
			events([{ type: 'delta', text: 'hi' }, { type: 'done' }]),
		)
		expect(res.status).toBe(200)
		expect(res.headers).toEqual(SSE_HEADERS)
		expect(res.headers['Content-Type']).toBe('text/event-stream; charset=utf-8')
		expect(res.flushed).toBe(true)
		expect(res.chunks.join('')).toBe(
			'data: {"type":"delta","text":"hi"}\n\ndata: {"type":"done"}\n\n',
		)
		expect(res.writableEnded).toBe(true)
	})

	it('stops pulling events once the client is gone', async () => {
		const res = new FakeResponse()
		const controller = new AbortController()
		let cleanedUp = false
		const source = (async function* () {
			try {
				yield { type: 'delta', text: 'one' } as ChatStreamEvent
				controller.abort()
				yield { type: 'delta', text: 'two' } as ChatStreamEvent
				yield { type: 'done' } as ChatStreamEvent
			} finally {
				cleanedUp = true
			}
		})()
		await pipeSse(res as unknown as ServerResponse, source, controller.signal)
		expect(res.chunks).toHaveLength(1)
		expect(cleanedUp).toBe(true)
		expect(res.writableEnded).toBe(true)
	})
})
