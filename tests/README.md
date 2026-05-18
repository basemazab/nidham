# Tests

Five layers covering what matters most. Each is opt-in so you only pay
the cost of the layer you care about right now.

| Layer            | Tool       | Where it lives             | How to run                 |
| ---------------- | ---------- | -------------------------- | -------------------------- |
| **Unit**         | Vitest     | `src/lib/*.test.ts`        | `npm run test:unit`        |
| **Integration**  | Vitest     | `tests/integration/`       | `npm run test:integration` |
| **E2E**          | Playwright | `tests/e2e/`               | `npm run test:e2e`         |
| **Load**         | k6         | `tests/load/`              | `k6 run tests/load/*.js`   |
| **UAT** (manual) | Markdown   | `tests/uat/`               | see [`uat/README.md`](./uat/README.md) |

`npm test` runs unit + integration together (~1 second on a warm cache).
Everything else is opt-in because it's slow or needs extra setup. UAT is
manual business-validation — see `tests/uat/UAT_PLAN.md`.

## Unit (`src/lib/*.test.ts`)

Pure-function tests, co-located next to the code they test:

- `src/lib/attendance.test.ts` — `workedHours`, `perMinuteWage`, formatters
- `src/lib/payroll.test.ts` — Egyptian tax brackets, social insurance, full `calculatePayroll()` scenarios
- `src/lib/format.test.ts` — currency + date formatters

These run in <100ms each because they touch nothing but in-memory data.
Add a test when:

- you fix a bug in pure logic (write the failing test first)
- you ship a new exported helper from `src/lib/`
- a refactor changes the shape of an exported helper

## Integration (`tests/integration/`)

Server actions exercised end-to-end against a hand-rolled in-memory
Supabase mock. The mock is a thenable PostgrestFilterBuilder lookalike
that records every `.from()/.insert()/.update()/.eq()` so the tests can
assert the action sent the right rows.

- `tests/integration/employees-actions.test.ts` — `createEmployee`, `updateEmployee`

Add a test when:

- you ship a new server action that mutates business data
- a refactor changes the FormData parser (the `asText` / `asNumber` pair)
- a bug report points to data getting silently dropped (e.g. empty
  strings reaching the DB instead of `NULL`)

The mock is intentionally minimal — extend it in-place when a new action
needs `.gt()`, `.in()`, etc. Don't try to be exhaustive.

## E2E (`tests/e2e/`)

Real browser, real Next.js dev server, no mocks. Slower (~3-5 min on CI)
but exercises everything the user sees.

- `tests/e2e/landing.spec.ts` — public landing page renders
- `tests/e2e/login.spec.ts` — login form + HTML5 validation
- `tests/e2e/protected-routes.spec.ts` — `/dashboard/*` redirects anonymous visitors to `/login`

The dev server is started/stopped by Playwright's `webServer` config — you
don't need to run `npm run dev` separately. Point at a deployed env with
`PLAYWRIGHT_BASE_URL`:

```bash
PLAYWRIGHT_BASE_URL=https://nidham.app npm run test:e2e
```

First run:

```bash
npx playwright install --with-deps chromium  # one-time download
```

## Load (`tests/load/`)

k6 HTTP load tests. See [`tests/load/README.md`](./load/README.md) for
the install + run instructions. These do NOT run in CI — they hit a real
deployed environment and need coordinated execution.

## Coverage

```bash
npm run test:coverage
```

Output goes to `coverage/` (text + HTML report at `coverage/index.html`).
Coverage is targeted at `src/lib/**/*.ts` only; pages + UI components are
exercised by Playwright.

## CI

Every push/PR runs the full suite in `.github/workflows/test.yml`:

1. **unit-integration** (Vitest)
2. **typecheck** (`tsc --noEmit`)
3. **e2e** (Playwright against the prod build)

Load tests run manually — not in CI.
