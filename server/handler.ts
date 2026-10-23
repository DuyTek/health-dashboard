import type { IncomingMessage, ServerResponse } from 'node:http'
import { streamChat, type StreamChatDeps } from './chat.js'
import { defaultLogger, describeThrown, redactSecrets } from './errors.js'
import { pipeSse } from './sse.js'

// HTTP layer shared by the Vercel function (api/chat.ts) and the local dev
// server. POST only; the response is always an SSE stream, including for
// validation errors (sent as an `error` event), so the client has one path.

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
	res.statusCode = status
	res.setHeader('Content-Type', 'application/json; charset=utf-8')
	res.end(JSON.stringify(body))
}

/** Accepts an already-parsed body, a JSON string, or a Buffer. */
export function coerceJsonBody(body: unknown): unknown {
	if (typeof body === 'string' || body instanceof Uint8Array) {
		const text = typeof body === 'string' ? body : Buffer.from(body).toString('utf8')
		try {
			return JSON.parse(text) as unknown
		} catch {
			return undefined
		}
	}
	return body
}

export async function handleChatHttp(
	req: IncomingMessage,
	res: ServerResponse,
	body: unknown,
	deps: Omit<StreamChatDeps, 'signal'> = {},
): Promise<void> {
	if (req.method !== 'POST') {
		res.setHeader('Allow', 'POST')
		sendJson(res, 405, { error: 'Method not allowed. Use POST.' })
		return
	}

	const controller = new AbortController()
	// `res` 'close' fires on completion too; only a close before the end
	// means the client went away.
	res.on('close', () => {
		if (!res.writableFinished) controller.abort()
	})

	try {
		await pipeSse(
			res,
			streamChat(coerceJsonBody(body), { ...deps, signal: controller.signal }),
			controller.signal,
		)
	} catch (error) {
		const log = deps.log ?? defaultLogger
		log(`SSE pipe failed: ${redactSecrets(describeThrown(error).message)}`)
		if (!res.headersSent) sendJson(res, 500, { error: 'Internal error' })
		else if (!res.writableEnded) res.end()
	}
}
