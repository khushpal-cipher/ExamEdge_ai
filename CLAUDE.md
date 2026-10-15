# ExamEdge AI — Repository Instructions

Multi-tenant AI learning platform for coaching institutes. Start with `docs/PROJECT_MASTER_PLAN.md`; status in `PROGRESS.md`.

## Rules
- Implement only the approved phase scope in `docs/IMPLEMENTATION_ROADMAP.md`; follow the quality gate in `docs/TEST_STRATEGY.md` §6.
- Record evidence (command, result, date, commit) in `PROGRESS.md`. A test that did not run is BLOCKED, never passed.
- Never weaken, skip or delete a failing security/isolation test to get a green build.
- Tenant isolation lives in the database: every exposed table has RLS; children use composite FKs `(institute_id, parent_id)`.
- Never trust `institute_id` from the browser; derive it from the host on the server.
- No Supabase secret key in web or worker runtime. Worker sets tenant context only with `set_config('app.institute_id', id, true)` inside a transaction — never session-level `SET`.
- Only `packages/core/ai` may import AI provider SDKs (gateway: quota, metering, tenant assertion).
- No PII or prompt text in logs. Never print or commit secrets; `.env.example` holds names only.
- Mark unverified provider facts `[U]` in docs and verify them before depending on them.
- Prefer the smallest change; no new dependency for a few lines; no new vendor without a DECISIONS.md entry.

## Session handoff
- Keep `PROGRESS.md` current: done (with evidence), unverified, failing, blocked, and the next exact action.
- When the founder types "give me a prompt": update PROGRESS.md with a precise handoff, commit and push the
  phase branch, then reply with the "Prompt to paste" box from `docs/NEXT_SESSION_PROMPT.md` (update it first if
  anything changed) so a new context window can continue.

## Commands
- Once per clone: `npm ci && git config core.hooksPath .githooks` (gitleaks pre-commit hook).
- Local stack: `supabase start` (Docker must run) · `npm run db:reset` re-applies migrations + `supabase/seed.sql`.
- Dev: `npm run dev` (web, http://localhost:3000) · `npm run dev:worker` (needs `WORKER_DATABASE_URL`, see `.env.example`).
- Full gate (TEST_STRATEGY §6): `npm run check` = format:check, lint (+ forbidden patterns), typecheck, unit,
  `test:db` (pgTAP), `test:int`, build (+ bundle secret scan), `test:e2e` (Playwright).
- Secrets scan: `npm run secrets`.
