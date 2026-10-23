# Health Insight Dashboard

A responsive health and wellness dashboard for a fictional user, with a floating AI
assistant that answers questions grounded in the user's own data.

- **Live demo:** _TBD — added after deployment_
- **Stack:** React 19 · TypeScript · Redux Toolkit · Vite · Tailwind v4 · shadcn/ui (Radix) · Recharts (shadcn charts) · Google ADK (TypeScript) · Gemini `gemini-flash-latest`

## Documentation

| Doc                                                    | What's inside                                              |
| ------------------------------------------------------ | ---------------------------------------------------------- |
| [SETUP_INSTRUCTIONS.md](./SETUP_INSTRUCTIONS.md)       | Install, run, test, deploy, **environment variables**      |
| [KEY_PRODUCT_DECISIONS.md](./KEY_PRODUCT_DECISIONS.md) | What the dashboard shows, why, and what was left out       |
| [LLM_APPROACH.md](./LLM_APPROACH.md)                   | Prompt design, grounding, conversation context, validation |

## Features

<!-- dashboard: owned by feat/health-data-dashboard -->

_Dashboard — TBD_

<!-- assistant: owned by feat/assistant-ui -->

_AI assistant — TBD_

## Architecture

```
Browser (Vite SPA)                         Server (Vercel Node function)
┌──────────────────────────────┐           ┌──────────────────────────────────┐
│ React + Redux Toolkit        │  POST     │ api/chat.ts                       │
│  healthSlice ← src/data      │ /api/chat │  └ server/: ADK LlmAgent          │
│  chatSlice  ← SSE reader     │ ────────► │      system prompt = persona +    │
│ shadcn/ui + Recharts         │ ◄──────── │      HealthSummary (src/lib)      │
│ Floating assistant           │  SSE      │      tools → query src/data       │
└──────────────────────────────┘  stream   │      Gemini (gemini-flash-latest) │
                                           └──────────────────────────────────┘
```

- **Shared, isomorphic core:** `src/types` (contracts), `src/data` (seeded dataset),
  and `src/lib/health` (pure summary/insight logic) are used by both the UI and the
  agent. The dashboard and the assistant always see the same numbers.
- **API key stays server-side.** The browser only ever talks to `/api/chat`.
- **Streaming:** `/api/chat` responds with Server-Sent Events (`src/types/chat.ts`
  defines the wire format), so tokens render as they arrive.

```
api/            Vercel function entry points
server/         ADK agent, prompt, tools, streaming, local dev server
src/types/      Shared contracts
src/data/       Fictional persona + seeded 90-day dataset
src/lib/health/ Summary, trends, goal progress, insights (pure)
src/store/      Redux store + slices
src/features/   dashboard/, assistant/
```

## Assumptions

- The brief mentions a provided persona and dataset, but none was attached. This
  repo uses a **fictional persona with a deterministic, seeded 90-day dataset**.
  See KEY_PRODUCT_DECISIONS.md.
- Single user, no authentication. Data is static (no device sync).

## Limitations

- Not medical advice. The assistant is instructed not to diagnose.
- Free-tier Gemini quotas apply, and rate-limit errors are shown to the user.

## Tradeoffs

- Vite SPA plus one serverless function instead of a full-stack framework: the
  UI is client-rendered anyway, and this keeps the backend to one small surface.
