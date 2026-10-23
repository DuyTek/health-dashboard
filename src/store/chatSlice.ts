import { createSlice } from '@reduxjs/toolkit'
import type { ChatMessage } from '@/types/chat'

// STUB (Phase 0). Owned by feat/assistant-ui.
export interface ChatState {
	messages: ChatMessage[]
}

const initialState: ChatState = { messages: [] }

const chatSlice = createSlice({
	name: 'chat',
	initialState,
	reducers: {},
})

export default chatSlice.reducer
