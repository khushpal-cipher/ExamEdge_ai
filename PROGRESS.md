# ExamEdge AI — Progress

Last updated: 2026-10-17

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
**R1 file purge MERGED** into `main` (PR #12, squash commit `6f343a0`, CI green: run 38896124282 — unit 135, pgTAP 1256, integration 26, E2E 26/26 against the production build, 2026-10-16).
**R1 AI bank questions MERGED** into `main` (PR #13, squash commit `b6f2ded`, CI green: run 38936700856 — pgTAP 1276, E2E 27/27 against the production build, 2026-10-16).
**Release 1 local build is complete** (Phases 1–9 + Phase 10 local parts + AC7.5 AI bank questions). Phase 10 cloud parts are BLOCKED on founder approval (see Blocked).
GitHub remote: `origin` = https://github.com/khushpal-cipher/ExamEdge_ai (**PUBLIC**, founder's explicit choice on 2026-10-15). Founder asked to connect and push; push phase branches and `main` after each green phase. Never commit secrets (repo is public). Deployments and other cloud accounts still need founder approval.

## Completed (with evidence)
| Date | Item | Evidence |
|---|---|---|
| 2026-10-17 | Platform: send a new owner invitation (ADR-036) + clearer address-length hint | `reinvite_owner` RPC (aal2, refused once an owner joined, revokes old owner links). `supabase migration up` (no reset) then `npx supabase test db` → Files=17 Tests=1303 PASS (new `160_reinvite_owner.sql`); `npx playwright test e2e/portals.spec.ts -g "platform admin needs MFA"` passed (against the running `next dev`); format, lint, typecheck PASS; unit 154/154. Address minimum stays 3 (founder). CI green (run 39019308579: check + secrets, incl. build and full E2E against the production build); PR #18 squash-merged (`5fc5051`). |
| 2026-10-17 | Google sign-in + invitation emails (ADR-035) | Founder created Google Cloud OAuth client + Resend key (gitignored root `.env`, `apps/web/.env.local`). Unit 154/154 (`apps/web/lib/email.test.ts`); E2E portals + isolation 12/12 against a local production build; headless click reached accounts.google.com with the real client id. CI failed twice on the new Google E2E (Playwright cannot intercept a redirect target, so CI hit real Google with the placeholder client) → test now stops at Supabase `/auth/v1/authorize` and reads its Location; CI 2/2 green on `3c605e7`; PR #17 merged (`0006d1c`). **Unverified:** a full real Google sign-in and a delivered email (founder to try). Resend sends only to the account owner until a domain is verified; Google consent screen in Testing (test users only). |
| 2026-10-17 | Platform: delete an institute created by mistake (ADR-033) | `delete_institute` RPC (aal2, typed address, refused with any membership). `supabase migration up` then `npm run test:db` → Files=16 Tests=1288 PASS (new `150_delete_institute.sql`); platform E2E (refused for Demo + wrong confirmation, deletes its test institute) passed; format, lint, typecheck PASS; CI 2/2; PR #15 merged (`65ce7de`). |
| 2026-10-17 | Local demo sign-in creates unknown accounts (ADR-034) | `signInDemo` signs up on `invalid_credentials` (still localhost-only via `demoLoginAllowed`). E2E `isolation.spec.ts` invitation test without pre-created account: failed without the change, passed with it; unit 151/151; format, lint, typecheck PASS; CI 2/2; PR #16 merged. |
| 2026-10-17 | Fix: new institute shows in platform list without reload | Founder found it while testing locally. `createInstitute` now calls `refresh()`; platform E2E checks the list before its reload: `npx playwright test e2e/portals.spec.ts -g "platform admin needs MFA"` failed without the fix (line 204), passed with it. format, lint, typecheck PASS locally; CI 2/2 green; PR #14 merged (`0a4f3ae`). |
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
### R1 AI-made bank questions + blind second solve (session 21) — MERGED (PR #13, `b6f2ded`, CI green run 38936700856)
Scope = roadmap Phase 7 task "AI generation with dual-solve" / AC7.5, deferred in ADR-023 and never built (found
while listing what is left). ADR-032. No founder decision needed.
DONE + TESTED (2026-10-16, commit `fa25f32`):
- Migration `20261026000014_question_generation.sql`: AI feature `question_gen` (≤ 1 USD/call; `ai_reserve` refuses
  it to students), trigger `review` on questions (AI rows forced to `draft`; `approved` refused while `unverified` /
  `dual_solve_disagree` → `question_not_verified`; verification may only change to `teacher_verified`),
  `question_keys.second_solve`, invoker RPC `add_ai_questions` (one transaction). pgTAP `140_question_generation.sql`
  (20 tests).
- Core `packages/core/src/ai/questions.ts`: Opus writes, Sonnet solves blind (`claudeQuestions` in `claude.ts`:
  structured output, effort medium, `fallbacks: "default"`, max_tokens 16,000 — checked with the claude-api skill);
  demo provider; 16 unit tests incl. a recorded-reply test of the request shape (blind: key not sent to the solver).
- Web: question bank "Make questions with AI" form, AI badges, Approve (matched drafts only); edit page shows the
  second answer vs the key, saving approves as `teacher_verified`. `apps/web/lib/notes.ts` shared with Studio.
  `e2e/question-gen.spec.ts`.
- Browser check (dev server, teacher1@demo.test): no-notes chapter → "no published notes" alert; Rotational Motion
  10 MCQs → 10 drafts (7 match, 3 differ), flagged one shows "answered A, but the key says D" and no Approve, Save →
  `approved/teacher_verified`; matched one Approve → `approved/dual_solve_agree`; Laws of Motion numerical → 3
  questions; 2 `usage_records` per generation; 375 px: no sideways scroll; owner@rival.test → 404 on a Demo question.
- Local gate (after `supabase db reset && npm run seed:demo`, port 3000 free): `npm run check` exit 0 — format, lint +
  forbidden, typecheck PASS; unit 151/151; pgTAP Files=15 Tests=1276 PASS; integration 26/26; build + bundle scan
  PASS; E2E 27/27 against the production build (incl. T-SEC-05).
BLOCKED: real-provider quality (agreement rate, teacher rejection rate), cost per question (no key).

### R1 purge of unreachable files (session 20) — MERGED (PR #12, `6f343a0`, CI green run 38896124282)
Scope = "Next exact action" 2b. ADR-031.
Session 21 (2026-10-16): after `supabase db reset && npm run seed:demo` re-check `npm run test:db` → Files=14
Tests=1256 PASS; `npm run test:int` → 26/26. Opened https://github.com/khushpal-cipher/ExamEdge_ai/pull/12.
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
| Invitation emails to anyone but the founder | A domain + Resend domain verification, then `EMAIL_FROM` (Resend test sender only reaches the account owner) — ADR-035 |
| Google sign-in for everyone | Google consent screen is in Testing (only listed test users); publish it, and add the production callback URL when Supabase cloud exists |
| Real AI | Anthropic key (tutor, Studio, OCR and AI bank questions ready); Voyage client not written (Q-08) — RUNBOOKS §5 |

## Failed checks
- None. Note: locally, `e2e/portals.spec.ts:142` (T-SEC-05) fails if Playwright reuses a `next dev` already running on
  :3000 (dev sends `Cache-Control: no-store` without `private`). Before `npm run check`, make sure port 3000 is free
  (`lsof -nP -iTCP:3000 -sTCP:LISTEN`); if another session's dev server holds it, rely on CI for E2E and say so.

## Unresolved decisions
See docs/RISKS_AND_OPEN_QUESTIONS.md §1 (Q-05 resolved). Plan approved for building on 2026-10-15; Q-01 (legal) and Q-08 (Voyage terms) still open.

## Next exact action (session 26)
**Session 25 (2026-10-17), no code changed.** Founder answers: (a) **no new features** — "I don't want anything
already added on, I will test it myself by creating the whole simulation" → the aggregate-counts question is closed
(not built); wait for the founder's own test findings and fix what they report. (b) The two email/Google checks
(item 1 below) are **not tried yet** — still UNVERIFIED. (c) Leftover E2E rows removed with the founder's yes: one
`psql` transaction as `postgres` (aborts unless the counts match) deleted Demo batches `Commerce mvbx3jqy`,
`Commerce mvbx4px9`, `Commerce mvc3qbpz`, subjects `Economics mvbx3jqy`, `Economics mvbx4px9` (no members, documents,
tests or questions) and suspended institutes `gamma-mvc5sira/taw0/ucpx` (no memberships) → `deleted batches=3
subjects=2 institutes=3`; `demo`, `rival`, `sharma`, `v4classes`, `allen` untouched. Their 3 logo files go with the
worker's daily purge (ADR-031) once the worker runs. Note: running the E2E suite locally creates such rows again.

**Session 24 (2026-10-17), no code changed.** Founder asked for a read-only audit of "the three portals" (their prompt
said Flutter; there is no Flutter project on this Mac — this Next.js app is the one). Explained: platform admin
(admin.localhost:3000), staff portal and student portal (same institute address, role decides; `lib/tenant.ts`
`requireMember`, `app/page.tsx` redirect, `(portal)/layout.tsx` menus). Browser check against `next dev` (seeded demo
users only), all as expected, no console/server errors:
- signed out: `/dashboard` `/home` `/people` `/usage` → redirect to `/`; `demo.localhost/platform` 404; unknown host 404.
- owner@demo.test → `/dashboard`; all 7 staff tabs + batch/subject/test/question/student pages 200; sign-out works.
- teacher1@demo.test: 6 tabs (no AI usage), invite role "student" only, sees only JEE 2027 Morning; 404 on `/usage`,
  `/home`, `/progress`, the NEET batch and a Rival subject.
- student01@demo.test → `/home`; menu Home + My progress; 9 staff URLs 404; AI tutor (demo AI) answered with a
  "From your institute's notes … p.1" label (this added one chat for student01); on rival.localhost → "You are not a
  member of this institute".
- platform@examedge.test on admin.localhost → two-factor screen; `/library`, `/institutes/<id>` redirect without aal2.
  Stopped there (enrolling TOTP would change the account). Nothing after TOTP re-verified this session.
- `/tests/<id>/check` is 404 for tests without written questions — by design (link shown only when there are some).
Findings told to the founder: leftover E2E data in the local DB (Demo "Commerce mvbx…" batches, "Economics mvbx…"
subjects, three suspended `gamma-…` institutes); worker not running (new uploads stay queued); a typo in the demo
email creates an empty account (ADR-034); not built vs HOW_IT_WORKS: batch "last active", progress "days active /
notes opened / flashcards reviewed" (no activity tracking in R1), Excel (CSV only), KaTeX, break-glass support access.
Founder thought their platform portal "sees everything" about institutes — explained it cannot see students' data by
design (TH-15). **Open question to the founder:** do they want per-institute aggregate counts (students, batches,
tests, documents; no personal data) on the platform institute page? Product decision — wait for their answer.

`main` = `5fc5051` (+ PROGRESS commits). No open branch, no open PR. Session 23 (2026-10-17): PR #18 merged —
platform "Send new owner invitation" (ADR-036, `reinvite_owner`, migration `20261028000016`) + create form explains
the 3-character address minimum (founder kept the minimum at 3). Applied locally with `supabase migration up` (no reset).

**Local state the founder is using — do NOT run `supabase db reset` / `npm run db:reset` without asking first** (it
wipes their test data): institutes `v4classes` (owner v4classes@gmail.com accepted; teacher khushpal@gmail.com invited),
`sharma` (owner sharma@gmail.com, not accepted), `allen` (owner allen@gmail.com, **accepted** 2026-10-17 09:13 IST via
local email sign-in); founder platform admin `khushalsinghchouhan4@gmail.com` (TOTP enrolled; **signed in with real
Google** 2026-10-17 10:18 IST — `auth.identities` provider `google`, checked in session 24). New migrations: apply with
`supabase migration up` (keeps data).
For the full gate without a reset, rely on CI and say so.

**Founder keys (never print, never commit):** root `.env` = `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID/SECRET` (read by
`supabase start`, so start Supabase from the repo root) + `RESEND_API_KEY`; `apps/web/.env.local` also has
`RESEND_API_KEY`. Both gitignored; `gitleaks dir` flags them (expected), `gitleaks git` must stay clean.

0. Fresh session: `cd ~/Documents/startup/examedge_ai && git checkout main && git pull && npm ci`; `docker info`
   (else `open -a Docker`); `supabase status` (else `supabase start`). Dev server and worker stop when a session ends:
   start the web with preview_start `web`; worker = `npm run dev:worker` with the local env from
   `scripts/local-supabase.ts` `localWorkerEnv` (WORKER_DATABASE_URL, WORKER_STORAGE_EMAIL/PASSWORD, NEXT_PUBLIC_*).
1. Ask the founder how their two pending checks went (UNVERIFIED; in session 23 they had not tried yet):
   (a) invite their Resend sign-up email from V4 Classes → People: email arrives ("emailed" badge);
   (b) open it in a private window → Continue with Google → Accept invitation (that Gmail must be a Google OAuth
   test user). Fix whatever fails; record evidence here.
   Session 24 DB check: Google sign-in itself works (platform admin's account, 10:18 IST); no invitation has been
   accepted through Google yet (the v4classes teacher invite is still pending); delivery of an email not checkable
   from here.
2. Founder can now fix the `sharma` owner email from admin.localhost:3000 → institute → "Owner invitation"
   (`allen` no longer needs it: its owner joined). No other offered feature is pending.
3. Still needs founder decisions/accounts (see Blocked): domain + Resend domain verification (emails to anyone, set
   `EMAIL_FROM`), publish the Google consent screen, Phase 10 cloud parts, Anthropic key, Q-08, Q-01.
4. Any new local task: new branch, tests, `supabase migration up` (no reset), PR, CI green, squash-merge, PROGRESS.
5. Done in session 25 (leftover E2E rows removed). Before any new deletion of local data, ask first.

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
| 25 | 2026-10-17 | Founder: no new features (will test the whole flow themself); email/Google checks not tried yet; leftover E2E rows (3 batches, 2 subjects, 3 gamma institutes) deleted from the local DB with their yes | see `git log` |
| 24 | 2026-10-17 | Read-only check of local state (real Google sign-in works; allen owner had joined). Read-only audit of the three portals + browser check of each role and isolation (no code changed); open question: aggregate counts on the platform institute page | see `git log` |
| 23 | 2026-10-17 | Founder chose: build "Send new owner invitation", keep 3-character address minimum. ADR-036, pgTAP 1303, PR #18 CI green and merged | `5fc5051` |
| 22 | 2026-10-17 | Founder hands-on testing. Merged #14 institute list refresh, #15 delete institute (ADR-033), #16 local demo accounts (ADR-034), #17 Google sign-in + invitation emails (ADR-035); CI green each | `e5ac8f3` |
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
| 20 | 2026-10-16 | Claude OCR provider (ADR-030, PR #11 merged `69d3fc6`); purge of unreachable files (ADR-031) built + gate green, pushed, PR not opened | `2dc2fc7` |
| 21 | 2026-10-16 | Purge re-checked, PR #12 merged (`6f343a0`). Found AC7.5 never built → AI bank questions + blind second solve (ADR-032), gate green (E2E 27/27) | `fa25f32` |
| 15 | 2026-10-16 | Phase 8: library migration + 40 pgTAP (1104 PASS), core two-layer tutor (46 unit), web/platform editor/seed/eval written; AC8.4 library recall 0.81 FAILING (keyword AND), handoff | see `git log` |
| 3 | 2026-10-15 | Phase 1: web skeleton (build OK), pg-boss schema + worker heartbeat (ran OK), logger, lint/format/test configs, forbidden-pattern check (lint OK), bundle scan, gitleaks hook, CI workflow, .env.example. Full gate NOT yet run; nothing pushed before the WIP commit. | see `git log` |
