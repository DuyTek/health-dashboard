import type { ServerResponse } from 'node:http'
import type { ChatStreamEvent } from '../src/types/chat.js'

export const SSE_HEADERS = {
	'Content-Type': 'text/event-stream; charset=utf-8',
	'Cache-Control': 'no-cache, no-transform',
	Connection: 'keep-alive',
	// Disable proxy buffering (nginx and compatible proxies).
	'X-Accel-Buffering': 'no',
} as const

/** One SSE frame: `data: <json>\n\n` (JSON never contains a raw newline). */
export function encodeSseEvent(event: ChatStreamEvent): string {
	return `data: ${JSON.stringify(event)}\n\n`
}

/**
 * Writes `events` to `res` as SSE. Stops pulling from the generator (which
 * runs its cleanup and cancels the model call) when the client disconnects.
 */
export async function pipeSse(
	res: ServerResponse,
	events: AsyncGenerator<ChatStreamEvent, void, undefined>,
	signal?: AbortSignal,
): Promise<void> {
	res.writeHead(200, SSE_HEADERS)
	res.flushHeaders()
	try {
		for await (const event of events) {
			if (signal?.aborted || res.destroyed) break
			res.write(encodeSseEvent(event))
		}
	} finally {
		if (!res.writableEnded) res.end()
	}
}
