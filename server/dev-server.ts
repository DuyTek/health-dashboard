import { getServerConfig } from './config.js'
import { createChatServer } from './http.js'

// `npm run dev:api` (tsx watch, loads .env). Never prints the API key.

const { port, apiKey, model } = getServerConfig()

if (!apiKey) {
	console.warn(
		'[api] GEMINI_API_KEY is not set. The dashboard works, but the assistant will answer with a configuration error. Copy .env.example to .env and add a key from https://aistudio.google.com/apikey',
	)
}

const server = createChatServer()

server.on('error', (error: NodeJS.ErrnoException) => {
	if (error.code === 'EADDRINUSE') {
		console.error(
			`[api] Port ${port} is already in use. Stop the other process or set API_PORT in .env (and update the Vite proxy).`,
		)
		process.exit(1)
	}
	throw error
})

server.listen(port, () => {
	console.log(`[api] Assistant API on http://localhost:${port}/api/chat (model: ${model})`)
})
