# ExamEdge AI — Progress

Last updated: 2026-10-16

## Current phase
**Phase 1 MERGED** into `main` (PR #1, merge commit `913ec7f`, CI green: check + secrets, 2026-10-15).
**Phase 2 MERGED** into `main` (PR #2, merge commit `c106364`, CI green: unit 12, pgTAP 334, E2E 6, 2026-10-15).
**Phase 3 MERGED** into `main` (PR #3, squash commit `0417717`, CI green: check + secrets, run 38702576710, 2026-10-15).
**Phase 7 MERGED** into `main` (PR #4, squash commit `2a5f25e`, CI green: check + secrets, run 38711008739, 2026-10-15).
**Phase 4 MERGED** into `main` (PR #5, squash commit `cbfb62e`, CI green: check + secrets, run 38795802409, 2026-10-16).
**Phase 5 (AI gateway, metering, quotas) — IN PROGRESS** on branch `phase-5-ai-gateway` (WIP, pgTAP not green — see In progress).
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
| 2026-10-16 | Phase 4 local gate green | After `supabase db reset && npm run seed:demo`: `npm run check` exit 0 — format, lint + forbidden, typecheck, unit 32/32, pgTAP Files=8 Tests=850 PASS, integration 16/16, build (+bundle scan), E2E 16/16 (commit `ca4b542`). `npm run audit` → ok. Two test fixes found by the gate (no assertion weakened): pgTAP `070` storage fixture inserted objects the seed had already uploaded (duplicate key after seeding) → skips existing objects; platform E2E picked the logo while the "Save limits" redirect was still in flight (re-render emptied the required file input, no POST in the trace) → waits for the POST, reloads, checks the saved value. ADR-024 added; DATABASE_DESIGN §4.3 updated (uploading status, claimed_at, path check, service_accounts). |
| 2026-10-15 | Phase 7 local gate green | After `supabase db reset && npm run seed:demo`: `npm run check` exit 0 — format, lint + forbidden, typecheck, unit 21/21, pgTAP Files=7 Tests=693 PASS, build (+bundle scan), E2E 14/14 incl. `e2e/assessments.spec.ts` (commit `40fc4fc`). `npm run audit` → ok. Browser check (session 7, dev server): teacher1 checked all 22 written answers of "Chemistry Test 3" with names hidden and released (ranks with time tie-break, equal score+time share a rank); student01 started "Physics Practice Test" at 375 px (scrollWidth 375, autosave "Saved"), review + My progress at 375 px; owner JEE rank list, sort links, CSV `private, no-store`; owner@rival.test → 404 for Demo test/check/export, batch export and a real Demo student id. |
| 2026-10-15 | Phase 3 local gate green | After `supabase db reset && npm run seed:demo`: `npm run check` exit 0 — format, lint + forbidden, typecheck, unit 18/18, pgTAP Files=6 Tests=394 PASS, build, E2E 12/12 (commit `9ecd143`). `npm run audit` → ok. Then aal check switched to `getClaims()` (ADR-022): typecheck, format, lint, build, platform E2E 1/1 pass. Fixes: `done()` redirect used `?` twice on `/people?tab=invitations` (flash lost, real bug); E2E waits for client navigation and refills the form React resets. Browser check (session 6): owner dashboard; student01 home + Physics workspace at 375 px, scrollWidth 375; owner@rival.test → Demo subject id 404; admin.localhost sign-in; demo.localhost/platform 404. |

## In progress
### Phase 5 — AI gateway, metering, quotas (session 10, 2026-10-16) — IN PROGRESS (WIP commit, NOT green)
Scope = IMPLEMENTATION_ROADMAP Phase 5. ACs: AC5.1 provider SDKs only in `packages/core/src/ai` (rule already in
`scripts/check-forbidden.ts`, needs evidence only), AC5.2 metered cost ±2 % vs provider tokens (BLOCKED: no key),
AC5.3 limits hold under concurrency, AC5.4 kill switch blocks all AI at once.
VERIFIED: prices on the official pricing page (WebFetch platform.claude.com/docs/en/about-claude/pricing.md, 2026-10-16),
USD per MTok = micro-USD per token: Opus 5.5 in 4 / out 20 / 5-min cache write 5 / cache read 0.20; Sonnet 5.5 2 / 10 /
2.50 / 0.10; Haiku 5.5 0.10 / 0.50 / 0.125 / 0.01, and 0.50 / 2.50 / 0.625 / 0.05 when the prompt (input + cache reads +
cache writes) is over 100,000 tokens; Batch API 50 % off in and out (stacks with cache multipliers). Voyage voyage-4 0.06
(COST_MODEL §1). COST_MODEL already matches these.
WRITTEN, applies (`supabase db reset` OK), NOT tested: `supabase/migrations/20261019000007_usage.sql`:
`usage_records` (append-only, outcome `pending|ok|error|refused|quota_blocked`, `reserved_micro_usd`, `counter_key`,
`job_id`), `usage_counters` (India day), `institute_quotas.ai_enabled`, `private.ai_features` (feature → who
member|worker, student counter, max reserve per call), `private.settings` (global kill switch). Invoker cores
`private.ai_take` (locks the institute_quotas row `for update` = serialises reservations; checks global switch,
institute `ai_enabled`, suspended, monthly budget incl. pending reservations when `hard_stop`, student-only daily
counter via upsert `where value < limit`; writes a `pending` or `quota_blocked` row) and `private.ai_finish` (settles
own pending row once, cost capped at reserved, refunds the counter on `error`). Definers (the only entry points):
`ai_reserve`/`ai_settle` (authenticated, membership via `member_id`), `ai_reserve_job`/`ai_settle_job` (worker only,
institute = `private.job_institute()`), `ai_globally_enabled`, `set_ai_enabled` (aal2 platform admin, audited
`platform.ai_enabled`). Public invoker wrappers: `ai_reserve`, `ai_settle`, `ai_enabled`, `set_ai_enabled`,
`usage_summary(inst)` (this month per feature, RLS decides). Read policies: records owner/admin + platform admin;
counters own row + owner/admin.
FAILING: `supabase test db` → Files=8, Tests=900, "Failed tests: 24-25" (file not identified yet). Most likely
`010_policy_coverage.sql`: the six new SECURITY DEFINER names are not in its allowlist (add `ai_reserve`, `ai_settle`,
`ai_reserve_job`, `ai_settle_job`, `ai_globally_enabled`, `set_ai_enabled`), or `020_isolation_matrix.sql` expectations
for the two new tables. Diagnose one file at a time:
`psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/tests/010_policy_coverage.sql | grep -A8 "not ok"`.
Do NOT use `supabase test db --debug` (it hung for 5 min).
Gotchas found: PL/pgSQL ends an IF condition at the first THEN, so no `case … then` inside `if …` (use a variable);
the Supabase CLI applied the file fine with apostrophes in `--` comments.
Design decisions to record as ADR-025: reserve worst case → call → settle real cost; DB owns feature→counter mapping
and per-call reserve cap (a student calling the RPC with their own token cannot dodge counters or reserve more than
one call costs); daily limits for students only, staff limited by budget; global + per-institute + suspended switches
checked inside every reservation (AC5.4 is immediate); India day/month; **no Anthropic SDK in Phase 5** — the real
provider (streaming, citations) is written in Phase 6 with the tutor using the claude-api skill, so AC5.2 is BLOCKED;
budget alert emails BLOCKED (Resend) → usage page shows a 50/80/100 % banner instead; provider spend limits BLOCKED (no
accounts); per-institute `max_upload_bytes` still not enforced (decide: enforce in `startUpload` or defer to Phase 10).

### Phase 4 — documents (sessions 8–10) — MERGED (PR #5, `cbfb62e`)
Scope = IMPLEMENTATION_ROADMAP Phase 4. ACs: AC4.1 fixture suite, AC4.2 no duplicate chunks, AC4.3 withdraw invisible at
once, AC4.4 cross-tenant job, AC4.5 OCR formula review on real docs (BLOCKED: no AI key, fake OCR), AC4.6 cost per 100 pages
(BLOCKED: fake providers cost 0; measure in Phase 5 with real keys).
DONE + TESTED (commits `49ca6d5`, `3a427c9`):
- Spike → **pdfjs-dist 6.4.299** (Mozilla, Apache-2.0, `npm i -w @examedge/worker pdfjs-dist@6.4.299`): extracts English,
  Hindi (Devanagari) and formula symbols from generated PDFs; empty page → ''; corrupt/empty → InvalidPDFException.
  Not yet recorded as ADR-024 in docs/DECISIONS.md (TODO, with the points below).
- `scripts/make-pdf.ts`: dependency-free PDF writer (Helvetica for ASCII, Type0 + identity ToUnicode for Hindi/symbols,
  `null` page = no text layer) for fixtures and seed.
- Migration `20261018000006_documents.sql`: documents / document_versions (status `uploading|queued|processing|ready|failed`,
  `claimed_at`, path check `= institute/document/version`) / document_audience / document_chunks (vector(1024), tsv, no HNSW)
  + RLS + worker policies (`private.job_institute()`), definers `can_read_document`, `can_read_object`, `pending_jobs` (worker
  only), guards (API users may only queue a version; publish needs a processed version; published_at/withdrawn_at stamped),
  audit on documents/audience, `public.match_chunks` (invoker, exact cosine + keyword, RRF), storage buckets `documents`
  (private, 50 MiB, pdf/png/jpeg) and `logos` (public, platform admin insert) + policies, branding check allows
  `logo = '<institute_id>/<uuid>'`, `private.service_accounts` (worker storage account).
  **Real bug fixed:** deleting an institute failed (ON DELETE RESTRICT test_questions/attempt_answers → questions). Now
  cascade + `guard_question` refuses deleting a used question (23503 `question_used_in_test`) unless its institute is gone.
- pgTAP `070_documents.sql` (55 tests: upload/queue/publish rules, teachers publish only to taught batches, students never
  read versions, AC4.3, T-ISO-06 canary, T-SEC-07 DB side, T-ISO-08, worker account, cascade). Fixture in
  `supabase/test_helpers.sql` now has a published doc + canary chunk per institute; allowlist in `010` updated.
  `supabase db reset && supabase test db` → Files=8, Tests=850, PASS (2026-10-15).
- Core fake AI: `packages/core/src/ai/embed.ts` (hashed bag-of-words 1024-dim, Hindi-safe words; Voyage throws BLOCKED Q-08;
  not metered yet → Phase 5) + `embed.test.ts`; `ai/ocr.ts` (fixed demo placeholder text; real OCR in Phase 5).
- Worker: `chunk.ts` (+test: headings, ≤800 tokens, overlap, long paragraphs), `extract.ts` (magic bytes, 50 MB, 300 pages,
  page-quality → OCR), `ingest.ts` (atomic claim, single swap transaction, failure keeps old version, `drain()`),
  `storage.ts` (downloads as service account, no secret key), `index.ts` (5 s `pending_jobs()` poll → pg-boss queue `ingest`,
  policy stately, singletonKey = version id). Worker env now also needs NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, WORKER_STORAGE_EMAIL, WORKER_STORAGE_PASSWORD (add names to `.env.example` — TODO).
  `scripts/local-supabase.ts`: `LOCAL_WORKER` (worker@examedge.test, local-only password), `ensureWorkerAccount`, `localWorkerEnv`.
- Integration `apps/worker/src/ingest.int.test.ts`: 16/16 PASS (text, scanned, mixed, Hindi+formula, PNG, corrupt, wrong
  magic, PNG-as-JPEG, 301 pages, missing file, 0-byte, AC4.2 duplicate job + reprocess, new version swap, failed version
  keeps old, crashed worker swept, T-ISO-08). Unit 32/32, lint, typecheck PASS at `3a427c9`.
VERIFIED in session 9 (2026-10-15):
- Web UI (`app/(portal)/documents/*`, Sources pane): browser check on the dev server with the real worker running
  (`npm run dev:worker`): teacher1 uploaded a PDF on Physics → signed PUT to Storage worked (no `apikey` header needed,
  no extra select policy needed) → worker processed it → "Ready" → published to JEE 2027 Morning; student01 saw it in
  Sources at 375 px (scrollWidth 375), file route 200 `application/pdf`; staff document page is 404 for students (by
  design, students open `/documents/<id>/file` from Sources); withdraw → file 404 and link gone at once; owner@rival.test
  → 404 for Demo document page and file.
- Seed canary: already fixed in `scripts/seed-demo.ts` (sentence ≥ 50 chars). After `supabase db reset && npm run seed:demo`:
  "Processed 18 documents, published 16"; `document_chunks like '%quokka%'` = 9, all institute `rival` (one per Rival note).
- Env (commit `c5f5215`): `.env.example` has WORKER_STORAGE_EMAIL / WORKER_STORAGE_PASSWORD; CI exports them (local
  worker account values); worker `dev` script reads `apps/web/.env.local` then root `.env.local`. Local root `.env.local`
  (gitignored) holds WORKER_DATABASE_URL + WORKER_STORAGE_* local values.
- `e2e/documents.spec.ts` (commit `6e0ec74`): upload via UI → `drain()` in-process as worker role → Ready → publish →
  student file 200 → withdraw → 404 (AC4.3); Rival owner 404s (AC4.4 web side); raw Storage: Rival student cannot sign or
  download a Demo path; signed URL 200 while fresh, 4xx after expiry (T-SEC-07). `npx playwright test e2e/documents.spec.ts`
  → 2 passed.
- Logo upload (commit `3ca1483`, ADR-022 deferral closed): `/platform/institutes/[id]` "Upload logo" (PNG/JPG/WebP ≤ 500 KB
  so it fits the 1 MB Server Action body limit; bucket `logos` public, insert only by aal2 platform admin), path stored in
  `branding.logo`; `updateInstitute` now keeps the logo (it used to overwrite branding with `{color}`); portal header shows
  the logo instead of initials (`lib/brand.ts` `logoUrl`). Shortcut: replaced logos stay in the bucket (purge in Phase 10).
  E2E platform test extended (SVG refused, PNG saved, public URL 200, logo kept after Save institute) → 1 passed. Header
  checked in the browser with a temporary Demo logo (img loaded), then removed. Unit 32/32 PASS, web lint/typecheck PASS.
Full gate GREEN locally on 2026-10-16 (see Completed). CI on PR #5 green (run 38795802409), merged 2026-10-16.

### Phase 7 — tests, checking, ranks, progress (sessions 6–7) — MERGED (PR #4, `2a5f25e`)
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
0. If this is a fresh machine/session after a long pause: `cd ~/Documents/startup/examedge_ai && git checkout phase-5-ai-gateway
   && git pull && npm ci && git config core.hooksPath .githooks`; `docker info` (else `open -a Docker` and wait);
   `supabase start`; recreate the gitignored local env files if missing: `apps/web/.env.local` (NEXT_PUBLIC_SUPABASE_URL,
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY from `supabase status -o env`, DEMO_LOGIN_ENABLED=true) and root `.env.local`
   (WORKER_DATABASE_URL=postgresql://worker:worker_local_only@127.0.0.1:54322/postgres, WORKER_STORAGE_EMAIL /
   WORKER_STORAGE_PASSWORD = `LOCAL_WORKER` in `scripts/local-supabase.ts`). If tool versions changed (Node, Supabase CLI,
   Docker), check `supabase --version` matches CI (2.121.0) or update CI to match.
1. Make pgTAP green again (see Phase 5 FAILING above), then write `supabase/tests/080_usage.sql`: counters stop at the
   limit and only for students; staff not counted; budget hard stop (and not when `hard_stop=false`); global switch,
   institute `ai_enabled` and suspended → `ai_disabled`; unknown feature / worker feature from a member / reserve
   above cap → error; Rival member reserving for Demo → `not_allowed`; worker with Demo context reserving → Demo row,
   no context → error; settle only own pending row once, cost capped, error refunds counter; students/teachers read no
   usage_records and cannot insert/update/delete either table; owner reads own institute only; `set_ai_enabled` only aal2
   platform admin and audited. Commit.
2. Core gateway in `packages/core/src/ai/`: `routing.ts` (feature → model, price table above, `cost()` in micro-USD
   rounded up, Haiku long tier, batch flag) + `gateway.ts` (`Meter` interface {reserve, settle}; reserve worst-case cost
   from an upper-bound token estimate (UTF-8 bytes) → `AiBlocked(reason)` if blocked → run provider → settle real
   usage, settle `error` on throw); fake provider records provider='fake', cost 0, token estimate chars/4. Route
   `embed()` (features `ingest_embed`/`query_embed`) and `ocrPages()` (`ingest_ocr`) through it. Unit tests: cost math vs
   hand-computed fixtures, blocked → provider never called, error → settled as error. Remove the "not metered yet"
   shortcut comments in `embed.ts`/`ocr.ts`.
3. Worker: `workerMeter(pool, institute)` next to `inTenant` in `apps/worker/src/ingest.ts` (each reserve/settle in its
   own short `inTenant` transaction so a failed ingest keeps its usage rows); pass it to `readPages` and `embed`
   (job_id = version id); `AiBlocked` → `IngestError('ai_unavailable')` and add that code to `ERROR_TEXT` in
   `apps/web/app/(portal)/documents/status.ts`. Update `ingest.int.test.ts` (usage rows per ingested version) and add
   `apps/worker/src/usage.int.test.ts`: 100 parallel `rpc('ai_reserve')` as a seeded student (supabase-js, limit set to
   40) → exactly 40 ok; 100 parallel `ai_reserve_job` with a small budget → sum of reserved never above budget (AC5.3).
4. Web (read node_modules/next/dist/docs first): owner/admin `/usage` page in `app/(portal)` (month spend vs budget with
   50/80/100 % banner, `usage_summary` table, AI on/off state) + nav link for owner/admin; platform admin: global AI
   switch on `/platform` (`set_ai_enabled`), "AI enabled" checkbox in the usage-limits form (add `ai_enabled` to
   `updateQuotas`), month spend on `/platform/institutes/[id]`. E2E: owner sees usage page; platform admin turns AI off for
   the new Gamma institute only (never toggle the global switch in E2E — other specs run the worker in parallel). Browser
   check incl. global switch (turn it back on afterwards).
5. ADR-025 in docs/DECISIONS.md, DATABASE_DESIGN §4.6 (outcome `pending`, reserved, counter_key, ai_features, settings,
   ai_enabled), then gate: `supabase db reset && npm run seed:demo && npm run check`, `npm run audit`; record evidence;
   PR `phase-5-ai-gateway` → `main`, CI green, merge. Then Phase 6 (tutor; claude-api skill before any SDK code).

## Relevant files and commands
- Plan entry point: `docs/PROJECT_MASTER_PLAN.md`
- Roadmap and acceptance criteria: `docs/IMPLEMENTATION_ROADMAP.md`
- Commands: `supabase start` / `supabase status` / `supabase test db`; scripts in root `package.json`.
- Local Supabase: API http://127.0.0.1:54321, DB postgresql://postgres:postgres@127.0.0.1:54322/postgres (local defaults; keys via `supabase status -o env`, never commit them).
- `@axe-core/playwright` 4.13.0 (session 5, `npm i -D`).
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
| 9 | 2026-10-15 | Phase 4 web UI browser-verified, worker env/CI, `e2e/documents.spec.ts`, logo upload; founder pausing subscription — handoff written | see `git log` |
| 10 | 2026-10-16 | ADR-024, Phase 4 full gate green (2 test-fixture races fixed), PR #5 merged (`cbfb62e`); Phase 5 prices verified, usage migration written (pgTAP 2 failing, WIP) | see `git log` |
| 3 | 2026-10-15 | Phase 1: web skeleton (build OK), pg-boss schema + worker heartbeat (ran OK), logger, lint/format/test configs, forbidden-pattern check (lint OK), bundle scan, gitleaks hook, CI workflow, .env.example. Full gate NOT yet run; nothing pushed before the WIP commit. | see `git log` |
