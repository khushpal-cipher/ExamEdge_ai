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
Phase 1 (local parts). Done so far:
- `supabase/config.toml` edited: `auto_expose_new_tables=false` (explicit GRANTs required), realtime/studio/mailpit/analytics/edge/s3/vector disabled (disk), site_url `http://demo.localhost:3000`, redirect `http://*.localhost:3000/**`, TOTP MFA enabled, Google provider block present but `enabled=false` (BLOCKED: no OAuth client).
- `supabase/migrations/20261015000001_init.sql`: pgvector + citext in `extensions`, `private` schema (revoked from anon/authenticated), `worker` role (NOLOGIN, NOBYPASSRLS), `private.worker_heartbeats`.
- `supabase/tests/000_smoke.sql` (passes). `supabase/seed.sql` empty.
- Root `package.json` (workspaces + scripts: lint, typecheck, test, test:int, test:db, test:e2e, secrets, seed:demo, check), `tsconfig.base.json`, `tsconfig.scripts.json`, `.gitignore`.
- `apps/web/package.json`, `apps/worker/{package.json,tsconfig.json}`, `packages/core/{package.json,tsconfig.json}` (core exports `./*` → `./src/*.ts`).
- Installed: next 16.4.1, react 19.3.1, @supabase/supabase-js 2.117.3, @supabase/ssr 0.12.7, zod 4.6.7 (web); pg 8.23.1, pg-boss 12.38.0 (worker); dev: typescript 6.0.3 (NOT 7 — typescript-eslint needs <6.1), eslint 9.39.5 (NOT 10 — eslint-plugin-react peer), typescript-eslint 8.71.2, eslint-config-next 16.4.1, prettier 3.9.10, vitest 5.0.4, @playwright/test 1.64.1, tsx 4.23.15, @types/node 24.

Not done yet in Phase 1 (do these next, in order):
1. `apps/web`: tsconfig.json, next.config.ts, `app/layout.tsx`, `app/page.tsx`, `app/api/health/route.ts` (200 + commit SHA). **Next 16 notes:** read `node_modules/next/dist/docs/` before writing Next code (AGENTS.md says APIs changed); `middleware.ts` is now **`proxy.ts`** exporting `proxy()` (Node runtime default); not using `cacheComponents`.
2. `apps/worker/src/index.ts`: pg-boss start + heartbeat job writing `private.worker_heartbeats` (verify pg-boss 12 API/schema permissions from its README in node_modules first).
3. `packages/core/src/log.ts`: JSON logger with request_id and PII scrubbing (Sentry BLOCKED: no account — add a DECISIONS entry).
4. `eslint.config.mjs`, `.prettierrc.json`/`.prettierignore`, `vitest.config.ts` (projects `unit` and `integration`), `playwright.config.ts` + `e2e/health.spec.ts`, `scripts/check-forbidden.mjs` (bans session `SET`/`set_config(...,false)` in worker, provider SDK imports outside `packages/core/src/ai`, `dangerouslySetInnerHTML`).
5. `.githooks/pre-commit` running gitleaks (`git config core.hooksPath .githooks`), prove AC1.3 locally with a fake secret.
6. `.github/workflows/ci.yml` (actions pinned by SHA; runs on GitHub now that the remote exists), `.env.example` (names only).
7. Run the gate: `npm run format:check && npm run lint && npm run typecheck && npm test && npm run test:db && npm run build && npm run test:e2e`; record results; commit; merge to main.

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
Docker Desktop 29.8.2 installed (2026-10-15). Start a Claude Code session in `examedge_ai/` with the prompt in `docs/NEXT_SESSION_PROMPT.md` (Phase 1, Tasks 1–2 first).

## Relevant files and commands
- Plan entry point: `docs/PROJECT_MASTER_PLAN.md`
- Roadmap and acceptance criteria: `docs/IMPLEMENTATION_ROADMAP.md`
- Commands: `supabase start` / `supabase status` / `supabase test db`; scripts in root `package.json`.
- Local Supabase: API http://127.0.0.1:54321, DB postgresql://postgres:postgres@127.0.0.1:54322/postgres (local defaults; keys via `supabase status -o env`, never commit them).
- Tools installed by Claude: Docker Desktop 4.95.0 (`brew install --cask docker-desktop`), Supabase CLI 2.121.0 and gitleaks 8.30.1 (`brew install supabase/tap/supabase gitleaks`).

## Known regressions
- None.
