import type { ChatStreamEvent } from '@/types/chat'

// Test helpers for building fake /api/chat responses. Never hits the network.

/** Serialises events as SSE frames (`data: <json>\n\n`). */
export function sseFrames(events: ChatStreamEvent[]): string {
	return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')
}

export interface StreamControls {
	response: Response
	push: (text: string) => void
	close: () => void
	error: (reason?: unknown) => void
}

/** A streaming SSE response whose chunks the test pushes manually. */
export function controlledSseResponse(): StreamControls {
	const encoder = new TextEncoder()
	let controller!: ReadableStreamDefaultController<Uint8Array>
	const body = new ReadableStream<Uint8Array>({
		start(c) {
			controller = c
		},
	})
	return {
		response: new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }),
		push: (text) => {
			try {
				controller.enqueue(encoder.encode(text))
			} catch {
				// Stream already cancelled.
			}
		},
		close: () => {
			try {
				controller.close()
			} catch {
				// Stream already cancelled.
			}
		},
		error: (reason) => controller.error(reason),
	}
}

/** An SSE response that emits the given raw text chunks, then closes. */
export function sseResponse(chunks: string[] | string, init: ResponseInit = {}): Response {
	const encoder = new TextEncoder()
	const parts = Array.isArray(chunks) ? chunks : [chunks]
	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			for (const part of parts) controller.enqueue(encoder.encode(part))
			controller.close()
		},
	})
	return new Response(body, {
		status: 200,
		...init,
		headers: { 'Content-Type': 'text/event-stream', ...init.headers },
	})
}
