// @vitest-environment node
import { BaseLlm, type BaseLlmConnection, type LlmRequest, type LlmResponse } from '@google/adk'
import { describe, expect, it } from 'vitest'
import type { ChatStreamEvent } from '../src/types/chat.js'
import { fixtureData, fixtureSummary } from './__fixtures__/health.js'
import { AGENT_NAME } from './agent.js'
import { streamChat } from './chat.js'
import { runHealthAgent } from './runner.js'

// Runs the real ADK Runner/LlmAgent/FunctionTool stack against a scripted fake
// model (no network), to verify history replay, tool calls and SSE partials.

class ScriptedLlm extends BaseLlm {
	readonly requests: LlmRequest[] = []
	readonly streamFlags: boolean[] = []

	constructor(private readonly script: LlmResponse[][]) {
		super({ model: 'scripted-model' })
	}

	async *generateContentAsync(
		llmRequest: LlmRequest,
		stream?: boolean,
	): AsyncGenerator<LlmResponse, void> {
		// Snapshot: ADK keeps mutating the request object between calls.
		this.requests.push(structuredClone({ ...llmRequest, toolsDict: {} }))
		this.streamFlags.push(stream === true)
		const responses = this.script[this.requests.length - 1] ?? []
		for (const response of responses) yield response
	}

	connect(): Promise<BaseLlmConnection> {
		return Promise.reject(new Error('live mode not supported'))
	}
}

const META = '<meta>{"citedMetrics":["goals"],"followUps":["How is my sleep?"]}</meta>'

function script(): LlmResponse[][] {
	return [
		// Call 1: the model asks for a tool.
		[
			{
				content: {
					role: 'model',
					parts: [{ functionCall: { id: 'call-1', name: 'get_goals', args: {} } }],
				},
			},
		],
		// Call 2: streamed answer (partials) then the aggregated final response.
		[
			{ partial: true, content: { role: 'model', parts: [{ text: 'You hit your ' }] } },
			{ partial: true, content: { role: 'model', parts: [{ text: `steps goal.\n${META}` }] } },
			{
				partial: false,
				finishReason: 'STOP' as LlmResponse['finishReason'],
				content: { role: 'model', parts: [{ text: `You hit your steps goal.\n${META}` }] },
			},
		],
	]
}

const history = [
	{ role: 'user' as const, content: 'Hi there' },
	{ role: 'assistant' as const, content: 'Hello Alex!' },
]

describe('runHealthAgent (real ADK, scripted model)', () => {
	it('replays history, runs tools and streams partial events', async () => {
		const llm = new ScriptedLlm(script())
		const events: unknown[] = []
		for await (const event of runHealthAgent({
			apiKey: 'unused',
			model: 'unused',
			data: fixtureData,
			summary: fixtureSummary,
			history,
			message: 'Did I reach my goals?',
			signal: new AbortController().signal,
			llm,
		})) {
			events.push(event)
		}

		// SSE mode was requested from the model.
		expect(llm.streamFlags).toEqual([true, true])

		// History replayed as user/model contents, before the new message.
		const first = llm.requests[0]
		const texts = first.contents.map((c) => [c.role, c.parts?.[0]?.text])
		expect(texts).toEqual([
			['user', 'Hi there'],
			['model', 'Hello Alex!'],
			['user', 'Did I reach my goals?'],
		])

		// System instruction carries the summary verbatim (no template mangling).
		const system = JSON.stringify(first.config?.systemInstruction)
		expect(system).toContain('<health_summary>')
		expect(system).toContain('Alex Rivera')
		expect(system).toContain('\\"citedMetrics\\"')

		// Tools are declared to the model.
		const declared = JSON.stringify(first.config?.tools)
		expect(declared).toContain('get_metric_history')
		expect(declared).toContain('get_goals')

		// The tool ran and its result was sent back on the second call.
		const second = JSON.stringify(llm.requests[1].contents)
		expect(second).toContain('functionResponse')
		expect(second).toContain('g-steps')

		// Partial events surface with partial=true, then a non-partial final.
		const shaped = events.map((e) => {
			const ev = e as { partial?: boolean; author?: string; content?: { parts?: unknown[] } }
			return { partial: ev.partial === true, author: ev.author }
		})
		expect(shaped.filter((e) => e.partial)).toHaveLength(2)
		expect(shaped.every((e) => e.author === AGENT_NAME)).toBe(true)
	})

	it('produces the wire events end-to-end through streamChat', async () => {
		const llm = new ScriptedLlm(script())
		const out: ChatStreamEvent[] = []
		for await (const event of streamChat(
			{ messages: [...history, { role: 'user', content: 'Did I reach my goals?' }] },
			{
				config: { apiKey: 'unused', model: 'unused' },
				loadHealth: () => ({ data: fixtureData, summary: fixtureSummary }),
				runAgent: (input) => runHealthAgent({ ...input, llm }),
				log: () => {},
			},
		)) {
			out.push(event)
		}
		const text = out.map((e) => (e.type === 'delta' ? e.text : '')).join('')
		expect(text).toBe('You hit your steps goal.\n')
		expect(out.at(-2)).toEqual({
			type: 'meta',
			meta: { citedMetrics: ['goals'], followUps: ['How is my sleep?'] },
		})
		expect(out.at(-1)).toEqual({ type: 'done' })
	})
})
