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

| Variable         | Required                | Default               | Where          | Description                                                                             |
| ---------------- | ----------------------- | --------------------- | -------------- | --------------------------------------------------------------------------------------- |
| `GEMINI_API_KEY` | Yes (for the assistant) | —                     | Server only    | Google AI Studio key used by the ADK agent. Never expose it to the client or commit it. |
| `GEMINI_MODEL`   | No                      | `gemini-flash-latest` | Server only    | Gemini model id used by the agent.                                                      |
| `API_PORT`       | No                      | `3001`                | Local dev only | Port for `server/dev-server.ts`. Vite proxies `/api` to it.                             |

`.env` is git-ignored. `.env.example` lists every variable with an empty or default value.

## Scripts

| Script          | Description                          |
| --------------- | ------------------------------------ |
| `npm run dev`   | Vite + local API server              |
| `npm run check` | Typecheck, lint, format check, tests |
| `npm test`      | Run the test suite once              |
| `npm run build` | Production build to `dist/`          |

## Testing

_TBD: what is covered, and how the LLM is mocked._

## Deployment (Vercel)

_TBD: added at deployment time._

## Troubleshooting

_TBD_
