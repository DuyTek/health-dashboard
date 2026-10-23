// Server-side configuration. Read lazily so tests can stub process.env.
export const DEFAULT_MODEL = 'gemini-flash-latest'

export function getServerConfig() {
	return {
		apiKey: process.env.GEMINI_API_KEY ?? '',
		model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
		port: Number(process.env.API_PORT) || 3001,
	}
}
