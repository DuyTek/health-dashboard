// Shared contract between the assistant UI (client) and /api/chat (server).
//
// Wire format: the server responds with `text/event-stream`. Each SSE frame is
// `data: <JSON ChatStreamEvent>\n\n`. A stream always ends with exactly one
// `done` or `error` event.

export type ChatRole = 'user' | 'assistant'

/** One conversation turn as sent to the server. */
export interface ChatTurn {
	role: ChatRole
	content: string
}

export interface ChatRequest {
	/** Prior turns plus the new user message last. Trimmed to MAX_HISTORY_TURNS by the client. */
	messages: ChatTurn[]
}

/** Structured data the model appends after its markdown answer. */
export interface AssistantMeta {
	/** MetricKey values (or 'activities' / 'goals') the answer relied on. */
	citedMetrics: string[]
	/** Up to 3 suggested follow-up questions. */
	followUps: string[]
}

export type ChatErrorCode =
	| 'invalid_request'
	| 'rate_limited'
	| 'timeout'
	| 'blocked'
	| 'empty_response'
	| 'config_error'
	| 'upstream_error'

export type ChatStreamEvent =
	| { type: 'delta'; text: string }
	| { type: 'meta'; meta: AssistantMeta }
	| { type: 'error'; code: ChatErrorCode; message: string }
	| { type: 'done' }

/** Client-side message as stored in Redux. */
export interface ChatMessage {
	id: string
	role: ChatRole
	content: string
	status: 'streaming' | 'complete' | 'stopped' | 'error'
	meta: AssistantMeta | null
	error: { code: ChatErrorCode; message: string } | null
	createdAt: number
}

export const CHAT_LIMITS = {
	/** Max characters in one user message (enforced client- and server-side). */
	maxInputChars: 1000,
	/** Max turns (user + assistant) sent per request. */
	maxHistoryTurns: 12,
	/** Server-side timeout for one model run. */
	requestTimeoutMs: 45_000,
} as const
