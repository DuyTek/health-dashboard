import {
	createSlice,
	nanoid,
	type PayloadAction,
	type ThunkAction,
	type UnknownAction,
} from '@reduxjs/toolkit'
import { NETWORK_ERROR_MESSAGE } from '@/config/constants/assistant'
import { readChatStream } from '@/lib/sse'
import {
	CHAT_LIMITS,
	type AssistantMeta,
	type ChatErrorCode,
	type ChatMessage,
	type ChatRequest,
	type ChatTurn,
} from '@/types/chat'
import type { RootState } from './index'

// Conversation state for the floating assistant. Messages live in memory only
// (lost on refresh). The AbortController for the in-flight request is kept
// outside Redux, in a module-level map keyed by assistant message id, so state
// stays serializable.

export const CHAT_ENDPOINT = '/api/chat'

export interface ChatState {
	messages: ChatMessage[]
	isOpen: boolean
	/** Id of the assistant message currently streaming, if any. */
	pendingId: string | null
	/** A reply finished while the panel was closed. */
	hasUnread: boolean
}

const initialState: ChatState = {
	messages: [],
	isOpen: false,
	pendingId: null,
	hasUnread: false,
}

function findStreaming(state: ChatState, id: string): ChatMessage | undefined {
	const message = state.messages.find((m) => m.id === id)
	return message?.status === 'streaming' ? message : undefined
}

function finish(state: ChatState, id: string) {
	if (state.pendingId === id) state.pendingId = null
	if (!state.isOpen) state.hasUnread = true
}

const chatSlice = createSlice({
	name: 'chat',
	initialState,
	reducers: {
		opened(state) {
			state.isOpen = true
			state.hasUnread = false
		},
		closed(state) {
			state.isOpen = false
		},
		toggled(state) {
			state.isOpen = !state.isOpen
			if (state.isOpen) state.hasUnread = false
		},
		userMessageAdded: {
			reducer(state, action: PayloadAction<{ id: string; content: string; createdAt: number }>) {
				state.messages.push({
					...action.payload,
					role: 'user',
					status: 'complete',
					meta: null,
					error: null,
				})
			},
			prepare(content: string) {
				return { payload: { id: nanoid(), content, createdAt: Date.now() } }
			},
		},
		assistantStarted: {
			reducer(state, action: PayloadAction<{ id: string; createdAt: number }>) {
				state.messages.push({
					...action.payload,
					role: 'assistant',
					content: '',
					status: 'streaming',
					meta: null,
					error: null,
				})
				state.pendingId = action.payload.id
			},
			prepare(id: string = nanoid()) {
				return { payload: { id, createdAt: Date.now() } }
			},
		},
		deltaReceived(state, action: PayloadAction<{ id: string; text: string }>) {
			const message = findStreaming(state, action.payload.id)
			if (message) message.content += action.payload.text
		},
		metaReceived(state, action: PayloadAction<{ id: string; meta: AssistantMeta }>) {
			const message = findStreaming(state, action.payload.id)
			if (message) message.meta = action.payload.meta
		},
		streamCompleted(state, action: PayloadAction<{ id: string }>) {
			const message = findStreaming(state, action.payload.id)
			if (!message) return
			if (message.content.trim() === '') {
				// `done` with no text: treat as an empty answer so the user can retry.
				message.status = 'error'
				message.error = { code: 'empty_response', message: 'The model returned no text.' }
			} else {
				message.status = 'complete'
			}
			finish(state, message.id)
		},
		streamFailed(state, action: PayloadAction<{ id: string; code: ChatErrorCode; message: string }>) {
			const { id, code, message: text } = action.payload
			const message = findStreaming(state, id)
			if (!message) return
			message.status = 'error'
			message.error = { code, message: text }
			finish(state, id)
		},
		streamStopped(state, action: PayloadAction<{ id: string }>) {
			const message = findStreaming(state, action.payload.id)
			if (!message) return
			message.status = 'stopped'
			if (state.pendingId === message.id) state.pendingId = null
		},
		messageRemoved(state, action: PayloadAction<{ id: string }>) {
			state.messages = state.messages.filter((m) => m.id !== action.payload.id)
		},
		conversationCleared(state) {
			state.messages = []
			state.pendingId = null
			state.hasUnread = false
		},
	},
})

export const {
	opened,
	closed,
	toggled,
	userMessageAdded,
	assistantStarted,
	deltaReceived,
	metaReceived,
	streamCompleted,
	streamFailed,
	streamStopped,
	messageRemoved,
	conversationCleared,
} = chatSlice.actions

export default chatSlice.reducer

// ---------------------------------------------------------------------------
// History

function isUsableAnswer(message: ChatMessage | undefined): boolean {
	return (
		message?.role === 'assistant' &&
		(message.status === 'complete' || message.status === 'stopped') &&
		message.content.trim() !== ''
	)
}

/**
 * Builds the turns sent to the server: every user question that got a usable
 * answer, paired with that answer, plus the trailing (new) user question.
 * Failed/empty assistant turns and the questions behind them are dropped so
 * the model never sees an unanswered or broken exchange. Trimmed to the last
 * `CHAT_LIMITS.maxHistoryTurns`, always starting with a user turn.
 */
