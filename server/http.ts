import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { StreamChatDeps } from './chat.js'
import { handleChatHttp, sendJson } from './handler.js'

// Minimal node:http server for local development: routes /api/chat to the same
// handler the Vercel function uses. Vite proxies /api here (vite.config.ts).

export const MAX_BODY_BYTES = 64 * 1024

class BodyTooLarge extends Error {}

export function readRawBody(req: IncomingMessage, limit = MAX_BODY_BYTES): Promise<string> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = []
		let size = 0
		req.on('data', (chunk: Buffer) => {
			size += chunk.length
			if (size > limit) {
				// Keep draining (without buffering) so the 413 reaches the client.
				reject(new BodyTooLarge('Request body too large'))
				return
			}
			chunks.push(chunk)
		})
		req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
		req.on('error', reject)
	})
}

export function createChatServer(deps: Omit<StreamChatDeps, 'signal'> = {}): Server {
	return createServer((req, res) => {
		const path = (req.url ?? '/').split('?')[0]
		if (path !== '/api/chat') {
			sendJson(res, 404, { error: 'Not found' })
			return
		}
		if (req.method !== 'POST') {
			void handleChatHttp(req, res, undefined, deps)
			return
		}
		readRawBody(req)
			.then((raw) => handleChatHttp(req, res, raw, deps))
			.catch((error: unknown) => {
				if (res.headersSent) return
				if (error instanceof BodyTooLarge) sendJson(res, 413, { error: error.message })
				else sendJson(res, 400, { error: 'Could not read request body' })
			})
	})
}
