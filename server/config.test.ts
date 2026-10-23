// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fixtureData, fixtureSummary } from './__fixtures__/health.js'
import { createHealthAgent, GENERATION_CONFIG } from './agent.js'
import { DEFAULT_MODEL, getServerConfig, parseThinkingLevel } from './config.js'

describe('parseThinkingLevel', () => {
	it('defaults to LOW when unset or blank', () => {
		expect(parseThinkingLevel(undefined)).toBe('LOW')
		expect(parseThinkingLevel('  ')).toBe('LOW')
	})

	it('accepts known levels case-insensitively', () => {
		expect(parseThinkingLevel('high')).toBe('HIGH')
		expect(parseThinkingLevel(' Medium ')).toBe('MEDIUM')
	})

	it('returns null for "default" so the model default is used', () => {
		expect(parseThinkingLevel('default')).toBeNull()
	})

	it('falls back to LOW for unknown values', () => {
		expect(parseThinkingLevel('turbo')).toBe('LOW')
	})
})

describe('getServerConfig', () => {
	afterEach(() => {
		vi.unstubAllEnvs()
	})

	it('reads model and thinking level from the environment', () => {
		vi.stubEnv('GEMINI_MODEL', '')
		vi.stubEnv('GEMINI_THINKING_LEVEL', 'medium')
		expect(getServerConfig()).toMatchObject({ model: DEFAULT_MODEL, thinkingLevel: 'MEDIUM' })
	})
})

describe('createHealthAgent thinking config', () => {
	const base = { model: 'gemini-test', summary: fixtureSummary, data: fixtureData }

	it('sets thinkingConfig when a level is given', () => {
		const agent = createHealthAgent({ ...base, thinkingLevel: 'LOW' })
		expect(agent.generateContentConfig).toMatchObject({
			...GENERATION_CONFIG,
			thinkingConfig: { thinkingLevel: 'LOW' },
		})
	})

	it('omits thinkingConfig when the level is null', () => {
		const agent = createHealthAgent({ ...base, thinkingLevel: null })
		expect(agent.generateContentConfig?.thinkingConfig).toBeUndefined()
	})
})
