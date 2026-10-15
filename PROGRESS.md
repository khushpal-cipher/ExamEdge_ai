# ExamEdge AI — Progress

Last updated: 2026-10-15

## Current phase
**Phase 1 (Foundations) IN PROGRESS** on git branch `phase-1-foundations`. Started 2026-10-15.
GitHub remote: `origin` = https://github.com/khushpal-cipher/ExamEdge_ai (**PUBLIC**, founder's explicit choice on 2026-10-15). Founder asked to connect and push; push phase branches and `main` after each green phase. Never commit secrets (repo is public). Deployments and other cloud accounts still need founder approval.

## Completed (with evidence)
| Date | Item | Evidence |
|---|---|---|
| 2026-10-14 | Repository investigation | `examedge_ai/` was empty. It sits inside the `startup` git repo (remote `khushpal-cipher/startup_idea`, private), whose `.gitignore` ignores everything except `vulnops-validation/` → files here are **not tracked**. No CLAUDE.md, manifests or env files existed. Tools present: node 24.11, npm 11.6, bun 1.4, python 3.14, uv 0.12, psql 16, gh 2.100, git 2.54; **missing:** docker, supabase CLI, vercel CLI, pnpm, ffmpeg, manim. macOS 27, arm64. |
| 2026-10-14 | Provider verification | Prices/limits checked on official pages (see docs/COST_MODEL.md §1, §9). Unverified items marked [U]. |
| 2026-10-14 | Planning docs created | `docs/*.md` (11 files), `PROGRESS.md`, `CLAUDE.md` |
| 2026-10-14 | Self-review | 21 issues found and resolved in docs (docs/DECISIONS.md review log) |
| 2026-10-14 | Brief + shareable summary | `docs/ORIGINAL_BRIEF.md`, `docs/PLAN_EXPLAINED_SIMPLY.md`, `docs/share/examedge-plan.html` (published privately at https://claude.ai/artifact/YNm1NLbCweGBQhvBMRW7Qd), source images in `docs/assets/` |
| 2026-10-15 | Founder decisions | Theory answers checked manually by teachers; two ranks (test rank, overall rank by average percentage); student progress page; build Release 1 in demo mode with fake AI (no keys yet). Recorded in ADR-016, Q-05, HOW_IT_WORKS.md |
| 2026-10-15 | Build prompt | `docs/NEXT_SESSION_PROMPT.md` |
| 2026-10-15 | Docker + tools installed | Docker Desktop 4.95.0 (engine 29.8.2) via `brew install --cask docker-desktop`; Supabase CLI 2.121.0 + gitleaks 8.30.1 via `brew install supabase/tap/supabase gitleaks` |
| 2026-10-15 | Phase 1 partial: git init, workspaces, local Supabase | `git init -b main`, branch `phase-1-foundations`; npm workspaces installed (versions below); `supabase start` OK; `supabase test db` → `000_smoke.sql .. ok`, Files=1, Tests=4, PASS |
| 2026-10-14 | Consistency check | All relative links resolve; every ADR, Q, test (T-*) and gate (G1–G8) ID referenced is defined; no secret-like strings in files |

## In progress
Phase 1 (local parts). Session 3 (2026-10-15) state — see "Session log" at the bottom for detail.

Done and committed:
- `883fece` Web skeleton: `apps/web/{tsconfig.json,next.config.ts,app/layout.tsx,app/page.tsx,app/api/health/route.ts}`. `npm run build` passed (Next 16.4.1, Turbopack). `/api/health` → `{status:'ok', commit}` with `cache-control: no-store`.

Done but only partly verified (committed at the end of session 3 as "WIP, unverified"):
- `supabase/migrations/20261015000002_pgboss.sql`: `grant worker to postgres`; schema `pgboss` owned by `worker`; revoked from public/anon/authenticated. Applied with `supabase db reset` — OK.
- `supabase/seed.sql`: `alter role worker with login password 'worker_local_only'` (LOCAL ONLY). `WORKER_DATABASE_URL=postgresql://worker:worker_local_only@127.0.0.1:54322/postgres`. Login verified with psql.
- `apps/worker/src/index.ts`: pg-boss 12 (`new PgBoss({connectionString, schema:'pgboss', createSchema:false})`), queue `heartbeat`, cron `* * * * *`, writes `private.worker_heartbeats`. Ran it: heartbeat row written (count=1). Graceful SIGINT/SIGTERM.
- `packages/core/src/log.ts` (+ `log.test.ts`): JSON logger, drops sensitive keys, masks emails. Unit test written, **not run yet**.
- `@examedge/core` added as dependency of web and worker (`npm install` done).
- `eslint.config.mjs` (typescript-eslint recommended + eslint-config-next core-web-vitals for apps/web), `.prettierrc.json` (singleQuote, printWidth 120), `.prettierignore` (md/docs ignored), `vitest.config.ts` (projects `unit` = `*.test.ts`, `integration` = `*.int.test.ts`), `playwright.config.ts` (webServer `npm run start`, baseURL localhost:3000), `e2e/health.spec.ts`.
- `scripts/check-forbidden.ts` (+ test): bans session `SET`/`set_config(...,false)` in worker/core, provider SDK imports outside `packages/core/src/ai/`, `dangerouslySetInnerHTML` in web, secret-key names in runtime. `npm run lint` = eslint + this script → **PASSED** (after `prettier --write .`).
- `scripts/check-bundle.ts`: T-SEC-11 scan of `apps/web/.next/static`; root `build` script = `next build` + this scan. Not run yet.
- `.githooks/pre-commit` (gitleaks `git --pre-commit --staged`); `git config core.hooksPath .githooks` set locally (each clone must run it).
- `.env.example` (names only). `.github/workflows/ci.yml` (actions pinned by SHA: checkout v7.0.1, setup-node v7.1.0, supabase/setup-cli v3.0.1 with CLI 2.121.0, gitleaks-action v3.0.0). Never run on GitHub yet.
- Playwright Chromium downloaded (`npx playwright install chromium`).

Open design point found (resolve at the start of Phase 2): RLS policies run as the caller, so helper functions in schema `private` need `grant usage on schema private to authenticated` (+ `grant execute` on each helper only, and `revoke execute on functions from public`). `private` stays out of the exposed API schemas, and its tables get no grants. This contradicts `supabase/tests/000_smoke.sql` (asserts authenticated has no usage on `private`). Plan: change that test to assert the real property (private not exposed + no table privileges for anon/authenticated) and record an ADR in docs/DECISIONS.md. Also check what `auto_expose_new_tables=false` in `supabase/config.toml` does to default grants (`select * from pg_default_acl`).

Phase 1 remaining steps (in order):
1. Run the full gate: `npm run format:check && npm run lint && npm run typecheck && npm test && npm run test:db && npm run build && npm run test:e2e` (`test:int` has no tests yet — vitest may exit non-zero on "no test files"; if so add `passWithNoTests` to the integration project only). Fix failures.
2. Prove AC1.3 locally: stage a fake secret (e.g. a fake AWS key in a temp file), `git commit` must be blocked by the hook; then remove it. Record evidence.
3. Add DECISIONS.md entries: Sentry BLOCKED (no account) → JSON logger only for now; staging deploy BLOCKED (needs Vercel/Railway/Supabase cloud accounts = founder approval); `private` schema usage grant (above).
4. Update CLAUDE.md "## Commands" with the real commands.
5. Commit, `git push origin phase-1-foundations`, open PR into `main`, check CI (`gh pr checks`), fix until green, merge. AC1.4/AC1.5/AC1.6 (staging, Sentry, CI migrations to staging) stay BLOCKED until the founder approves accounts.
6. Then Phase 2 (identity, tenancy, isolation) per docs/IMPLEMENTATION_ROADMAP.md and docs/NEXT_SESSION_PROMPT.md order.

Design decisions already worked out for later phases (record as ADRs when built):
- Web enqueues no jobs directly: it writes domain rows (e.g. `document_versions.processing_status='queued'`); the worker polls a SECURITY DEFINER `private.pending_jobs()` every ~5 s and sends pg-boss jobs with singleton keys (also acts as the sweeper).
- Worker reads Storage files as a dedicated non-privileged Supabase Auth user ("worker service account"); storage policy lets it read only objects whose version is `queued|processing`. No secret key in worker.
- Worker DB role `worker` gets a local-only password in `supabase/seed.sql`; production password set by ops.
- Invitation emails BLOCKED (no Resend account): admin sees the invite link once after creating it.
- Demo login allowed only when `DEMO_LOGIN_ENABLED=true` AND the Supabase URL host is 127.0.0.1/localhost (unit-tested).
- Excel export = CSV; charts = inline SVG; mind map = nested tree (no extra deps).

## Blocked
| Item | Blocked on |
|---|---|
| Embedding real institute documents (Phase 4) | Q-08 Voyage data-use terms |
| Pilot launch (Phase 10) | Q-01 legal opinion on minors' data |

## Failed checks
- None run yet (no code).

## Unresolved decisions
See docs/RISKS_AND_OPEN_QUESTIONS.md §1 (Q-05 resolved). Plan approved for building on 2026-10-15; Q-01 (legal) and Q-08 (Voyage terms) still open.

## Next exact action
Start a new Claude Code session in `examedge_ai/` and paste the prompt in `docs/NEXT_SESSION_PROMPT.md` ("Prompt to paste" box at the top).
That session continues Phase 1 at "Phase 1 remaining steps", step 1 (run the full gate), on branch `phase-1-foundations`.

## Relevant files and commands
- Plan entry point: `docs/PROJECT_MASTER_PLAN.md`
- Roadmap and acceptance criteria: `docs/IMPLEMENTATION_ROADMAP.md`
- Commands: `supabase start` / `supabase status` / `supabase test db`; scripts in root `package.json`.
- Local Supabase: API http://127.0.0.1:54321, DB postgresql://postgres:postgres@127.0.0.1:54322/postgres (local defaults; keys via `supabase status -o env`, never commit them).
- Playwright Chromium (session 3, `npx playwright install chromium`, chromium-1243/headless-shell-1248 in ~/Library/Caches/ms-playwright).
- Tools installed by Claude: Docker Desktop 4.95.0 (`brew install --cask docker-desktop`), Supabase CLI 2.121.0 and gitleaks 8.30.1 (`brew install supabase/tap/supabase gitleaks`).

## Known regressions
- None.

## Session log
| Session | Date | Summary | Last commit |
|---|---|---|---|
| 1–2 | 2026-10-14/15 | Planning docs, founder decisions, tools, git init, workspaces, local Supabase init + pgTAP smoke | `5d26fc7` |
| 3 | 2026-10-15 | Phase 1: web skeleton (build OK), pg-boss schema + worker heartbeat (ran OK), logger, lint/format/test configs, forbidden-pattern check (lint OK), bundle scan, gitleaks hook, CI workflow, .env.example. Full gate NOT yet run; nothing pushed before the WIP commit. | see `git log` |
