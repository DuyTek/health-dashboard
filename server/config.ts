// Server-side configuration. Read lazily so tests can stub process.env.
export const DEFAULT_MODEL = 'gemini-flash-latest'

export const THINKING_LEVELS = ['MINIMAL', 'LOW', 'MEDIUM', 'HIGH'] as const
export type ThinkingLevelSetting = (typeof THINKING_LEVELS)[number]

/**
 * Default reasoning depth. Measured against gemini-flash-latest (Oct 2026):
 * the model's own default took 10–18 s to first token; LOW took 4–10 s with
 * equally grounded answers. MINIMAL is rejected (400) by that model.
 */
export const DEFAULT_THINKING_LEVEL: ThinkingLevelSetting = 'LOW'

/**
 * `GEMINI_THINKING_LEVEL`: one of THINKING_LEVELS, or `default` to omit the
 * setting and use the model's own default (useful if the alias moves to a
 * model that rejects the configured level). Unknown values fall back to LOW.
 */
export function parseThinkingLevel(raw: string | undefined): ThinkingLevelSetting | null {
	const value = raw?.trim().toUpperCase()
	if (!value) return DEFAULT_THINKING_LEVEL
	if (value === 'DEFAULT') return null
	return (THINKING_LEVELS as readonly string[]).includes(value)
		? (value as ThinkingLevelSetting)
		: DEFAULT_THINKING_LEVEL
}

export function getServerConfig() {
	return {
		apiKey: process.env.GEMINI_API_KEY ?? '',
		model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
		thinkingLevel: parseThinkingLevel(process.env.GEMINI_THINKING_LEVEL),
		port: Number(process.env.API_PORT) || 3001,
	}
}
