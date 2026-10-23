# Setup Instructions

## Prerequisites

- Node.js **22+** and npm
- A Google AI Studio API key (free): https://aistudio.google.com/apikey

## Install & run locally

```bash
npm install
cp .env.example .env      # then set GEMINI_API_KEY
npm run dev               # web on http://localhost:5173, API on :3001 (proxied at /api)
```

The dashboard works without a key. Only the assistant needs `GEMINI_API_KEY`.

## Environment variables

| Variable                | Required                | Default               | Where          | Description                                                                                                      |
| ----------------------- | ----------------------- | --------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------- |
| `GEMINI_API_KEY`        | Yes (for the assistant) | —                     | Server only    | Google AI Studio key used by the ADK agent. Never expose it to the client or commit it.                          |
| `GEMINI_MODEL`          | No                      | `gemini-flash-latest` | Server only    | Gemini model id used by the agent.                                                                               |
| `GEMINI_THINKING_LEVEL` | No                      | `LOW`                 | Server only    | `MINIMAL`/`LOW`/`MEDIUM`/`HIGH`, or `default` to use the model's own setting. LOW keeps first-token latency low. |
| `API_PORT`              | No                      | `3001`                | Local dev only | Port for `server/dev-server.ts`. Vite proxies `/api` to it.                                                      |

`.env` is git-ignored. `.env.example` lists every variable with an empty or default value.

## Scripts

| Script          | Description                          |
| --------------- | ------------------------------------ |
| `npm run dev`   | Vite + local API server              |
| `npm run check` | Typecheck, lint, format check, tests |
| `npm test`      | Run the test suite once              |
| `npm run build` | Production build to `dist/`          |

## Testing

```bash
npm test          # all tests once
npm run check     # typecheck + lint + format check + tests
```

**Assistant server (`server/`, `api/`)** — tests run in the Node environment
(`// @vitest-environment node`) and **never call the real Gemini API**:

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
- `sse.test.ts`, `http.test.ts`, `api/chat.test.ts`: SSE framing, the dev HTTP
  server on an ephemeral port, and the Vercel handler with mocked req/res.

To try the assistant against the real model, set `GEMINI_API_KEY` in `.env` and
run `npm run dev`, or call the API directly:

```bash
curl -N -X POST http://localhost:3001/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"How am I progressing?"}]}'
```

## Deployment (Vercel)

_TBD: added at deployment time._

Already in place: `api/chat.ts` is a Node.js Vercel function (not Edge) that
streams SSE; its `export const config = { maxDuration: 60 }` gives headroom
over the 45 s model timeout. Set `GEMINI_API_KEY` (and optionally
`GEMINI_MODEL` / `GEMINI_THINKING_LEVEL`) in the Vercel project's environment variables.

## Troubleshooting

| Symptom                                                                                       | Fix                                                                                                                                       |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `[api] GEMINI_API_KEY is not set` at startup / assistant says it is not configured            | Copy `.env.example` to `.env`, add a key from https://aistudio.google.com/apikey, restart `npm run dev` (the dashboard works without it). |
| Assistant says it is "receiving too many requests" (`rate_limited`)                           | Free-tier quota (requests per minute/day) hit. Wait a minute, or use another key/project.                                                 |
| Assistant says it is not configured but a key is set                                          | The key was rejected (`API_KEY_INVALID`/403). Check it in AI Studio and that `.env` has no quotes or spaces.                              |
| `[api] Port 3001 is already in use`                                                           | Stop the other process, or set `API_PORT` and update the `/api` proxy target in `vite.config.ts` to match.                                |
| Chat requests fail with a proxy error in the browser console                                  | The API server isn't running. `npm run dev` starts both; `npm run dev:api` starts only the API.                                           |
| Answers stop mid-way with a timeout                                                           | The model took more than 45 s. Retry; if frequent, try a lighter `GEMINI_MODEL`.                                                          |
| Every question fails with `upstream_error` and the API log shows a 400 about "thinking level" | The model behind `GEMINI_MODEL` doesn't support the configured level. Set `GEMINI_THINKING_LEVEL=default` (or another level).             |
