import { LlmAgent, type BaseLlm } from '@google/adk'
import type { HealthData, HealthSummary } from '../src/types/health.js'
import type { ThinkingLevelSetting } from './config.js'
import { buildSystemInstruction } from './prompt.js'
import { createHealthTools } from './tools.js'

export const AGENT_NAME = 'health_assistant'

/** Conservative sampling: factual, grounded answers over creative ones. */
export const GENERATION_CONFIG = {
	temperature: 0.3,
	topP: 0.9,
	// Includes any "thinking" tokens on thinking models, so keep headroom.
	maxOutputTokens: 2048,
} as const

export interface HealthAgentOptions {
	/** A model id (resolved by ADK's registry) or a model instance (e.g. `Gemini`). */
	model: string | BaseLlm
	summary: HealthSummary
	data: HealthData
	/** Reasoning depth for thinking models; `null`/omitted uses the model default. */
	thinkingLevel?: ThinkingLevelSetting | null
}

type GenerateContentConfig = NonNullable<
	ConstructorParameters<typeof LlmAgent>[0]['generateContentConfig']
>
type ThinkingLevel = NonNullable<
	NonNullable<GenerateContentConfig['thinkingConfig']>['thinkingLevel']
>

export function createHealthAgent({
	model,
	summary,
	data,
	thinkingLevel,
}: HealthAgentOptions): LlmAgent {
	const instruction = buildSystemInstruction(summary)
	return new LlmAgent({
		name: AGENT_NAME,
		description: "Answers questions about the user's tracked health data.",
		model,
		// A provider function, not a string: ADK treats string instructions as
		// templates and would try to substitute `{...}` from session state, which
		// would mangle the JSON summary embedded in the prompt.
		instruction: () => instruction,
		tools: createHealthTools({ data, summary }),
		generateContentConfig: {
			...GENERATION_CONFIG,
			// The SDK enum's values are these same strings.
			...(thinkingLevel ? { thinkingConfig: { thinkingLevel: thinkingLevel as ThinkingLevel } } : {}),
		},
	})
}
