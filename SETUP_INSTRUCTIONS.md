# Setup Instructions

## Prerequisites

- Node.js **22+** and npm
- A Google AI Studio API key (free): https://aistudio.google.com/apikey. Only the
  assistant needs it; the dashboard works without one.

## Install & run locally

```bash
npm install
cp .env.example .env      # then set GEMINI_API_KEY
npm run dev               # web on http://localhost:5173, API on :3001 (proxied at /api)
```

`npm run dev` starts Vite and the local API server (`server/dev-server.ts`, which
loads `.env`) together. Vite proxies `/api` to the API server.

## Environment variables

| Variable                | Required                | Default               | Where          | Description                                                                                                                               |
| ----------------------- | ----------------------- | --------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `GEMINI_API_KEY`        | Yes (for the assistant) | —                     | Server only    | Google AI Studio key used by the ADK agent. Never expose it to the client or commit it.                                                   |
| `GEMINI_MODEL`          | No                      | `gemini-flash-latest` | Server only    | Gemini model id used by the agent.                                                                                                        |
| `GEMINI_THINKING_LEVEL` | No                      | `LOW`                 | Server only    | `MINIMAL`/`LOW`/`MEDIUM`/`HIGH`, or `default` to use the model's own setting. Unknown values fall back to `LOW`, which keeps latency low. |
| `API_PORT`              | No                      | `3001`                | Local dev only | Port for `server/dev-server.ts`. The Vite proxy target in `vite.config.ts` is fixed to 3001, so change both together.                     |

`.env` is git-ignored. `.env.example` lists every variable with an empty or default
value. No variable uses the `VITE_` prefix, so none of them reach the browser
bundle.

## Scripts

| Script                 | Description                                                    |
| ---------------------- | -------------------------------------------------------------- |
| `npm run dev`          | Vite + local API server together                               |
| `npm run dev:web`      | Vite only                                                      |
| `npm run dev:api`      | Local API server only (`tsx watch`, loads `.env` if it exists) |
| `npm run build`        | Typecheck (`tsc -b`) and production build to `dist/`           |
| `npm run preview`      | Serve the production build (static only, no `/api`)            |
| `npm run typecheck`    | TypeScript project check                                       |
| `npm run lint`         | oxlint, warnings fail                                          |
| `npm run format`       | Prettier write                                                 |
| `npm run format:check` | Prettier check                                                 |
| `npm test`             | Run the test suite once                                        |
| `npm run test:watch`   | Vitest in watch mode                                           |
| `npm run check`        | Typecheck, lint, format check and tests (must pass)            |

## Testing

```bash
npm test          # all tests once
npm run check     # typecheck + lint + format check + tests
```

Tests use Vitest and React Testing Library and **never call the real Gemini
API**. UI tests stub `fetch` with in-memory SSE responses (`src/test/sse.ts`).

**Client (`src/`, jsdom):** data generator determinism, summary/series/insight
logic, Redux slices (including `buildHistory`), the SSE reader, and the dashboard
and assistant UI states (loading, error, empty, streaming, stop, retry).

**Assistant server (`server/`, `api/`, Node environment):**

- `prompt.test.ts`, `tools.test.ts`: system instruction contents (summary JSON,
  grounding/safety rules, `<meta>` protocol) and tool handlers (valid/invalid
  arguments) against the fixture in `server/__fixtures__/health.ts`.
- `meta.test.ts`: the streaming `<meta>` splitter (tags split at every
  position, lone `<`, missing/invalid/fenced/unterminated meta, > 3 follow-ups).
- `chat.test.ts`: `streamChat` driven by a fake event stream (event order, no
  duplicated text, validation, history trimming, missing key, 429/safety/key
  error mapping, timeout, empty response, client disconnect, key redaction in logs).
- `runner.test.ts`: the real ADK `Runner`/`LlmAgent`/`FunctionTool` stack with a
  scripted `BaseLlm` subclass in place of Gemini (history replay, tool
  round-trip, partial streaming, end-to-end wire events).
