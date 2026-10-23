# LLM & Prompt Approach

> Owned by `feat/assistant-agent`. Keep in sync with the code (see `.claude/CLAUDE.md`).

## Provider & framework

Gemini `gemini-flash-latest` (free tier) via Google ADK for TypeScript (`@google/adk`), running server-side only.

## How health data reaches the model

_TBD_

## Prompt structure

_TBD_

## Conversation context

_TBD_

## Response format & rendering (streaming)

_TBD_

## Preventing invented information

_TBD_

## Handling unexpected or invalid responses

_TBD_

## Assumptions

_TBD_

## Limitations

_TBD_

## Tradeoffs

_TBD_

## Client-side rendering & states

_Owned by feat/assistant-ui: `src/lib/sse.ts`, `src/store/chatSlice.ts`,
`src/features/assistant/`._

**Reading the stream.** `readChatStream()` reads the `fetch` body with a
`TextDecoder` (streaming mode, so multi-byte characters split across chunks are
safe), normalises CRLF, splits frames on blank lines, joins multi-line `data:`
fields and ignores comments and other fields. Each payload is JSON-parsed and
validated against the `ChatStreamEvent` union; malformed or unknown frames are
skipped rather than shown. The reader always ends with exactly one terminal
event: a non-2xx or non-`text/event-stream` response becomes an `error` (using the
JSON body's `code`/`message` when present, otherwise mapped from the status: 429 →
`rate_limited`, 408/504 → `timeout`, other 4xx → `invalid_request`, 5xx →
`upstream_error`), and a stream that breaks or ends without `done`/`error` yields a
synthetic `upstream_error`. Only a user abort throws.

**Conversation context.** The client keeps the conversation in Redux and sends
the history with every request, built by `buildHistory()`: only question/answer
pairs whose answer completed (or was stopped with some text), plus the new
question, trimmed to `CHAT_LIMITS.maxHistoryTurns` and always starting with a user
turn. Failed or empty answers, and the questions behind them, are left out so the
model never sees a broken exchange. Input is trimmed and capped at
`CHAT_LIMITS.maxInputChars` before sending; one request runs at a time.

**Rendering.** Deltas are appended to the streaming message and rendered with
`react-markdown` + `remark-gfm` with `skipHtml` (no raw HTML from the model) and
react-markdown's default URL sanitising. Elements get light Tailwind styles
instead of the typography plugin; model headings are demoted below the panel
title. `meta.citedMetrics` shows as "Based on:" badges (metric keys mapped to
readable labels, de-duplicated) and `meta.followUps` as chips on the latest
answer only.

**States.**

| State               | What the user sees                                                                      |
| ------------------- | --------------------------------------------------------------------------------------- |
| Empty               | One-line intro + five suggested-question chips                                          |
| Waiting             | Bouncing dots + "Thinking…" until the first token                                       |
| Streaming           | Text grows with a caret; Send becomes Stop; launcher pulses                             |
| Done                | Markdown answer, "Based on" badges, follow-up chips                                     |
| Stopped             | Partial text kept, "Stopped" label, Retry                                               |
| Error               | Inline alert with friendly copy per `ChatErrorCode` (not the raw server text) and Retry |
| `done` with no text | Treated as `empty_response` so the user can retry                                       |

Retry removes the failed answer and re-asks the same question with the same
history. Network failures (fetch rejects) map to `upstream_error`.

### Assumptions (client)

- The server follows `src/types/chat.ts`: one `data: <JSON>` line per frame, frames
  separated by a blank line, with `meta` (if any) arriving before `done`. Error
  responses sent before streaming starts may be JSON with `code`/`message`
  (top-level or under `error`); anything else is mapped from the HTTP status.
- `/api/chat` is same-origin (Vite proxies it locally).

### Limitations (client)

- History lives in memory only: a refresh or Clear loses the conversation.
- The stream is not resumed after a dropped connection; the user retries instead.
- Long answers are re-parsed as markdown on every delta. That is fine at
  chat-answer sizes but not optimised for very long outputs.

### Tradeoffs (client)

- A custom responsive panel instead of the shadcn `Sheet`: the Sheet is modal
  with an overlay, while a non-modal desktop card lets the user read the
  dashboard while asking about it. On phones the panel goes full-screen.
- The composer stays editable while a reply streams (only sending is blocked),
  so the user can draft the next question.
- Friendly per-code copy hides the server's raw error text: it is clearer for
  users, but less detailed for debugging (the raw message is still kept in the
  Redux state).
- `remark-gfm` was added (small) so tables and strikethrough in answers render.
