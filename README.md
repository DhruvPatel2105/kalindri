# Kalindri

Unofficial practice and AI-scoring platform for **PTE Core**. Not affiliated with or
endorsed by Pearson.

This repository currently contains the **scaffold only** — framework, tooling, and a single
placeholder page. No features, schema, or UI beyond `/` have been built yet. See
[`CLAUDE.md`](./CLAUDE.md) for the product rules and [`docs/`](./docs) for the full
specification set. Design mockups live in [`design/`](./design).

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Drizzle ORM ·
Supabase (Postgres / Auth / Storage) · Zod · Vitest + Testing Library

## Prerequisites

- **Node.js 20.x** (or ≥ 18.18). Check with `node -v`.
- **npm 10.x** (ships with Node 20).
- A **Supabase** project (free tier is fine) for the database and auth. Not required just
  to run the placeholder page or the tests — only for database work.

## Setup from a clean machine

```bash
# 1. Clone and enter the repo
git clone <repo-url> kalindri
cd kalindri

# 2. Install dependencies
npm install

# 3. Create your local env file and fill it in
cp .env.example .env.local
#   Edit .env.local — values come from your Supabase project's
#   Settings → Database (DATABASE_URL) and Settings → API (the rest).
#   Every variable is validated by Zod in lib/env.ts.

# 4. Start the dev server
npm run dev
#   → http://localhost:3000  renders "Kalindri"
```

## Everyday commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server at http://localhost:3000 |
| `npm run build` | Production build. Fails on any TypeScript or ESLint error |
| `npm start` | Serve the production build (run `npm run build` first) |
| `npm test` | Run the test suite once (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run typecheck` | `tsc --noEmit` — types only, no build |
| `npm run lint` | ESLint via `next lint` |
| `npm run db:generate` | Regenerate the SQL migration from `lib/db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations (needs `DATABASE_URL`) |
| `npm run db:seed` | Insert the launch organization (needs `DATABASE_URL`) |
| `npm run db:studio` | Open Drizzle Studio |

## Verifying the scaffold

Run these from the repo root; each should succeed with no errors:

```bash
npm run dev      # then open http://localhost:3000 — the page shows "Kalindri"
npm test         # schema + page tests, all passing
npm run build    # completes with "Compiled successfully" and no type errors
```

## Database (Drizzle)

The full schema lives in [`lib/db/schema.ts`](./lib/db/schema.ts) — 23 tables per
`docs/03-data-model.md`, with the initial migration checked in at
`drizzle/0000_*.sql`. No application queries exist yet.

```bash
# First-time setup against a fresh Supabase Postgres database:
cp .env.example .env.local              # then fill in DATABASE_URL
npm run db:migrate                      # create all 23 tables + enums
npm run db:seed                         # insert the single "Kalindri" organization

# After editing lib/db/schema.ts:
npm run db:generate                     # writes the next drizzle/NNNN_*.sql (works offline)
npm run db:migrate                      # applies it
```

`db:generate` reads only the schema and runs without a database. `db:migrate`,
`db:seed` and `db:studio` need a reachable `DATABASE_URL`; `db:seed` auto-loads
`.env.local`, the drizzle-kit commands read it from the shell environment
(`DATABASE_URL=... npm run db:migrate`).

`db:seed` is idempotent — re-running it will not create a second organization.

## Project layout

```
app/                 App Router — layout, placeholder page, colocated tests
components/ui/        shadcn/ui components land here (none yet)
lib/
  env.ts             Zod-validated environment boundary — the only place that reads process.env
  utils.ts           cn() helper for shadcn
  db/
    schema.ts        Full Drizzle schema — 23 tables, one questions table, org_id everywhere
    schema.test.ts   Asserts the schema matches docs/03-data-model.md
    index.ts         Lazy Drizzle client (server-only)
    seed.ts          Inserts the launch organization
  supabase/          Browser and server Supabase clients
drizzle/             Generated SQL migrations (checked in)
docs/                Product & scoring specification (do not edit casually)
design/              Static HTML mockups and Pearson reference screenshots
```

## Conventions

- No `any`; no unchecked non-null assertions (both enforced by ESLint).
- `strict` TypeScript, plus `noUncheckedIndexedAccess`.
- Zod validation at every boundary (env, and later: request bodies, LLM output).
- Mutations go through **Server Actions**, not API routes, unless streaming.
- Deterministic scorers (later) must have unit tests.