- `sse.test.ts`, `http.test.ts`, `api-chat.test.ts`: SSE framing, the dev HTTP
  server on an ephemeral port, and the Vercel handler with mocked req/res.
- `config.test.ts`: env parsing (model, thinking level) and the agent's thinking config.
- `imports.test.ts`: every runtime relative import in server-reachable code ends
  in `.js` (required by the Vercel ESM runtime).

To try the assistant against the real model, set `GEMINI_API_KEY` in `.env` and
run `npm run dev`, or call the API directly:

```bash
curl -N -X POST http://localhost:3001/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"How am I progressing?"}]}'
```

The results of a manual run against `gemini-flash-latest` are recorded in
[LLM_APPROACH.md](./LLM_APPROACH.md#live-verification-manual-oct-2026).

## Deployment (Vercel)

Live at **https://health-dashboard-ashy-eta.vercel.app/**. The Vercel project is
connected to the GitHub repo, so every push to `main` deploys to production.

The app is a static Vite build plus one Node.js function, and needs no
`vercel.json`:

1. Import the Git repository in the Vercel dashboard.
2. Framework preset: **Vite**. Build command: `npm run build`. Output directory:
   `dist`. Node.js version 22 or later.
3. In **Settings → Environment Variables**, set `GEMINI_API_KEY` (and optionally
   `GEMINI_MODEL` / `GEMINI_THINKING_LEVEL`). Enter the key there, never in the
   repository.
4. Deploy. Files in `api/` are detected automatically as Node.js functions, so
   `api/chat.ts` serves `POST /api/chat` on the same origin as the SPA.
5. After adding or changing an environment variable, redeploy. Running deployments
   don't pick up new values.

**Every file in `api/` becomes a public function**, test files included, so tests
for the handler live in `server/` (`server/api-chat.test.ts`). Keep `api/` to
entry points only.

`api/chat.ts` is a Node.js function (not Edge) that streams SSE. Its
`export const config = { maxDuration: 60 }` leaves headroom over the 45 s model
timeout. Server code uses relative imports with explicit `.js` extensions because
Vercel compiles functions to ESM per file without bundling (enforced by
`server/imports.test.ts`).

## Troubleshooting

| Symptom                                                                                       | Fix                                                                                                                                        |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `[api] GEMINI_API_KEY is not set` at startup / assistant says it is not configured            | Copy `.env.example` to `.env`, add a key from https://aistudio.google.com/apikey, restart `npm run dev` (the dashboard works without it).  |
| Assistant says the free AI quota is busy (`rate_limited`)                                     | Free-tier quota (requests per minute/day) hit. Wait a minute, or use another key/project.                                                  |
| Assistant says it is not configured but a key is set                                          | The key was rejected (`API_KEY_INVALID`/403). Check it in AI Studio and that `.env` has no quotes or spaces.                               |
| `[api] Port 3001 is already in use`                                                           | Stop the other process, or set `API_PORT` and update the `/api` proxy target in `vite.config.ts` to match.                                 |
| Chat requests fail with a proxy error in the browser console                                  | The API server isn't running. `npm run dev` starts both; `npm run dev:api` starts only the API.                                            |
| Answers stop mid-way with a timeout                                                           | The model took more than 45 s. Retry; if frequent, try a lighter `GEMINI_MODEL`.                                                           |
| Every question fails with `upstream_error` and the API log shows a 400 about "thinking level" | The model behind `GEMINI_MODEL` doesn't support the configured level. Set `GEMINI_THINKING_LEVEL=default` (or another level).              |
| Live site: assistant says it is not configured                                                | `GEMINI_API_KEY` is missing in Vercel → Settings → Environment Variables (Production), or the deployment predates it. Add it and redeploy. |
| `ERR_MODULE_NOT_FOUND` for a server file on Vercel                                            | A relative import in `api/`, `server/` or a shared `src/` module is missing its `.js` extension. `npm test` (`imports.test.ts`) flags it.  |
