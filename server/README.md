Server-side code for the AI assistant (Google ADK + Gemini). Runs as the
Vercel function `api/chat.ts` in production and via `server/dev-server.ts`
locally. Never import this folder from `src/` — it holds the API key path.

Imports from `src/` must be **relative** (`../src/...`), not `@/` aliases,
so the Vercel function bundler resolves them without extra config.

The same applies to the isomorphic modules the server imports
(`src/types`, `src/data`, `src/lib/health`): relative imports only.
