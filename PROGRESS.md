# ExamEdge AI — Progress

Last updated: 2026-10-16

## Current phase
**Phase 1 MERGED** into `main` (PR #1, merge commit `913ec7f`, CI green: check + secrets, 2026-10-15).
**Phase 2 MERGED** into `main` (PR #2, merge commit `c106364`, CI green: unit 12, pgTAP 334, E2E 6, 2026-10-15).
**Phase 3 MERGED** into `main` (PR #3, squash commit `0417717`, CI green: check + secrets, run 38702576710, 2026-10-15).
**Phase 7 MERGED** into `main` (PR #4, squash commit `2a5f25e`, CI green: check + secrets, run 38711008739, 2026-10-15).
**Phase 4 MERGED** into `main` (PR #5, squash commit `cbfb62e`, CI green: check + secrets, run 38795802409, 2026-10-16).
**Phase 5 MERGED** into `main` (PR #6, squash commit `b1f0795`, CI green: check + secrets, run 38805190604, 2026-10-16).
**Phase 6 MERGED** into `main` (PR #7, squash commit `7863900`, CI green: check + secrets, run 38841699259 — unit 104, pgTAP 1064, integration 21, E2E 22/22 against the production build, 2026-10-16).
**Phase 8 MERGED** into `main` (PR #8, squash commit `bce1046`, CI green: check + secrets, run 38848935766 — unit 111, pgTAP 1107, integration 21, E2E 24/24 against the production build, 2026-10-16).
**Phase 9 (Studio basics) — local gate green, PR open** on `phase-9-studio` (branched from `main` at `bce1046`; sessions 17–18). See "In progress".
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
| 2026-10-16 | Phase 8 local gate | After `supabase db reset && npm run seed:demo`: `npm run check` → format, lint + forbidden, typecheck PASS; unit 111/111; pgTAP Files=11 Tests=1107 PASS; integration 21/21; build (+bundle scan) PASS; E2E 22/24 → mapping test race fixed (wait for sign-out), rerun `npm run test:e2e` 23/24: only `portals.spec.ts:142` T-SEC-05, because Playwright reused another session's `next dev` on :3000 (`reuseExistingServer`). Production build checked by hand: `next start -p 3100`, `demo.localhost:3100/` and `/library/<id>` → `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`. Full E2E against the production build runs in CI on the PR. |
| 2026-10-16 | Phase 5 local gate green | After `supabase db reset && npm run seed:demo`: `npm run check` exit 0 — format, lint + forbidden, typecheck, unit 46/46, pgTAP Files=9 Tests=959 PASS, integration 20/20, build (+bundle scan), E2E 18/18 (commit `aa5dcce`). `npm run audit` → ok. AC5.1: `scripts/check-forbidden.ts` rule `provider-sdk-outside-gateway` passes and `grep -rnE "@anthropic-ai/sdk|voyageai|openai" apps packages scripts` finds only the rule itself and its test. AC5.3: `apps/worker/src/usage.int.test.ts` — 100 parallel `rpc('ai_reserve')` with a student token and limit 40 → exactly 40 ok / 60 `quota`, counter = 40; 100 parallel worker reservations of 30 µ$ with 1,000 µ$ left → exactly 33 ok, 990 reserved. AC5.4: pgTAP `080_usage.sql` (global, institute and suspended switches) + integration test (aal2 platform admin flips `set_ai_enabled` through PostgREST → next worker reservation `ai_disabled` → back on). Browser check (dev server): owner@demo.test `/usage` desktop + 375 px; teacher/student `/usage` 404 (E2E); platform admin global switch off/on with audit rows. Two real bugs found and fixed: (1) `set_ai_enabled` failed with SQLSTATE 21000 because Supabase's `safeupdate` refuses an UPDATE without WHERE in PostgREST sessions (pgTAP cannot load it) → `where id` + API-path test that failed before the fix; (2) staff pages were 667 px wide at 375 px (non-wrapping nav widened the `1fr` grid column) → `minmax(0, 1fr)`, nav scrolls. ADR-025. |
| 2026-10-16 | Phase 4 local gate green | After `supabase db reset && npm run seed:demo`: `npm run check` exit 0 — format, lint + forbidden, typecheck, unit 32/32, pgTAP Files=8 Tests=850 PASS, integration 16/16, build (+bundle scan), E2E 16/16 (commit `ca4b542`). `npm run audit` → ok. Two test fixes found by the gate (no assertion weakened): pgTAP `070` storage fixture inserted objects the seed had already uploaded (duplicate key after seeding) → skips existing objects; platform E2E picked the logo while the "Save limits" redirect was still in flight (re-render emptied the required file input, no POST in the trace) → waits for the POST, reloads, checks the saved value. ADR-024 added; DATABASE_DESIGN §4.3 updated (uploading status, claimed_at, path check, service_accounts). |
| 2026-10-15 | Phase 7 local gate green | After `supabase db reset && npm run seed:demo`: `npm run check` exit 0 — format, lint + forbidden, typecheck, unit 21/21, pgTAP Files=7 Tests=693 PASS, build (+bundle scan), E2E 14/14 incl. `e2e/assessments.spec.ts` (commit `40fc4fc`). `npm run audit` → ok. Browser check (session 7, dev server): teacher1 checked all 22 written answers of "Chemistry Test 3" with names hidden and released (ranks with time tie-break, equal score+time share a rank); student01 started "Physics Practice Test" at 375 px (scrollWidth 375, autosave "Saved"), review + My progress at 375 px; owner JEE rank list, sort links, CSV `private, no-store`; owner@rival.test → 404 for Demo test/check/export, batch export and a real Demo student id. |
| 2026-10-15 | Phase 3 local gate green | After `supabase db reset && npm run seed:demo`: `npm run check` exit 0 — format, lint + forbidden, typecheck, unit 18/18, pgTAP Files=6 Tests=394 PASS, build, E2E 12/12 (commit `9ecd143`). `npm run audit` → ok. Then aal check switched to `getClaims()` (ADR-022): typecheck, format, lint, build, platform E2E 1/1 pass. Fixes: `done()` redirect used `?` twice on `/people?tab=invitations` (flash lost, real bug); E2E waits for client navigation and refills the form React resets. Browser check (session 6): owner dashboard; student01 home + Physics workspace at 375 px, scrollWidth 375; owner@rival.test → Demo subject id 404; admin.localhost sign-in; demo.localhost/platform 404. |

## In progress
### Phase 9 — Studio basics (session 17) — IN PROGRESS on `phase-9-studio`
Scope = IMPLEMENTATION_ROADMAP Phase 9 + student practice quizzes deferred from Phase 7 (ADR-023). ACs: AC9.1 every
artifact validates against its schema · AC9.2 identical institute request reuses the artifact (no provider call) ·
AC9.3 citations per section · AC9.4 student artifacts private to owner (T-ISO-01 extended).
DONE + TESTED (2026-10-16, session 17):
- `c36462f` migration `20261023000011_studio.sql`: `chapters` + `unique (institute_id, subject_id, id)`;
  `generated_artifacts` (owner_scope institute|student, kinds summary|flashcards|mind_map|quiz, chapter required via
  3-column composite FK, source_refs, input_hash, prompt_version, content jsonb, status draft|published|withdrawn,
  partial unique indexes for reuse per institute / per student), `artifact_audience` (composite FKs, audited; teachers
  only taught batches), `practice_attempts` (no insert grant; written only by definer `submit_practice`, which grades
  in SQL and keeps only the quiz's question ids); trigger `guard_artifact` (insert = draft by caller, owner_user_id
  stamped; content edit → draft; publish needs an audience, stamps approver); definers `can_read_artifact`,
  `submit_practice`, `practice_activity` (same callers as tutor_activity) + allowlist in `010`; fixtures in
  `supabase/test_helpers.sql`; pgTAP `110_studio.sql` 38 tests. `supabase db reset && supabase test db` → Files=12,
  Tests=1220, PASS.
- `0fa08bd` core `packages/core/src/ai/studio.ts`: zod schemas (non-recursive, also the Claude structured-output
  schema), `validateArtifact` (citations < sources, quiz ids/answer, mind map ≤ 60 nodes), demo generators
  (deterministic; quiz = fill-in-the-blank), `generateArtifact` metered as feature `generation` (counter
  `generations`), `claudeStudio` in `claude.ts` (`client.beta.messages.parse` + `betaZodOutputFormat`, numbered
  sources because citations cannot combine with structured outputs; Sonnet for summary + fallbacks, Haiku others) —
  real provider BLOCKED (no key), tested against a recorded response. `zod` added to `packages/core` deps (already in
  the workspace). `fnv1a` exported from embed.ts; `fake-studio-1` in routing.ts.
DONE + TESTED (2026-10-16, session 18):
- `278f0d5` web Studio (generate with reuse, artifact page, quiz runner, publish/edit/withdraw/delete, practice on
  progress pages, webMeter shared).
- Browser check (dev server, after `db reset && seed:demo`): teacher1 → Physics → Rotational Motion → Flashcards →
  generated (draft); Generate again → `?ok=reused`, `usage_records` feature=generation stays 1; publish to JEE 2027
  Morning → student01 sees it under "From your teachers", draft mind map not listed; mind map renders as nested list
  with citation chips; student01 Practice quiz → 3 answered → "Your score: 2 of 10", correct/your-answer badges and
  explanations, "Your tries" after reload, My progress "Physics · Rotational Motion: 1 practice quiz, average 20%";
  375 px: scrollWidth 375 on quiz, flashcards and subject pages. No bugs found.
- `6bf90eb` seed: per institute a published Rotational Motion summary (same input hash as the web, so a teacher's
  Generate → reused) + student01's own practice quiz with one try (5/10). `e2e/studio.spec.ts` 2 tests: AC9.2 reuse
  with usage count unchanged, publish → student sees, draft 404 for student; DB-graded quiz + `practice_attempts` row
  + progress; AC9.4 student03/teacher1/owner@demo/owner@rival → `/studio/<id>` 404, REST select empty,
  `submit_practice` 42501; staff list never shows a student's quiz.
- Docs commit: ADR-028, DATABASE_DESIGN §4.4/§4.5 as built; dashboard "Coming next" text replaced (Studio is live).
- Local gate (2026-10-16, after `supabase db reset && npm run seed:demo`): `npm run check` → format, lint +
  forbidden, typecheck PASS; unit 132/132; pgTAP Files=12 Tests=1220 PASS; integration 21/21; build + bundle scan
  PASS; E2E with 4 workers against the other session's `next dev` on :3000 was flaky (5 s timeouts, different tests
  each run) → reseeded, `npx playwright test --workers=1` → 25/26, only `portals.spec.ts:142` T-SEC-05 (dev server
  sends `no-store` without `private`, known). `npm run audit` ok; gitleaks git history clean (dir scan hits only
  gitignored `apps/web/.env.local` and `.next/`). E2E against the production build → CI on the PR.

## Blocked
| Item | Blocked on |
|---|---|
| Embedding real institute documents (Phase 4) | Q-08 Voyage data-use terms |
| Pilot launch (Phase 10) | Q-01 legal opinion on minors' data |

## Failed checks
- None. Note: locally, `e2e/portals.spec.ts:142` (T-SEC-05) fails if Playwright reuses a `next dev` already running on
  :3000 (dev sends `Cache-Control: no-store` without `private`). Before `npm run check`, make sure port 3000 is free
  (`lsof -nP -iTCP:3000 -sTCP:LISTEN`); if another session's dev server holds it, rely on CI for E2E and say so.

## Unresolved decisions
See docs/RISKS_AND_OPEN_QUESTIONS.md §1 (Q-05 resolved). Plan approved for building on 2026-10-15; Q-01 (legal) and Q-08 (Voyage terms) still open.

## Next exact action (Phase 9 → Phase 10, session 18+)
A. Phase 9 PR into `main`: check CI (E2E on the production build), fix until green, merge; record PR number, merge
   commit and CI run in "Current phase" and the Completed table.
B. Then Phase 10 local parts (NEXT_SESSION_PROMPT §8): retention/backup scripts that need no cloud, enforce
   `max_upload_bytes`/`max_concurrent_jobs` (ADR-025 deferral), runbooks (incident, key rotation, restore,
   offboarding) as docs, README "How to run the demo" (commands + demo logins), final summary to the founder: what
   works, what is BLOCKED and why, exact steps to switch from fake AI to real keys.
0. Fresh session: `cd ~/Documents/startup/examedge_ai && git checkout <branch> && git pull && npm ci`;
   `docker info` (else `open -a Docker`); `supabase status` (else `supabase start`); `supabase db reset && npm run seed:demo`.
   Port 3000 may be held by another session's `next dev` (this checkout, hot reload): browser checks can use it;
   locally run E2E with `--workers=1` (parallel runs time out on dev compiles) and expect T-SEC-05 to fail there —
   CI runs E2E on the production build.

## Relevant files and commands
- Plan entry point: `docs/PROJECT_MASTER_PLAN.md`
- Roadmap and acceptance criteria: `docs/IMPLEMENTATION_ROADMAP.md`
- Commands: `supabase start` / `supabase status` / `supabase test db`; scripts in root `package.json`.
- Local Supabase: API http://127.0.0.1:54321, DB postgresql://postgres:postgres@127.0.0.1:54322/postgres (local defaults; keys via `supabase status -o env`, never commit them).
- `@axe-core/playwright` 4.13.0 (session 5, `npm i -D`).
- `@anthropic-ai/sdk` 0.131.0 (session 12, `npm i -w @examedge/core @anthropic-ai/sdk@0.131.0`).
- Playwright Chromium (session 3, `npx playwright install chromium`, chromium-1243/headless-shell-1248 in ~/Library/Caches/ms-playwright).
- Seed/ops: `npm run seed:demo`, `npm run create-institute`, `npm run audit`. Demo logins: owner@demo.test, admin@demo.test, teacher1-3@demo.test, student01-50@demo.test (same for @rival.test) via "Sign in as demo user".
- `pdfjs-dist` 6.4.299 (session 8, `npm i -w @examedge/worker pdfjs-dist@6.4.299`; optional `@napi-rs/canvas` comes with it); `@supabase/supabase-js` added to worker deps.
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
| 7 | 2026-10-15 | PR #4 merged (`2a5f25e`). Phase 7 seed fixed, `e2e/assessments.spec.ts`, 6 real bugs fixed (test creation RLS, key save, key embeds, submit, form state, checking scroll), browser check, ADR-023, gate green | `40fc4fc` |
| 8 | 2026-10-15 | Phase 4 DB + worker + tests green (850 pgTAP, 16 integration); institute-delete cascade bug fixed; web UI + seed written, not verified | see `git log` |
| 13 | 2026-10-16 | Phase 6: assemble fix, streaming tutor route, safe Markdown + XSS/injection suites, tutor pane + reports + doubts, browser-verified; AC6.4/E2E/gate pending | `7fd9b8a` |
| 14 | 2026-10-16 | Phase 6: AC6.4 isolation test, eval runner, tutor E2E, 375 px check, ADR-026, gate, PR #7 CI green and merged (`7863900`); branch `phase-8-library` | see `git log` |
| 9 | 2026-10-15 | Phase 4 web UI browser-verified, worker env/CI, `e2e/documents.spec.ts`, logo upload; founder pausing subscription — handoff written | see `git log` |
| 10 | 2026-10-16 | ADR-024, Phase 4 full gate green (2 test-fixture races fixed), PR #5 merged (`cbfb62e`); Phase 5 prices verified, usage migration written (pgTAP 2 failing, WIP) | see `git log` |
| 11 | 2026-10-16 | Phase 5: pgTAP green + `080_usage.sql`, core gateway (routing/cost/metered), worker metering, `/usage` page, platform AI switches, AC5.3 concurrency + AC5.4 API tests; 2 real bugs fixed (safeupdate kill switch, phone layout); full gate green; PR #6 opened, CI pending at handoff | `0802398` |
| 12 | 2026-10-16 | PR #6 merged (`b1f0795`). Phase 6: tutor schema + RLS + pgTAP (1064 PASS), Anthropic SDK 0.131.0, core tutor/fake/Claude provider + tests WIP (1 unit test failing, fix known) | see `git log` |
| 16 | 2026-10-16 | Phase 8: AC8.4 fixed (OR keyword query, library recall 1.0), web verified in browser (2 UI fixes), `e2e/library.spec.ts`, ADR-027 + docs, gate, PR #8 CI green (E2E 24/24) and merged (`bce1046`); branch `phase-9-studio` | see `git log` |
| 17 | 2026-10-16 | Phase 9: studio schema + 38 pgTAP (1220 PASS), core generators + Claude structured-output provider (unit 132), web Studio pane/artifact page/quiz/progress written, first browser check OK; handoff mid-browser-check | see `git log` |
| 18 | 2026-10-16 | Phase 9: browser check done (no bugs), Studio seed, `e2e/studio.spec.ts`, ADR-028 + DB docs, local gate (E2E 25/26, T-SEC-05 dev-only), PR opened | see `git log` |
| 15 | 2026-10-16 | Phase 8: library migration + 40 pgTAP (1104 PASS), core two-layer tutor (46 unit), web/platform editor/seed/eval written; AC8.4 library recall 0.81 FAILING (keyword AND), handoff | see `git log` |
| 3 | 2026-10-15 | Phase 1: web skeleton (build OK), pg-boss schema + worker heartbeat (ran OK), logger, lint/format/test configs, forbidden-pattern check (lint OK), bundle scan, gitleaks hook, CI workflow, .env.example. Full gate NOT yet run; nothing pushed before the WIP commit. | see `git log` |