export function buildHistory(messages: ChatMessage[]): ChatTurn[] {
	const turns: ChatTurn[] = []
	for (let i = 0; i < messages.length; i++) {
		const message = messages[i]
		if (message.role !== 'user') continue
		const next = messages[i + 1]
		if (isUsableAnswer(next)) {
			turns.push({ role: 'user', content: message.content })
			turns.push({ role: 'assistant', content: next.content })
			i++
		} else if (i === messages.length - 1) {
			turns.push({ role: 'user', content: message.content })
		}
	}
	const trimmed = turns.slice(-CHAT_LIMITS.maxHistoryTurns)
	while (trimmed.length > 0 && trimmed[0].role !== 'user') trimmed.shift()
	return trimmed
}

// ---------------------------------------------------------------------------
// Thunks

export type ChatThunk<R = void> = ThunkAction<R, RootState, unknown, UnknownAction>

const controllers = new Map<string, AbortController>()

function isAbortError(error: unknown): boolean {
	return error instanceof Error && error.name === 'AbortError'
}

/** POSTs the current history and streams the reply into a new assistant message. */
function streamReply(): ChatThunk<Promise<void>> {
	return async (dispatch, getState) => {
		const messages = getState().chat.messages
		const request: ChatRequest = { messages: buildHistory(messages) }
		const { payload } = dispatch(assistantStarted())
		const id = payload.id
		const controller = new AbortController()
		controllers.set(id, controller)

		try {
			let response: Response
			try {
				response = await fetch(CHAT_ENDPOINT, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
					body: JSON.stringify(request),
					signal: controller.signal,
				})
			} catch (error) {
				if (controller.signal.aborted || isAbortError(error)) return
				dispatch(streamFailed({ id, code: 'upstream_error', message: NETWORK_ERROR_MESSAGE }))
				return
			}

			for await (const event of readChatStream(response, controller.signal)) {
				switch (event.type) {
					case 'delta':
						dispatch(deltaReceived({ id, text: event.text }))
						break
					case 'meta':
						dispatch(metaReceived({ id, meta: event.meta }))
						break
					case 'done':
						dispatch(streamCompleted({ id }))
						break
					case 'error':
						dispatch(streamFailed({ id, code: event.code, message: event.message }))
						break
				}
			}
		} catch (error) {
			if (!controller.signal.aborted && !isAbortError(error)) {
				dispatch(streamFailed({ id, code: 'upstream_error', message: NETWORK_ERROR_MESSAGE }))
			}
		} finally {
			controllers.delete(id)
			// Safety net: never leave a message stuck in `streaming`.
			if (controller.signal.aborted) dispatch(streamStopped({ id }))
		}
	}
}

export type SendResult = 'sent' | 'empty' | 'too_long' | 'busy'

/**
 * Sends a user message and streams the answer. Ignored while another reply is
 * streaming. Text is trimmed and must be 1..CHAT_LIMITS.maxInputChars chars.
 */
export function sendMessage(text: string): ChatThunk<Promise<SendResult>> {
	return async (dispatch, getState) => {
		const content = text.trim()
		if (content === '') return 'empty'
		if (content.length > CHAT_LIMITS.maxInputChars) return 'too_long'
		if (getState().chat.pendingId !== null) return 'busy'
		dispatch(userMessageAdded(content))
		await dispatch(streamReply())
		return 'sent'
	}
}

/** Aborts the in-flight reply and keeps whatever text already arrived. */
export function stopGeneration(): ChatThunk {
	return (dispatch, getState) => {
		const id = getState().chat.pendingId
		if (id === null) return
		controllers.get(id)?.abort()
		controllers.delete(id)
		dispatch(streamStopped({ id }))
	}
}

/** Re-asks the last question after its answer failed or was stopped. */
export function retryLast(): ChatThunk<Promise<void>> {
	return async (dispatch, getState) => {
		const { messages, pendingId } = getState().chat
		if (pendingId !== null) return
		const last = messages.at(-1)
		const question = messages.at(-2)
		if (last?.role !== 'assistant' || question?.role !== 'user') return
		if (last.status !== 'error' && last.status !== 'stopped') return
		dispatch(messageRemoved({ id: last.id }))
		await dispatch(streamReply())
	}
}

/** Stops any in-flight reply and empties the conversation. */
export function clearConversation(): ChatThunk {
	return (dispatch) => {
		dispatch(stopGeneration())
		dispatch(conversationCleared())
	}
}

// ---------------------------------------------------------------------------
// Selectors

export const selectChat = (state: RootState) => state.chat
export const selectMessages = (state: RootState) => state.chat.messages
export const selectIsOpen = (state: RootState) => state.chat.isOpen
export const selectPendingId = (state: RootState) => state.chat.pendingId
export const selectIsStreaming = (state: RootState) => state.chat.pendingId !== null
export const selectHasUnread = (state: RootState) => state.chat.hasUnread
/** True when the last message is a failed or stopped answer that can be retried. */
export const selectCanRetry = (state: RootState) => {
	const last = state.chat.messages.at(-1)
	return (
		state.chat.pendingId === null &&
		last?.role === 'assistant' &&
		(last.status === 'error' || last.status === 'stopped')
	)
}
