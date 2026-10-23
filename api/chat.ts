import type { VercelRequest, VercelResponse } from '@vercel/node'
import { coerceJsonBody, handleChatHttp } from '../server/handler.js'

// Vercel Node.js function: POST /api/chat -> SSE stream (see src/types/chat.ts).
// Kept thin; all logic lives in server/. Response streaming is on by default
// for Node.js functions; maxDuration leaves headroom over the 45 s model timeout.

export const config = { maxDuration: 60 }

function readBody(req: VercelRequest): unknown {
	try {
		// `req.body` is a lazy getter that throws on malformed JSON.
		return coerceJsonBody(req.body)
	} catch {
		return undefined
	}
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
	await handleChatHttp(req, res, req.method === 'POST' ? readBody(req) : undefined)
}
