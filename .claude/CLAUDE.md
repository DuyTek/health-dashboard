# Health Insight Dashboard — Claude instructions

Take-home for a Frontend Developer technical test: a responsive React + TypeScript
health dashboard for a fictional persona, with a floating AI assistant backed by
Gemini (`gemini-flash-latest`) through Google ADK for TypeScript (`@google/adk`).

Read [doc/CONVENTIONS.md](./doc/CONVENTIONS.md) before writing code.

## Stack

- Vite + React 19 + TypeScript (strict), Redux Toolkit
- Tailwind v4 + shadcn/ui (Radix primitives, `radix-nova` style). Charts are the
  shadcn `chart` component over Recharts v3.
- Assistant backend: `api/chat.ts` (Vercel Node function) → `server/*` (ADK
  `LlmAgent`), streaming Server-Sent Events. Locally the same handler runs in
  `server/dev-server.ts`, and Vite proxies `/api` to it.
- Tests: Vitest + React Testing Library + msw. The LLM is always mocked in tests.

## Commands

| Command                     | What it does                                             |
| --------------------------- | -------------------------------------------------------- |
| `npm run dev`               | Vite (5173) + API dev server (3001) together             |
| `npm run check`             | typecheck + lint + format check + tests — must pass      |
| `npm test`                  | Vitest once                                              |
| `npm run build`             | Production build                                         |
| `npx shadcn@latest add <c>` | Add a shadcn component (don't hand-edit `components/ui`) |

## Layout

```
api/            Vercel function entry points (thin; delegate to server/)
server/         ADK agent, prompt, tools, SSE streaming, dev server (server-only)
src/types/      Shared contracts (health data, chat wire format) — isomorphic
src/data/       Fictional persona + seeded dataset — isomorphic
src/lib/health/ Pure summary/insight logic — isomorphic
src/store/      Redux store and slices
src/features/   dashboard/ and assistant/ feature folders
src/config/constants/  User-facing copy
```

The isomorphic folders, `server/` and `api/` use **relative imports with explicit `.js`**
(no `@/`), because Vercel runs functions as unbundled ESM (enforced by
`server/imports.test.ts`). `src/` UI code uses `@/`.

## Submission docs: keep them current (mandatory)

The repo root holds the submission documents the reviewers read (brief §5):

| File                       | Covers                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------- |
| `README.md`                | Overview, live URL, architecture, feature list, links to the others                   |
| `KEY_PRODUCT_DECISIONS.md` | What the dashboard shows and why, prioritization, UX states                           |
| `LLM_APPROACH.md`          | Data → prompt, prompt structure, conversation context, validation, anti-hallucination |
| `SETUP_INSTRUCTIONS.md`    | Prerequisites, install, run, test, deploy, **environment variables table**            |

**Rule: every change to the technical behaviour or source code must update
the affected docs in the same commit.** Before you commit, ask:

1. Did behaviour, architecture, a command, a dependency or an env var change?
   Update README / SETUP_INSTRUCTIONS.
2. Did what the user sees, or why, change? Update KEY_PRODUCT_DECISIONS.
3. Did the prompt, the data given to the model, tools, streaming, parsing or
   error handling change? Update LLM_APPROACH.
4. Every doc you touch keeps its **Tradeoffs**, **Limitations** and
   **Assumptions** sections accurate. Add new ones you introduced and delete the
   ones that no longer hold. Don't leave a doc describing code that no longer
   exists.

A change is **done** only when `npm run check` passes **and** the docs reflect
it. Tested code plus updated documents is the bar.

## Security

- Never commit, log, echo or paste API keys. `GEMINI_API_KEY` lives only in a
  local `.env` (git-ignored) and the hosting provider's env settings.
  `.env.example` documents variables with empty values.
- The key is server-only: never import `server/` from `src/`, and never use a
  `VITE_` prefix for secrets.
- Don't deploy, push, or send project content to external services unless the
  user asks.
