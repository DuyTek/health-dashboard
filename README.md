# Health Insight Dashboard

A responsive health and wellness dashboard for a fictional user, with a floating AI
assistant that answers questions grounded in the user's own data.

- **Live demo:** _TBD — added after deployment_
- **Stack:** React 19 · TypeScript · Redux Toolkit · Vite · Tailwind v4 · shadcn/ui (Radix) · Recharts (shadcn charts) · Google ADK (TypeScript) · Gemini `gemini-flash-latest`

## Documentation

| Doc                                                    | What's inside                                                        |
| ------------------------------------------------------ | -------------------------------------------------------------------- |
| [SETUP_INSTRUCTIONS.md](./SETUP_INSTRUCTIONS.md)       | Install, run, test, deploy, **environment variables**                |
| [KEY_PRODUCT_DECISIONS.md](./KEY_PRODUCT_DECISIONS.md) | Who the user is, what the dashboard shows and why, what was left out |
| [LLM_APPROACH.md](./LLM_APPROACH.md)                   | Data → prompt, prompt structure, context, validation, anti-invention |

## Quick start

```bash
npm install
cp .env.example .env   # then set GEMINI_API_KEY (only the assistant needs it)
npm run dev            # http://localhost:5173 (API on :3001, proxied at /api)
npm run check          # typecheck + lint + format check + tests
```

Node.js 22+ is required. See [SETUP_INSTRUCTIONS.md](./SETUP_INSTRUCTIONS.md) for
details, every environment variable and troubleshooting.

## Features

The user is **Daniel**, a 38-year-old desk worker with elevated blood pressure who
started a walking routine six weeks ago (fictional persona, seeded 90-day dataset).

### Dashboard (`src/features/dashboard`)

- **Today at a glance:** steps, last night's sleep, resting HR, weight and BP, each
  compared with his 7-day average and colored by whether the change is good for
  that metric.
- **What to focus on:** deterministic, rule-based insights, warnings first: short
  sleep, low protein, steps up 39%, BP and resting HR trending down, late bedtimes
  costing sleep, and more.
- **Goals:** progress from baseline toward six targets, with Achieved / On track /
  Needs attention status.
- **Trends:** a 7/30/90-day toggle across Activity, Sleep (stacked stages), Heart
  (RHR, HRV, BP), Weight and Nutrition, with goal reference lines. At 90 days, bars
  are aggregated weekly.
- **Recent activities** with 7-day totals.
- Skeleton loading, error with retry, empty states per chart and list, mobile-first
  layout and accessible chart captions.

### AI assistant (`src/features/assistant`)

- **Floating launcher** in the bottom-right corner (respects safe-area insets). It
  pulses while a reply streams and shows a dot when a reply finished while the panel
  was closed.
- **Responsive panel:** full-screen on phones; a non-modal 400×600 card on larger
  screens, so the dashboard stays visible while you chat.
