# ExamEdge AI — Progress

Last updated: 2026-10-15

## Current phase
**Phase 1 MERGED** into `main` (PR #1, merge commit `913ec7f`, CI green: check + secrets, 2026-10-15).
**Phase 2 (Identity, tenancy, isolation) — local gate GREEN, PR not opened yet** on branch `phase-2-identity`.
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
### Phase 2 — identity, tenancy, isolation (session 4, 2026-10-15) — local gate PASSED
Branch `phase-2-identity` (contains Phase 1 via merge). Full gate `npm run check` exit 0 on 2026-10-15 after
`supabase db reset && npm run seed:demo`: Prettier ok; eslint + `check-forbidden: ok`; typecheck ok; unit 12 passed;
pgTAP Files=5 Tests=334 PASS; test:int (none) ok; build + `check-bundle: ok`; Playwright 6 passed. `npm run audit` → ok.

Built:
- `supabase/migrations/20261015000003_tenancy.sql`: exams, institutes, institute_domains, profiles (auto-created by trigger on
  auth.users), private.platform_admins, memberships, batches, batch_members, invitations, subjects, batch_subjects, chapters,
  audit_events, consent_records. Composite FKs, RLS + explicit column grants on every table, `revoke all` + default privileges
  for anon/authenticated (no TRUNCATE/TRIGGER). Definer helpers in `private` (allowlisted). RPCs (invoker wrappers in public →
  definer in private): `resolve_institute(host)`, `create_invitation(inst, email, role, batch)` (returns raw token once),
  `accept_invitation(token)`. Audit trigger on memberships/batch_members/invitations; owner-only guard for owner/admin changes;
  batch-role guard. ADR-019/020/021 explain the choices.
- pgTAP: `supabase/test_helpers.sql` (loaded as seed file; tests.setup() builds institutes alpha/bravo + outsider; tests.login/as_anon/
  logout/inst/uid/mid/affected). Tests: `000_smoke`, `010_policy_coverage` (T-ISO-05/AC2.1), `020_isolation_matrix` (T-ISO-02/AC2.2,
  generated from catalog; negative control with injected leaky policies was caught), `030_roles` (T-ISO-01, T-ISO-03, AC2.6, AC2.7,
  composite FKs, suspended institute), `040_invitations` (T-SEC-18, AC2.3, AC2.4). Report: `docs/reports/phase2-isolation-matrix.txt`
  (253 ok, 0 not ok).
- Web: `apps/web/proxy.ts` (session refresh only), `lib/supabase.ts`, `lib/tenant.ts` (host from x-forwarded-host/host → resolve_institute;
  ROOT_HOST default `localhost` shows landing; unknown host → 404), `app/actions.ts` (signInDemo, signOut, acceptInvite), `app/page.tsx`
  (institute home: sign-in / "not a member" / "Signed in as <role>"), `app/sign-in.tsx`, `app/invite/[token]/page.tsx`.
  `packages/core/src/demo.ts` (+test): DEMO_PASSWORD, demoLoginAllowed (DEMO_LOGIN_ENABLED=true AND local Supabase URL), safeNext.
- Scripts: `scripts/local-supabase.ts` (reads `supabase status -o env`, refuses non-local), `scripts/seed-demo.ts` (`npm run seed:demo`:
  Demo Classes demo.localhost + Rival Academy rival.localhost, owner/admin/3 teachers/50 students each, 2 batches, 4 subjects × 4 chapters,
  teacher1@demo.test also teaches at rival, platform@examedge.test platform admin; all password DEMO_PASSWORD), `scripts/create-institute.ts`
  (`npm run create-institute -- <slug> "<Name>" <owner-email>` prints one-time owner invite link), `scripts/check-audit.ts` (+test; dated
  exceptions; GHSA-vfj7-8cjw-p6xm braces dev-only excepted until 2027-01-15).
- E2E `e2e/isolation.spec.ts`: unknown host 404; demo student is "not a member" on rival (host-only cookies); raw REST with demo owner token
  reads 0 rival rows, forged insert/RPC → 42501; `private` schema not exposed; invite: wrong account rejected, right account joins once.
- CI: `DEMO_LOGIN_ENABLED: true` in job env; `npm run seed:demo` before e2e; `npm run audit` replaces `npm audit`.
- Local only (gitignored): `apps/web/.env.local` (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY from `supabase status -o env`,
  DEMO_LOGIN_ENABLED=true). Recreate it in a fresh clone. `.claude/launch.json` (preview "web" → http://demo.localhost:3000).
- Browser check done: demo.localhost sign-in as student01/owner works; rival.localhost shows sign-in (host-only session).

Phase 2 AC status: AC2.1 PASS, AC2.2 PASS (report committed), AC2.3 PASS, AC2.4 PASS (pgTAP + E2E), AC2.5 PASS, AC2.6 PASS,
AC2.7 PASS at DB level (is_platform_admin requires aal2; TOTP enrolment UI comes with the Phase 3 platform admin area).
BLOCKED: Google OAuth (no client), invitation emails via Resend (no account) → link shown once (ADR-020).
Deferred to Phase 3 (ADR-021): invite creation UI (single + CSV), platform admin UI, 375px phone check of real screens.

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
- None open.

## Unresolved decisions
See docs/RISKS_AND_OPEN_QUESTIONS.md §1 (Q-05 resolved). Plan approved for building on 2026-10-15; Q-01 (legal) and Q-08 (Voyage terms) still open.

## Next exact action
1. `git checkout phase-2-identity`, `supabase start`, recreate `apps/web/.env.local` if missing (see In progress), `supabase db reset && npm run seed:demo`.
2. Open PR `phase-2-identity` → `main` (title "Phase 2: Identity, tenancy and isolation"), bind it, wait for CI (first CI run of the
   seed/E2E steps — watch `supabase start` applying `test_helpers.sql` seed and `npm run seed:demo`), fix until green, merge.
3. Start Phase 3 (portals shell) on branch `phase-3-portals` per docs/IMPLEMENTATION_ROADMAP.md, including the deferred items above.

## Relevant files and commands
- Plan entry point: `docs/PROJECT_MASTER_PLAN.md`
- Roadmap and acceptance criteria: `docs/IMPLEMENTATION_ROADMAP.md`
- Commands: `supabase start` / `supabase status` / `supabase test db`; scripts in root `package.json`.
- Local Supabase: API http://127.0.0.1:54321, DB postgresql://postgres:postgres@127.0.0.1:54322/postgres (local defaults; keys via `supabase status -o env`, never commit them).
- Playwright Chromium (session 3, `npx playwright install chromium`, chromium-1243/headless-shell-1248 in ~/Library/Caches/ms-playwright).
- Seed/ops: `npm run seed:demo`, `npm run create-institute`, `npm run audit`. Demo logins: owner@demo.test, admin@demo.test, teacher1-3@demo.test, student01-50@demo.test (same for @rival.test) via "Sign in as demo user".
- Tools installed by Claude: Docker Desktop 4.95.0 (`brew install --cask docker-desktop`), Supabase CLI 2.121.0 and gitleaks 8.30.1 (`brew install supabase/tap/supabase gitleaks`).

## Known regressions
- None.

## Session log
| Session | Date | Summary | Last commit |
|---|---|---|---|
| 1–2 | 2026-10-14/15 | Planning docs, founder decisions, tools, git init, workspaces, local Supabase init + pgTAP smoke | `5d26fc7` |
| 4 | 2026-10-15 | Phase 1 gate green, CI audit gate, PR #1 merged (`913ec7f`). Phase 2 built: tenancy schema + RLS, 334 pgTAP, web tenant/sign-in/invite, demo seed, 6 E2E; local gate green; PR not yet opened | see `git log` |
| 3 | 2026-10-15 | Phase 1: web skeleton (build OK), pg-boss schema + worker heartbeat (ran OK), logger, lint/format/test configs, forbidden-pattern check (lint OK), bundle scan, gitleaks hook, CI workflow, .env.example. Full gate NOT yet run; nothing pushed before the WIP commit. | see `git log` |
