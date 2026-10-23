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

**Dashboard** (`src/features/dashboard`), built for Daniel, a 38-year-old desk
worker with elevated blood pressure who started a walking routine six weeks ago:

- **Today at a glance:** steps, last night's sleep, resting HR, weight and BP,
  each compared with his 7-day average and coloured by whether the change is good
  for that metric.
- **What to focus on:** deterministic, rule-based insights (warnings first),
  such as short sleep, low protein, steps up 39%, BP and resting HR trending
  down, and late bedtimes costing sleep.
- **Goals:** progress from baseline toward six targets, with achieved / on-track /
  needs-attention status.
- **Trends:** a 7/30/90-day toggle across Activity, Sleep (stacked stages),
  Heart (RHR, HRV, BP), Weight and Nutrition, with goal reference lines. 90-day
  bars are aggregated weekly.
- **Recent activities** with 7-day totals.
- Skeleton loading, error with retry, empty states per chart and list,
  mobile-first layout, and accessible chart captions.
- Data comes from a deterministic seeded 90-day dataset (`src/data`). The pure
  summary and insight logic (`src/lib/health`) is shared with the AI assistant.

See [KEY_PRODUCT_DECISIONS.md](./KEY_PRODUCT_DECISIONS.md) for the reasoning.

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
