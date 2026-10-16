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
**Phase 9 MERGED** into `main` (PR #9, squash commit `67ed4ac`, CI green: check + secrets, run 38869056404 — pgTAP 1220, E2E 26/26 against the production build incl. T-SEC-05, 2026-10-16).
**Phase 10 (local parts) MERGED** into `main` (PR #10, squash commit `dc7600f`, CI green: check + secrets, run 38877776627 — unit 132, pgTAP 1243, integration 23, E2E 26/26 against the production build incl. T-SEC-05, 2026-10-16).
**R1 OCR MERGED** into `main` (PR #11, squash commit `69d3fc6`, CI green: E2E 26/26, run 38880693017, 2026-10-16).
**Release 1 local build is complete** (Phases 1–9 + Phase 10 local parts). Phase 10 cloud parts are BLOCKED on founder approval (see Blocked).
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
### R1 purge of unreachable files (session 20, branch `r1-purge-files`) — gate green locally, PR open
Scope = "Next exact action" 2b. ADR-031.
DONE + TESTED (2026-10-16):
- Migration `20261025000013_purge_files.sql`: `private.purgeable(bucket, name, created)` (files > 1 day old that no
  live / < 30-day-deleted document version points at; logos no institute uses), `private.purgeable_files()` (worker,
  ≤ 1,000/day), storage policies `purge_select`/`purge_delete` (service account only), `purge_expired()` now also
  hard-deletes documents past their grace whose files are gone. pgTAP `130_purge_files.sql` (13 tests: exact purgeable
  set, owner cannot delete, worker deletes exactly that set, document waits for its files, 29-day-old delete stays);
  allowlist in `010`; `120` expects the new `documents` count.
- Worker: `apps/worker/src/purge.ts` (Storage API remove as the service account, then `purge_expired`) run by the daily
  `purge` job; `workerStorage()` in `storage.ts`. Integration test `purge.int.test.ts` against the real Storage API.
- Found by the gate: the purge test's aged files became real orphans after its institute was deleted and showed up in
  `070`'s worker-visibility count → `070` starts from its own files only (same assertion), the test removes its files.
- Local gate (after `supabase db reset && npm run seed:demo`, rebased on `69d3fc6`): format, lint, typecheck PASS;
  unit 135/135; pgTAP Files=14 Tests=1256 PASS (also after the integration run); integration 26/26; build + bundle
  scan PASS; E2E (before rebase) 25/26 — T-SEC-05 only (other session's `next dev` on :3000). CI on the PR.
- RUNBOOKS offboarding step 4 (files now deleted automatically), DATABASE_DESIGN §4.3/§7.

### R1 OCR — Claude OCR provider (session 20) — MERGED (PR #11, `69d3fc6`, CI green: E2E 26/26, run 38880693017)
Scope = PROGRESS "Next exact action" 2a (no founder decision needed). ADR-030.
DONE + TESTED (2026-10-16):
- `packages/core/src/ai/ocr.ts`: provider interface (fake | anthropic), `ocrPages(meter, pages, render)` renders a
  batch only after its reservation; `OcrRefused` → worker error code `ocr_refused` (staff text added).
- `packages/core/src/ai/claude.ts` `claudeOcr`: Haiku 5.5, ≤ 20 labelled base64 JPEG pages per streamed call, effort
  low, max_tokens 4,000/page, `<page n>` split. Request shape checked against the official vision docs (2026-10-16).
  Unit tests against a recorded stream: request shape, per-page split incl. truncated page, refusal settled as
  `refused` with its real cost (785 µ$) and batch failed.
- `apps/worker/src/extract.ts`: pages needing OCR and photos rendered to JPEG ≤ 2,000 px (`@napi-rs/canvas` 1.0.11,
  already in the lockfile via pdfjs-dist, now declared: `npm i -w @examedge/worker @napi-rs/canvas@1.0.11`).
  Real bug found while testing: the canvas binding throws on NUL characters (garbled text layers) → the document failed
  as `internal`; fixed (NULs dropped before drawing). New integration tests: NUL text layer → `ready` (proved failing
  without the fix), corrupt PNG → `corrupt_file`.
- Local gate (after `supabase db reset && npm run seed:demo`): format, lint + forbidden, typecheck PASS; unit 135/135;
  pgTAP Files=13 Tests=1243 PASS; integration 25/25; build + bundle scan PASS; `npx playwright test --workers=1` 25/26 —
  only `portals.spec.ts:142` T-SEC-05 (another session's `next dev` holds :3000, known). E2E against the production
  build → CI on the PR.
- RUNBOOKS §5: OCR is now "ready, needs only an Anthropic key"; worker gets the same key.
BLOCKED: real-key OCR run, AC4.5 (formula accuracy on 3 real docs), AC4.6 (cost per 100 pages).

### Phase 10 — local parts (session 19) — MERGED (PR #10, `dc7600f`)
Scope (ADR-029) = roadmap Phase 10 minus everything that needs a cloud account. ACs proven locally: per-institute
`max_upload_bytes` / `max_storage_bytes` / `max_concurrent_jobs` enforced (ADR-025 deferral closed); retention purge;
local backup + restore rehearsal (T-OPS-16 locally; G7 itself BLOCKED); runbooks; README demo guide.
DONE + TESTED (2026-10-16, session 19):
- `4e2dfd9` migration `20261024000012_limits_retention.sql`: trigger `guard_upload` (definer; `file_too_large`,
  `storage_full`, advisory lock per institute), `pending_jobs` hands out ≤ max_concurrent_jobs per institute,
  `job_slot_free()` (worker, strict claim check), `purge_expired()` (messages > 12 months, empty old chats,
  usage_counters > 35 days; counts only). Worker: claim checks the slot, fails a file larger than declared
  (`too_large`), `drain` loops until nothing waits, daily `purge` at 03:00 IST (pg-boss schedule, tz Asia/Kolkata).
  Web: upload shows the limit messages and soft-deletes the empty new document. pgTAP `120_limits_retention.sql`
  (23 tests) + allowlist in `010`; worker integration tests for both limits (19/19).
  Runtime: worker started against the local stack, a sent `purge` job logged `purge.done` with counts only; schedule
  row `purge|0 3 * * *|Asia/Kolkata`. Seed processed all 18 documents through the per-institute limit.
  Browser (other session's `next dev` on :3000, hot reload): demo `max_upload_bytes` = 1000, teacher1 uploads a 2 KB
  PDF → alert "The file is larger than your institute’s upload limit."; the new document row is soft-deleted; limit restored.
- `1d2fe37` `scripts/backup.ts` (`npm run backup`, `npm run restore-drill -- <dir>`): `pg_dump -Fc` (PostgreSQL 17
  client) + every Storage object + manifest (row counts, checksums); drill restores as `supabase_admin` in the DB
  container into `restore_drill`, compares counts and checksums, exits 1 on a difference. Run: `Backup …: 81 tables,
  37 files`; drill: `81 tables / 3617 rows compared, 37 files checked, 18 document checksums matched the restored rows,
  1.5 s`, exit 0; with one backed-up file altered → exit 1 naming the file. `backups/` gitignored.
- `b731118` `docs/RUNBOOKS.md` (incident, key rotation, backup/restore, offboarding, fake → real AI, rollback),
  `README.md` (how to run the demo + logins), ADR-029, DATABASE_DESIGN §4.4/§4.6 as built, master plan link.
  Found while writing: `AI_PROVIDER=anthropic` covers tutor + Studio only; Claude OCR (`packages/core/src/ai/ocr.ts`)
  and the Voyage client (`embed.ts`, Q-08) are not written → worker must stay on fake AI (RUNBOOKS §5).
- Local gate (2026-10-16, after `supabase db reset && npm run seed:demo`): format, lint + forbidden, typecheck PASS;
  unit 132/132; pgTAP Files=13 Tests=1243 PASS; integration 23/23; build + bundle scan PASS; `npx playwright test
  --workers=1` 25/26 — only `portals.spec.ts:142` T-SEC-05 (the other session's `next dev` holds :3000, sends
  `no-store` without `private`, known). Production build checked by hand: `next start -p 3100` →
  `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`. `npm run audit` ok; gitleaks history clean.
  E2E against the production build → CI on the PR.
- `cd7f1fc` RUNBOOKS.md rewritten in plain simple English at the founder's request (same steps); `726a279` README
  link fixed for the new §5 heading. CI on the final commit green (run 38877776627, E2E 26/26); merged `dc7600f`.

## Blocked
| Item | Blocked on |
|---|---|
| Embedding real institute documents (Phase 4) | Q-08 Voyage data-use terms |
| Pilot launch (Phase 10) | Q-01 legal opinion on minors' data (G8, AC10.4) |
| Phase 10 cloud parts | Founder approval for accounts: production Supabase/Vercel/Railway, domain + wildcard TLS, prod Google OAuth, Sentry + spend alerts, independent backup storage; then the real restore drill (G7, AC10.2), k6 load test (AC10.3, AC7.4), rollback rehearsal (AC10.5) |
| Real AI | Anthropic key (tutor + Studio ready); Claude OCR not written; Voyage client not written (Q-08) — RUNBOOKS §5 |

## Failed checks
- None. Note: locally, `e2e/portals.spec.ts:142` (T-SEC-05) fails if Playwright reuses a `next dev` already running on
  :3000 (dev sends `Cache-Control: no-store` without `private`). Before `npm run check`, make sure port 3000 is free
  (`lsof -nP -iTCP:3000 -sTCP:LISTEN`); if another session's dev server holds it, rely on CI for E2E and say so.

## Unresolved decisions
See docs/RISKS_AND_OPEN_QUESTIONS.md §1 (Q-05 resolved). Plan approved for building on 2026-10-15; Q-01 (legal) and Q-08 (Voyage terms) still open.

## Next exact action (after Release 1 local build, session 20)
Everything in `main` (`dc7600f`); no open PR; `phase-10-local` is merged (can be deleted).
0. Fresh session: `cd ~/Documents/startup/examedge_ai && git checkout main && git pull && npm ci`; `docker info`
   (else `open -a Docker`); `supabase status` (else `supabase start`); `supabase db reset && npm run seed:demo`.
1. The founder already got the final summary in chat (what works / BLOCKED / real-AI steps = docs/RUNBOOKS.md §5).
   Ask the founder which of these to do next (all need their decision):
   - approve cloud accounts → Phase 10 cloud parts (production Supabase/Vercel/Railway, domain + TLS, prod Google
     OAuth, Sentry, spend alerts, independent backup storage, real restore drill G7, k6 load test, rollback rehearsal);
   - give an Anthropic key → switch tutor + Studio to real AI (RUNBOOKS §5) and run AC5.2 / AC6.x evals;
   - answer Q-08 (Voyage terms) and Q-01 (legal, blocks the pilot).
2. Local work possible without any decision (new branch per task, e.g. `r1-ocr`):
   a. ~~Claude OCR provider~~ — merged (PR #11, `69d3fc6`, ADR-030).
   b. ~~Purge of soft-deleted documents' files and replaced logos~~ — branch `r1-purge-files` (ADR-031): merge its PR
      once CI is green.
   Each: tests + full gate (`npm run check`, local E2E `--workers=1`, T-SEC-05 fails only against another session's
   `next dev` on :3000), PR, CI green, squash-merge, PROGRESS update.

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
- `@napi-rs/canvas` 1.0.11 declared in worker deps (session 20; was already installed with pdfjs-dist).
- PostgreSQL 17 client tools (session 19, `brew install postgresql@17`, pg_dump 17.11) for `npm run backup` (server is 17).
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
| 18 | 2026-10-16 | Phase 9: browser check done (no bugs), Studio seed, `e2e/studio.spec.ts`, ADR-028 + DB docs, local gate (E2E 25/26, T-SEC-05 dev-only), PR #9 CI green (E2E 26/26) and merged (`67ed4ac`); branch `phase-10-local`; handoff for Phase 10 | see `git log` |
| 19 | 2026-10-16 | Phase 10 local: upload/storage/job limits, retention purge, backup + restore drill, runbooks, README, ADR-029; local gate green (E2E 25/26, T-SEC-05 dev-only) | `b731118` |
| 20 | 2026-10-16 | Claude OCR provider (ADR-030, PR #11 merged `69d3fc6`); purge of unreachable files (ADR-031), PR opened | see `git log` |
| 15 | 2026-10-16 | Phase 8: library migration + 40 pgTAP (1104 PASS), core two-layer tutor (46 unit), web/platform editor/seed/eval written; AC8.4 library recall 0.81 FAILING (keyword AND), handoff | see `git log` |
| 3 | 2026-10-15 | Phase 1: web skeleton (build OK), pg-boss schema + worker heartbeat (ran OK), logger, lint/format/test configs, forbidden-pattern check (lint OK), bundle scan, gitleaks hook, CI workflow, .env.example. Full gate NOT yet run; nothing pushed before the WIP commit. | see `git log` |
