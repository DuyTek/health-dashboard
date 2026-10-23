import type { ChatErrorCode } from '../src/types/chat.js'

/** User-safe messages. Upstream details are logged, never sent to the client. */
export const ERROR_MESSAGES: Record<ChatErrorCode, string> = {
	invalid_request: 'That message could not be sent. Please check it and try again.',
	rate_limited:
		'The assistant is receiving too many requests right now. Please wait a minute and try again.',
	timeout: 'The assistant took too long to respond. Please try again.',
	blocked:
		"I can't help with that request. Try asking about your activity, sleep, nutrition or goals.",
	empty_response: "The assistant didn't return an answer. Please try rephrasing your question.",
	config_error: 'The assistant is not configured on the server yet (missing or invalid API key).',
	upstream_error: 'The assistant is temporarily unavailable. Please try again in a moment.',
}

/** Gemini finish/block reasons that mean the content was filtered. */
const BLOCKED_CODES = new Set([
	'SAFETY',
	'RECITATION',
	'BLOCKLIST',
	'PROHIBITED_CONTENT',
	'SPII',
	'IMAGE_SAFETY',
	'IMAGE_PROHIBITED_CONTENT',
])

/** Finish reasons that are not errors (the text produced so far is usable). */
export const BENIGN_FINISH_CODES = new Set(['STOP', 'MAX_TOKENS', 'FINISH_REASON_UNSPECIFIED'])

/**
 * Maps an upstream failure to a contract error code. ADK reports model errors
 * as events with `errorCode`/`errorMessage` (often `UNKNOWN_ERROR` plus the
 * raw API message), and some failures are thrown, so both the code and the
 * message text are inspected.
 */
export function classifyUpstreamError(code: string | undefined, message: string): ChatErrorCode {
	const upperCode = (code ?? '').toUpperCase()
	if (BLOCKED_CODES.has(upperCode)) return 'blocked'
	const text = `${upperCode} ${message}`
	if (/\b429\b|RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(text)) return 'rate_limited'
	if (/API_KEY_INVALID|API key not valid|API key expired|PERMISSION_DENIED|\b40[13]\b/i.test(text))
		return 'config_error'
	if (/DEADLINE_EXCEEDED|\b504\b/i.test(text)) return 'timeout'
	return 'upstream_error'
}

/** Pulls a code and message out of anything thrown (genai ApiError has `status`). */
export function describeThrown(error: unknown): { code: string | undefined; message: string } {
	if (error instanceof Error) {
		const status = (error as Error & { status?: unknown }).status
		return {
			code: typeof status === 'number' || typeof status === 'string' ? String(status) : undefined,
			message: error.message,
		}
	}
	return { code: undefined, message: typeof error === 'string' ? error : 'Unknown error' }
}

const KEY_PATTERN = /AIza[0-9A-Za-z_-]{20,}/g

/** Removes anything that looks like a Google API key (and the configured key). */
export function redactSecrets(text: string, secret?: string): string {
	let out = text.replace(KEY_PATTERN, '[redacted]')
	if (secret && secret.length >= 8) out = out.split(secret).join('[redacted]')
	return out.replace(/([?&]key=)[^&\s"]+/gi, '$1[redacted]')
}

export type ServerLogger = (message: string) => void

export const defaultLogger: ServerLogger = (message) => {
	console.error(`[assistant] ${message}`)
}