- **Empty state** with five suggested questions ("How am I progressing?", "What
  should I focus on?", …) as one-click chips.
- **Streaming answers** rendered as markdown (raw HTML is never rendered), with a
  typing indicator before the first token and a caret while text arrives.
- **Grounding cues:** each answer lists the metrics it relied on ("Based on: steps,
  sleep") and offers up to three follow-up questions.
- **States:** Stop (partial text is kept), friendly inline errors per error type
  with Retry, Clear conversation, and a 1,000-character limit with a counter.
- **Keyboard and a11y:** Enter sends, Shift+Enter adds a newline, Escape closes and
  returns focus to the launcher; the message list is an `aria-live` log.

## Architecture

```
Browser (Vite SPA)                         Server (Vercel Node function)
┌──────────────────────────────┐           ┌───────────────────────────────────┐
│ React + Redux Toolkit        │  POST     │ api/chat.ts                       │
│  healthSlice ← src/data      │ /api/chat │  └ server/: ADK LlmAgent          │
│  chatSlice  ← SSE reader     │ ────────► │      system prompt = persona +    │
│ shadcn/ui + Recharts         │ ◄──────── │      HealthSummary (src/lib)      │
│ Floating assistant           │  SSE      │      tools → query src/data       │
└──────────────────────────────┘  stream   │      Gemini (gemini-flash-latest) │
                                           └───────────────────────────────────┘
```

- **Shared, isomorphic core:** `src/types` (contracts), `src/data` (persona and
  seeded dataset) and `src/lib/health` (pure summary and insight logic) are used by
  both the UI and the agent, so the dashboard and the assistant always see the same
  numbers.
- **The API key stays server-side.** The browser only talks to `/api/chat`.
- **Streaming:** `/api/chat` responds with Server-Sent Events, one JSON event per
  frame (`delta`, optional `meta`, then exactly one `done` or `error`; defined in
  `src/types/chat.ts`). Locally the same handler runs in `server/dev-server.ts`
  and Vite proxies `/api` to it.

```
api/                  Vercel function entry point (thin; delegates to server/)
server/               ADK agent, prompt, tools, SSE streaming, local dev server
src/types/            Shared contracts (health data, chat wire format)
src/data/             Fictional persona + seeded 90-day dataset
src/lib/health/       Summary, trends, goal progress, insights (pure)
src/lib/sse.ts        Client-side SSE reader for /api/chat
src/store/            Redux store + slices (healthSlice, chatSlice)
src/features/         dashboard/, assistant/
src/config/constants/ User-facing copy
```

## LLM approach in brief

Details and rationale: [LLM_APPROACH.md](./LLM_APPROACH.md).

- **Data to the model:** the system prompt embeds a compact JSON projection of the
  same `HealthSummary` the dashboard renders (averages, trends, goals, insights,
  recent workouts). Three read-only tools (`get_metric_history`, `get_activities`,
  `get_goals`) provide day-level detail on demand.
- **Prompt structure:** fixed sections (Role with the dataset's "today", the data
  in `<health_summary>` tags, Tools, Grounding rules, Style, Output protocol).
- **Conversation context:** stateless replay. The client sends the last 12 turns
  with each request; the server validates and trims them and replays them into a
  fresh ADK session.
- **Output:** a streamed markdown answer followed by one `<meta>{…}</meta>` line
  (cited metrics, follow-up questions), split out by a streaming parser.
- **Invalid or unexpected responses:** request validation, a 45 s timeout,
  quota/safety/key/empty-answer errors mapped to typed error events, and a tolerant
  `<meta>` parser. A broken meta block only loses the extras, never the answer.
- **No invented information:** only real, rounded numbers (with `null` for
  missing), explicit rules (never estimate, say when something is not tracked,
  cite metric and period), low temperature, and cited metrics filtered against
  known keys.
- **Safety:** no diagnosis, clinician referral for concerning readings, and user
  text treated as questions, never as rule changes.

## Testing

Vitest and React Testing Library cover the data generator, summary and insight
logic, Redux slices, dashboard and assistant UI states, the client SSE reader, and
the whole server path: prompt, tools, `<meta>` parser, error mapping, timeouts, SSE
framing, the Vercel handler, and the real ADK runner driven by a scripted model.
The LLM is always mocked; tests never call Gemini. Live behavior against
`gemini-flash-latest` was checked by hand and is recorded in
[LLM_APPROACH.md](./LLM_APPROACH.md#live-verification-manual-oct-2026).

## Assumptions

- The brief mentions a provided persona and dataset, but none was attached, so the
  repo uses a **fictional persona with a deterministic, seeded 90-day dataset**.
  "Today" is the dataset's fixed date (22 Oct 2026), not the wall clock.
- Single user, no authentication, English only. Data is static (no device sync).

More in [KEY_PRODUCT_DECISIONS.md](./KEY_PRODUCT_DECISIONS.md#assumptions) and
[LLM_APPROACH.md](./LLM_APPROACH.md#assumptions).

## Limitations

- Not medical advice. The assistant is instructed not to diagnose.
- Free-tier Gemini quotas apply; rate-limit errors are shown to the user.
- Assistant replies take several seconds (thinking model, plus cold starts on
  Vercel).
- Conversation history lives in memory only and is lost on refresh.
- Model behavior was verified manually, not by automated tests, and can drift as
  the `-latest` alias moves.

More in [KEY_PRODUCT_DECISIONS.md](./KEY_PRODUCT_DECISIONS.md#limitations) and
[LLM_APPROACH.md](./LLM_APPROACH.md#limitations).

## Tradeoffs

- **Vite SPA plus one serverless function** instead of a full-stack framework: the
  UI is client-rendered anyway, and this keeps the backend to one small surface.
- **Rule-based dashboard insights, LLM only in the assistant:** instant, free and
  testable insights; open-ended questions go to the assistant.
- **Summary in the prompt plus tools** instead of the full dataset: fewer tokens
  and a clearer signal, at the cost of an occasional extra round-trip.
- **Google ADK** instead of calling `@google/genai` directly: the tool loop,
  sessions and streaming come for free, but it is a large dependency.

More in [KEY_PRODUCT_DECISIONS.md](./KEY_PRODUCT_DECISIONS.md#tradeoffs) and
[LLM_APPROACH.md](./LLM_APPROACH.md#tradeoffs).
