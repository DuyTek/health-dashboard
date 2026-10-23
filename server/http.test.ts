// @vitest-environment node
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { fixtureData, fixtureSummary } from './__fixtures__/health.js'
import { createChatServer } from './http.js'
import type { AgentRunner } from './runner.js'

// Exercises the real HTTP + SSE path on an ephemeral port with a fake agent.

const runAgent: AgentRunner = async function* (input) {
	yield { partial: true, content: { parts: [{ text: `Echo: ${input.message}` }] } }
	yield {
		partial: true,
		content: { parts: [{ text: '<meta>{"citedMetrics":[],"followUps":["Next?"]}</meta>' }] },
	}
}

let server: Server
let baseUrl = ''

beforeAll(async () => {
	server = createChatServer({
		config: { apiKey: 'test-key', model: 'fake' },
		loadHealth: () => ({ data: fixtureData, summary: fixtureSummary }),
		runAgent,
		log: () => {},
	})
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
	baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
	await new Promise((resolve) => server.close(resolve))
})

function parseFrames(body: string): unknown[] {
	return body
		.split('\n\n')
		.filter(Boolean)
		.map((frame) => JSON.parse(frame.replace(/^data: /, '')) as unknown)
}

describe('chat HTTP server', () => {
	it('streams SSE frames for a valid POST', async () => {
		const res = await fetch(`${baseUrl}/api/chat`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
		})
		expect(res.status).toBe(200)
		expect(res.headers.get('content-type')).toBe('text/event-stream; charset=utf-8')
		expect(res.headers.get('cache-control')).toBe('no-cache, no-transform')
		expect(parseFrames(await res.text())).toEqual([
			{ type: 'delta', text: 'Echo: hello' },
			{ type: 'meta', meta: { citedMetrics: [], followUps: ['Next?'] } },
			{ type: 'done' },
		])
	})

	it('answers 405 JSON for non-POST methods', async () => {
		const res = await fetch(`${baseUrl}/api/chat`)
		expect(res.status).toBe(405)
		expect(res.headers.get('allow')).toBe('POST')
		expect(await res.json()).toEqual({ error: 'Method not allowed. Use POST.' })
	})

	it('reports malformed JSON as an invalid_request event', async () => {
		const res = await fetch(`${baseUrl}/api/chat`, { method: 'POST', body: '{nope' })
		const frames = parseFrames(await res.text())
		expect(frames).toEqual([expect.objectContaining({ type: 'error', code: 'invalid_request' })])
	})

	it('returns 404 for other paths', async () => {
		const res = await fetch(`${baseUrl}/api/other`, { method: 'POST' })
		expect(res.status).toBe(404)
	})

	it('rejects oversized bodies with 413', async () => {
		const res = await fetch(`${baseUrl}/api/chat`, {
			method: 'POST',
			body: 'x'.repeat(70 * 1024),
		})
		expect(res.status).toBe(413)
	})
})
