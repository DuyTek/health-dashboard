Server-side code for the AI assistant (Google ADK + Gemini). Runs as the
Vercel function `api/chat.ts` in production and via `server/dev-server.ts`
locally. Never import this folder from `src/` — it holds the API key path.

Imports from `src/` must be **relative** (`../src/...`), not `@/` aliases,
so they resolve at runtime without a bundler or path-alias config.

The same applies to the isomorphic modules the server imports
(`src/types`, `src/data`, `src/lib/health`): relative imports only.

Runtime relative imports also carry an explicit **`.js` extension**
(`import { streamChat } from './chat.js'`, resolving to `chat.ts`). The package
is `"type": "module"` and `@vercel/node` compiles each file to ESM without
bundling, and Node's ESM loader does not add extensions. TypeScript, Vite,
Vitest and tsx all map `.js` to the `.ts` source. Type-only imports are erased,
so they are unaffected, but use `.js` there too for consistency.

| File            | Purpose                                                        |
| --------------- | -------------------------------------------------------------- |
| `prompt.ts`     | System instruction (summary JSON, rules, `<meta>` protocol)    |
| `tools.ts`      | Data tools (pure handlers + ADK `FunctionTool` wrappers)       |
| `agent.ts`      | `createHealthAgent()` → `LlmAgent`                             |
| `runner.ts`     | One ADK run: fresh session, history replay, SSE streaming      |
| `chat.ts`       | `streamChat()`: validation, timeout, events → wire contract    |
| `meta.ts`       | Streaming `<meta>` splitter and validator                      |
| `errors.ts`     | Error classification, user-safe messages, key redaction        |
| `sse.ts`        | SSE framing and response piping                                |
| `handler.ts`    | HTTP handler shared by `api/chat.ts` and the dev server        |
| `http.ts`       | `node:http` server used by `dev-server.ts`                     |
| `metrics.ts`    | Runtime metric/activity key lists, units, metric readers       |
| `__fixtures__/` | Deterministic test data (tests never call the real Gemini API) |
