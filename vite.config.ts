import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: { '@': path.resolve(import.meta.dirname, './src') },
	},
	server: {
		// /api is served by server/dev-server.ts locally (Vercel function in production)
		proxy: { '/api': 'http://localhost:3001' },
	},
})
