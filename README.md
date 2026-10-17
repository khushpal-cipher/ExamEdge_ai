# ExamEdge AI

Multi-tenant AI learning platform for coaching institutes: each institute gets its own branded space (notes, AI tutor
with citations, tests with ranks, study material), isolated in the database. Plan and status: [docs/PROJECT_MASTER_PLAN.md](docs/PROJECT_MASTER_PLAN.md),
[PROGRESS.md](PROGRESS.md). Operations: [docs/RUNBOOKS.md](docs/RUNBOOKS.md).

## How to run the demo

Everything runs on your Mac in **demo mode**: the AI is a deterministic fake (no API keys, no cost) that uses the same
code paths, metering and limits as the real providers.

Needs: Node 22.12+, Docker Desktop, Supabase CLI (`brew install supabase/tap/supabase`).

```bash
npm ci && git config core.hooksPath .githooks
supabase start
npm run db:reset && npm run seed:demo
```

Create `apps/web/.env.local` (gitignored) with the local values from `supabase status -o env`:

```text
NEXT_PUBLIC_SUPABASE_URL=<API_URL>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<PUBLISHABLE_KEY>
DEMO_LOGIN_ENABLED=true
```

Then `npm run dev` and open **http://demo.localhost:3000**. Type a demo email (or any new email: a local account is created for it) and press **Sign in as demo user**
(works only against a local Supabase; it can never be switched on in production).

| Who | Email | Try |
|---|---|---|
| Institute owner | `owner@demo.test` | Dashboard, people, batches, AI usage, rank lists, CSV export |
| Institute admin | `admin@demo.test` | Same as owner, except changing owners/admins |
| Teachers | `teacher1@demo.test` … `teacher3@demo.test` | Upload notes, publish, question bank, tests, check written answers, release results, Studio |
| Students | `student01@demo.test` … `student50@demo.test` | Subjects, AI tutor, practice quiz, flashcards, tests, My progress |
| Second institute | same names `@rival.test` at **http://rival.localhost:3000** | Proves isolation: nothing of Demo Classes is visible |
| Platform admin | `platform@examedge.test` at **http://admin.localhost:3000** | Institutes, limits, AI switch, library. First sign-in asks you to set up an authenticator app (TOTP). |

Uploaded notes are processed by the worker: `npm run dev:worker` (needs `WORKER_DATABASE_URL`,
`WORKER_STORAGE_EMAIL`, `WORKER_STORAGE_PASSWORD` — names in `.env.example`; local values in `scripts/local-supabase.ts`).
The seed already processed its own notes.

## Checks

```bash
npm run check
```

Runs format, lint (+ forbidden patterns), typecheck, unit, pgTAP (`supabase test db`), integration, production build
(+ bundle secret scan) and Playwright E2E. Port 3000 must be free (E2E starts the production server there).

Backup and restore rehearsal (local): `npm run backup`, then `npm run restore-drill -- backups/<time>`
(needs `brew install postgresql@17`).

## Real AI providers

Not switched on yet (no keys). What is ready, what is missing and the exact steps: [docs/RUNBOOKS.md §5](docs/RUNBOOKS.md#5-switching-from-fake-ai-to-real-ai).
