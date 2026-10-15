# ExamEdge AI — Progress

Last updated: 2026-10-15

## Current phase
**Phase 1 MERGED** into `main` (PR #1, merge commit `913ec7f`, CI green: check + secrets, 2026-10-15).
**Phase 2 MERGED** into `main` (PR #2, merge commit `c106364`, CI green: unit 12, pgTAP 334, E2E 6, 2026-10-15).
**Phase 3 MERGED** into `main` (PR #3, squash commit `0417717`, CI green: check + secrets, run 38702576710, 2026-10-15).
**Phase 7 (tests, checking, ranks, progress page) — local gate GREEN** on branch `phase-7-tests` (pushed); PR → CI → merge in progress (see Next exact action).
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
| 2026-10-15 | Phase 7 local gate green | After `supabase db reset && npm run seed:demo`: `npm run check` exit 0 — format, lint + forbidden, typecheck, unit 21/21, pgTAP Files=7 Tests=693 PASS, build (+bundle scan), E2E 14/14 incl. `e2e/assessments.spec.ts` (commit `40fc4fc`). `npm run audit` → ok. Browser check (session 7, dev server): teacher1 checked all 22 written answers of "Chemistry Test 3" with names hidden and released (ranks with time tie-break, equal score+time share a rank); student01 started "Physics Practice Test" at 375 px (scrollWidth 375, autosave "Saved"), review + My progress at 375 px; owner JEE rank list, sort links, CSV `private, no-store`; owner@rival.test → 404 for Demo test/check/export, batch export and a real Demo student id. |
| 2026-10-15 | Phase 3 local gate green | After `supabase db reset && npm run seed:demo`: `npm run check` exit 0 — format, lint + forbidden, typecheck, unit 18/18, pgTAP Files=6 Tests=394 PASS, build, E2E 12/12 (commit `9ecd143`). `npm run audit` → ok. Then aal check switched to `getClaims()` (ADR-022): typecheck, format, lint, build, platform E2E 1/1 pass. Fixes: `done()` redirect used `?` twice on `/people?tab=invitations` (flash lost, real bug); E2E waits for client navigation and refills the form React resets. Browser check (session 6): owner dashboard; student01 home + Physics workspace at 375 px, scrollWidth 375; owner@rival.test → Demo subject id 404; admin.localhost sign-in; demo.localhost/platform 404. |

## In progress
### Phase 7 — tests, checking, ranks, progress (sessions 6–7) — gate GREEN locally; PR/CI/merge left
Built (branch `phase-7-tests`): migration `20261017000005_assessments.sql` (questions, question_keys, tests, test_questions,
test_audience, test_attempts, attempt_answers, batch_standings + RLS + definer RPCs), pgTAP `060_assessments.sql`, web
`/questions`, `/tests`, `/tests/[id]` (staff + student runner/review), `/tests/[id]/check`, CSV exports, batch rank list,
`/students/[id]` + `/progress`, seed with released tests/ranks and "Chemistry Test 3" waiting for checking. Decisions: ADR-023.
Session 7 bugs found by the new E2E/browser check and fixed (`4a21a8a`, `40fc4fc`):
- nobody could create a test: `insert … returning` was refused because the read policy's `can_see_test(id)` cannot see
  the new row → creator/manager checked inline (pgTAP regression "teacher reads back the test they just created").
- answer keys never saved from the UI: PostgREST upsert needs UPDATE on every column, only `key` is granted → update, else insert.
- `question_keys` embedded as a list (composite FK not one-to-one) → checking screen crashed, "No answer key" badge never
  showed → `unique (institute_id, question_id)`.
- Submit test never posted (second `requestSubmit()` after `preventDefault` does not re-run a form action) → `startTransition`.
- Question form kept the previous subject after switching subject tabs → keyed by subject.
- Checking screen jumped to the top after every save → `refresh()` in place.
AC status: AC7.1 ✅ pgTAP grading tables · AC7.2 ✅ pgTAP + E2E (REST returns no keys) · AC7.3 ✅ pgTAP · AC7.6 ✅ pgTAP
hand-computed fixture · AC7.7 ✅ pgTAP + E2E (release disabled) · AC7.8 ✅ pgTAP + E2E (teacher3 404 + RPC `not_allowed`) ·
AC7.9 ✅ pgTAP + E2E (region text equal) · AC7.4 BLOCKED (needs staging/prod-sized DB; k6 in Phase 10) · AC7.5 deferred
(AI generation after Phase 5) · practice quizzes deferred to Phase 9.

### Phase 3 — portals shell (sessions 5–6) — MERGED (PR #3, `0417717`); history below kept for reference
Built (branch `phase-3-portals`):
- `supabase/migrations/20261016000004_portals.sql`: `institute_quotas` (default row per institute via trigger), branding check
  (only `{"color":"#rrggbb"}`), audit trigger now also on institutes/quotas (actor_kind platform_admin when aal2 admin),
  `create_institute(slug, name, host, owner_email)` RPC (platform admin + aal2; reserved slugs; host must be `<slug>.<domain>`;
  returns one-time owner invite token), platform-admin update policies, guard: student membership can never become staff or reverse.
  pgTAP `050_platform.sql`; allowlist in `010` includes `create_institute`. `supabase test db` → Files=6, Tests=394, PASS (2026-10-15).
- Web: `app/globals.css` (tokens from `docs/share/mockups`, Poppins/Lora via next/font, sidebar → top bar < 800px),
  `app/(portal)/` layout + pages: `/dashboard`, `/batches`, `/batches/[id]`, `/subjects`, `/people` (staff/students/invitations,
  single + CSV invites, links shown once, revoke, role/status), `/home` (student), `/subjects/[id]` (Sources/Tutor/Studio, tabs on phone).
  `/` redirects members to `/dashboard` or `/home`. Server actions `app/(portal)/actions.ts` (institute from host + role re-check).
  Teachers only open batches they teach. `lib/host.ts`, `lib/brand.ts` (+test; text colour by contrast).
- Platform admin: `proxy.ts` rewrites `admin.localhost` → `/platform` and 404s `/platform` elsewhere; `app/platform/` (demo sign-in,
  TOTP enrol/verify → aal2, institutes list, create institute with one-time owner link, `/institutes/[id]` status/name/colour/quotas).
  Browser-checked: MFA enrol + verify works, institutes listed.
- E2E: `e2e/helpers.ts` (shared), `e2e/portals.spec.ts` (owner/teacher/student journeys, AC3.2 cache headers, AC3.3 axe, AC3.4,
  cross-tenant ids, platform MFA flow), `e2e/totp.ts` (+ RFC 6238 vector test). `playwright.config.ts` testMatch `*.spec.ts`.
  Dev dep added: `@axe-core/playwright@4.13.0` (npm). `npm run audit` NOT yet re-run after adding it.

FAILING (session 6 re-run 2026-10-15 after `supabase db reset && npm run seed:demo && npm run build`): `npm run test:e2e` → 10 passed, 2 failed:
`portals.spec.ts:36` owner AC3.1 (not yet diagnosed) and `portals.spec.ts:164` platform admin (alert 'That address is reserved.' not shown
after creating slug `admin`, line 195). Contrast/axe and teacher select fixes now PASS. Earlier history —
FAILING / UNVERIFIED (last run 2026-10-15, before fixes): `npm run test:e2e` → 8 passed, 4 failed: axe colour-contrast
(white on #d97757; badge greens/reds) and a select lookup in the teacher test. Fixes applied but NOT re-run: `--on-accent` ink text
on accent, darker `--good`/`--bad`, `brandStyle()`, selects looked up via `getByRole('combobox', { name: /^Role/ })`.
Deferred (record in DECISIONS.md as ADR-022 when closing Phase 3): logo upload (needs Storage, Phase 4) — branding is colour only.

Phase 2 AC status: all PASS (AC2.7 at DB level; TOTP UI now built in Phase 3). BLOCKED: Google OAuth, Resend (links shown once).

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
1. `git checkout phase-7-tests && git pull`; `docker info`; `supabase start` if stopped.
2. If the Phase 7 PR is not merged yet: open/check PR "Phase 7: Tests, checking, ranks, progress" into `main`
   (`gh pr list`), fix CI until green, merge (squash), pull `main`, record merge commit here.
3. Phase 4 (documents) on new branch `phase-4-documents` from `main`: state scope + AC4.1–AC4.6 first (IMPLEMENTATION_ROADMAP
   Phase 4), PDF-extraction spike (record choice in DECISIONS), storage bucket + policies, documents/document_versions/
   document_audience/document_chunks migrations + RLS + pgTAP, worker ingestion with fake embeddings (demo mode, ADR in
   NEXT_SESSION_PROMPT §2), upload/publish/withdraw UI, logo upload (ADR-022 deferral). Real document embedding stays BLOCKED (Q-08).

## Relevant files and commands
- Plan entry point: `docs/PROJECT_MASTER_PLAN.md`
- Roadmap and acceptance criteria: `docs/IMPLEMENTATION_ROADMAP.md`
- Commands: `supabase start` / `supabase status` / `supabase test db`; scripts in root `package.json`.
- Local Supabase: API http://127.0.0.1:54321, DB postgresql://postgres:postgres@127.0.0.1:54322/postgres (local defaults; keys via `supabase status -o env`, never commit them).
- `@axe-core/playwright` 4.13.0 (session 5, `npm i -D`).
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
| 5 | 2026-10-15 | PR #2 merged (`c106364`). Phase 3 built (migration + 394 pgTAP, staff/student portals, platform admin + TOTP, E2E spec); E2E 4 failures fixed but not re-run; gate not run | see `git log` |
| 6 | 2026-10-15 | Phase 3 E2E fixed (12/12), aal from verified claims, gate green, PR #3 merged (`0417717`). Phase 7 DB (692 pgTAP) + UI built; seed WIP failing | see `git log` |
| 7 | 2026-10-15 | Phase 7 seed fixed, `e2e/assessments.spec.ts`, 6 real bugs fixed (test creation RLS, key save, key embeds, submit, form state, checking scroll), browser check, ADR-023, gate green | `40fc4fc` |
| 3 | 2026-10-15 | Phase 1: web skeleton (build OK), pg-boss schema + worker heartbeat (ran OK), logger, lint/format/test configs, forbidden-pattern check (lint OK), bundle scan, gitleaks hook, CI workflow, .env.example. Full gate NOT yet run; nothing pushed before the WIP commit. | see `git log` |
