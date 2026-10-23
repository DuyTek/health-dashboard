import {
	createEvent,
	createRunConfig,
	Gemini,
	InMemorySessionService,
	Runner,
	StreamingMode,
	type BaseLlm,
} from '@google/adk'
import type { ChatTurn } from '../src/types/chat.js'
import type { HealthData, HealthSummary } from '../src/types/health.js'
import { AGENT_NAME, createHealthAgent } from './agent.js'

// Runs one assistant turn through Google ADK. Stateless per request: a fresh
// in-memory session is created, the prior turns sent by the client are
// replayed into it as session events, then the new user message is run with
// SSE streaming so partial text events arrive as the model generates them.

const APP_NAME = 'health-insight'
const USER_ID = 'demo-user'
/** Upper bound on model calls per turn (tool round-trips included). */
const MAX_LLM_CALLS = 6

export interface AgentRunInput {
	apiKey: string
	model: string
	data: HealthData
	summary: HealthSummary
	/** Earlier turns, oldest first. The new message is not included. */
	history: ChatTurn[]
	message: string
	signal: AbortSignal
	/** Test seam: replaces the Gemini model (never call the real API in tests). */
	llm?: BaseLlm
}

/** Yields raw ADK events; `streamChat` interprets them. */
export type AgentRunner = (input: AgentRunInput) => AsyncIterable<unknown>

export const runHealthAgent: AgentRunner = async function* (input) {
	const model = input.llm ?? new Gemini({ model: input.model, apiKey: input.apiKey })
	const agent = createHealthAgent({ model, summary: input.summary, data: input.data })
	const sessionService = new InMemorySessionService()
	const runner = new Runner({ appName: APP_NAME, agent, sessionService })
	const session = await sessionService.createSession({ appName: APP_NAME, userId: USER_ID })

	// Replay history. ADK builds the model's `contents` from session events:
	// author 'user' -> role user, author === agent name -> role model.
	for (const [index, turn] of input.history.entries()) {
		const isUser = turn.role === 'user'
		await sessionService.appendEvent({
			session,
			event: createEvent({
				invocationId: `history-${Math.floor(index / 2)}`,
				author: isUser ? 'user' : AGENT_NAME,
				content: { role: isUser ? 'user' : 'model', parts: [{ text: turn.content }] },
			}),
		})
	}

	yield* runner.runAsync({
		userId: USER_ID,
		sessionId: session.id,
		newMessage: { role: 'user', parts: [{ text: input.message }] },
		runConfig: createRunConfig({ streamingMode: StreamingMode.SSE, maxLlmCalls: MAX_LLM_CALLS }),
		abortSignal: input.signal,
	})
}
