// @vitest-environment node
import { EventEmitter } from 'node:events'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatStreamEvent } from '../src/types/chat.js'

const streamChat = vi.fn<(body: unknown, deps: unknown) => AsyncGenerator<ChatStreamEvent>>()
vi.mock('../server/chat.js', () => ({ streamChat }))

const { default: handler, config } = await import('../api/chat.js')

class MockResponse extends EventEmitter {
	statusCode = 200
	headers: Record<string, string | number> = {}
	body = ''
	headersSent = false
	writableEnded = false
	writableFinished = false
	destroyed = false

	setHeader(name: string, value: string | number): this {
		this.headers[name.toLowerCase()] = value
		return this
	}
	writeHead(status: number, headers: Record<string, string>): this {
		this.statusCode = status
		for (const [k, v] of Object.entries(headers)) this.setHeader(k, v)
		this.headersSent = true
		return this
	}
	flushHeaders(): void {
		this.headersSent = true
	}
	write(chunk: string): boolean {
		this.body += chunk
		return true
	}
	end(chunk?: string): this {
		if (chunk) this.body += chunk
		this.writableEnded = true
		this.writableFinished = true
		this.emit('close')
		return this
	}
}

function mockReq(method: string, body?: unknown): VercelRequest {
	return Object.assign(new EventEmitter(), { method, body }) as unknown as VercelRequest
}

beforeEach(() => {
	streamChat.mockReset()
})

describe('api/chat handler', () => {
	it('declares a maxDuration above the model timeout', () => {
		expect(config.maxDuration).toBeGreaterThan(45)
	})

	it('rejects non-POST with 405 JSON and never runs the model', async () => {
		const res = new MockResponse()
		await handler(mockReq('GET'), res as unknown as VercelResponse)
		expect(res.statusCode).toBe(405)
		expect(res.headers.allow).toBe('POST')
		expect(JSON.parse(res.body)).toEqual({ error: 'Method not allowed. Use POST.' })
		expect(streamChat).not.toHaveBeenCalled()
	})

	it('streams the events from streamChat as SSE frames', async () => {
		streamChat.mockImplementation(async function* (): AsyncGenerator<ChatStreamEvent> {
			yield { type: 'delta', text: 'Hi' }
			yield { type: 'done' }
		})
		const body = { messages: [{ role: 'user', content: 'Hello' }] }
		const res = new MockResponse()
		await handler(mockReq('POST', body), res as unknown as VercelResponse)

		expect(streamChat).toHaveBeenCalledWith(
			body,
			expect.objectContaining({ signal: expect.any(AbortSignal) }),
		)
		expect(res.statusCode).toBe(200)
		expect(res.headers['content-type']).toBe('text/event-stream; charset=utf-8')
		expect(res.headers['x-accel-buffering']).toBe('no')
		expect(res.body).toBe('data: {"type":"delta","text":"Hi"}\n\ndata: {"type":"done"}\n\n')
		expect(res.writableEnded).toBe(true)
	})

	it('parses a string body and tolerates a throwing body getter', async () => {
		streamChat.mockImplementation(async function* (): AsyncGenerator<ChatStreamEvent> {
			yield { type: 'done' }
		})
		await handler(mockReq('POST', '{"messages":[]}'), new MockResponse() as unknown as VercelResponse)
		expect(streamChat.mock.calls[0][0]).toEqual({ messages: [] })

		const req = mockReq('POST')
		Object.defineProperty(req, 'body', {
			get() {
				throw new Error('Invalid JSON')
			},
		})
		await handler(req, new MockResponse() as unknown as VercelResponse)
		expect(streamChat.mock.calls[1][0]).toBeUndefined()
	})
})
