# Conventions

Code-style and component-authoring conventions for the Health Insight Dashboard.
Complements [../CLAUDE.md](../CLAUDE.md) (project overview, doc-update rule).

## Worktrees and branching

- **Always check HEAD**: other agents may be working at the same time, so always check the current HEAD and branch (`git status`, `git worktree list`) before starting autonomous work.
- **Use prefixes for branch names**:
  - `fix/*`: bugs, lints, build errors.
  - `feat/*`: new features.
  - `refactor/*`: refactors of existing modules, components or functions.
  - `docs/*`: documentation-only changes.
  - For breaking changes, add an exclamation mark after the prefix, e.g. `feat!/…`, `fix!/…`.
- **Open PRs with templates**: follow [PULL REQUEST TEMPLATES](~/.github/PULL_REQUEST_TEMPLATE/) when a remote exists.
- **Use atomic commits**: group related changes, commit as you go, and describe each one in as much detail as possible. Docs updates go in the same commit as the code they describe.

## Formatting & linting

- Prettier (`.prettierrc.json`) uses **tabs** (`useTabs: true`, `tabWidth: 1`), no semicolons, single quotes, and `printWidth: 100`.
- Lint is **oxlint** (`.oxlintrc.json`), run with `--deny-warnings`, so warnings fail.
- `npm run check` runs typecheck, lint, format check and tests, and must pass before every commit.
- `src/components/ui/` is shadcn-generated: excluded from lint/format, and not hand-edited. Wrap or compose instead.

## TypeScript conventions

- Strict mode is on. Avoid `any` (lint error). Prefer `unknown` + narrowing.
- Functional components with explicit prop interfaces (`interface FooProps`).
- Use `PropsWithChildren` for wrapper components.
- Shared shapes live in `src/types/` (`health.ts`, `chat.ts`). Don't redefine them locally.

## Naming

- PascalCase for components. Filename matches the default export (`GoalsCard.tsx`).
- camelCase for hooks (`useHealthSummary.ts`), utilities and slices (`chatSlice.ts`).
- Tests sit next to the code: `Foo.test.tsx` / `foo.test.ts`.

## File organization

- One folder per feature under `src/features/` (`dashboard`, `assistant`).
- Redux: one slice per domain in `src/store/` (`healthSlice`, `chatSlice`). Use the typed hooks `useAppDispatch` / `useAppSelector` from `@/store`.
- Pure logic (math, parsing, prompt building) lives outside components so it can be unit-tested.
- `api/` holds Vercel function entry points **only**. Vercel deploys every file there as a public function, tests included, so handler tests live in `server/`.

## Content/copy

User-facing text lives in `src/config/constants/`. New copy follows this pattern instead of being inlined in components.

## Imports

- `src/` UI code uses the `@/` alias (`@/components/ui/card`).
- `server/`, `api/`, and the isomorphic modules the server imports (`src/types`, `src/data`, `src/lib/health`) use **relative imports with an explicit `.js` extension** (`'../src/data/index.js'`). Vercel compiles functions to ESM per file without bundling, and Node's ESM loader does not add extensions. `server/imports.test.ts` enforces this.
- Never import `server/` from `src/`.

## UI states

Every data-driven view handles **loading** (skeleton), **error** (alert + retry where sensible) and **empty** states. Charts include an accessible label or summary.

## Testing

- Vitest + React Testing Library. Use `renderWithStore` from `src/test/render.tsx` for components that need Redux.
- Mock the network: stub `fetch` with the SSE helpers in `src/test/sse.ts`. Never call the real LLM in tests.
- Test behavior (what the user sees), not implementation details.
