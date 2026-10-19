# ExamEdge AI — Decision Log

Status: **Draft for approval** · Last updated: 2026-10-14 · Labels: see [ARCHITECTURE.md](ARCHITECTURE.md) header.
Format per decision: **Decision · Alternatives · Why · Disadvantages · Operational cost · Revisit when.** Status: Proposed (awaiting founder approval) unless noted.

### ADR-001 Tenancy: shared app + shared DB with RLS, built "cell-ready"
- **Decision:** one Next.js app and one Supabase project ("cell `main`") for all institutes; logical isolation (RLS + composite FKs + tenant-scoped storage/jobs); schema rules that allow moving an institute to its own cell later.
- **Alternatives:** separate DB per institute; dedicated infra per institute; hybrid with per-tenant schemas.
- **Why:** lowest cost and ops load for a solo founder; Postgres RLS is enforced below the application; cell-readiness keeps the enterprise path open.
- **Disadvantages:** a policy bug can expose tenants (mitigated by isolation test gate); noisy neighbours share one DB (quotas, concurrency limits).
- **Cost:** one Supabase project per environment (COST_MODEL §4).
- **Revisit when:** an enterprise contract requires physical isolation, a tenant exceeds ~20 % of DB load, or data-residency contracts demand it.

### ADR-002 Core platform: Supabase (Postgres, Auth, Storage) in ap-south-1
- **Alternatives:** Neon/RDS Postgres + Clerk/Auth.js + S3 (more vendors, more glue); Firebase (no relational constraints/RLS-style SQL; harder reporting); self-hosted Postgres (ops burden).
- **Why:** one vendor covers DB + auth + storage with RLS integrated into all three; Mumbai region available [V]; daily backups on Pro [V]; local dev stack via CLI.
- **Disadvantages:** vendor coupling (Auth + Storage APIs); storage files not in DB backups [V] → separate backup job; built-in SMTP unusable for production [V] (we send our own emails).
- **Cost:** Pro $25/month + compute (Small $15) per production project [V].
- **Revisit when:** compute cost exceeds a self-managed Postgres by > 2× at scenario C, or required features are missing.

### ADR-003 Application stack: TypeScript, Next.js on Vercel, Node worker on Railway
- **Alternatives:** Python FastAPI + React SPA (founder's GeM project uses FastAPI — familiar), Remix, Django.
- **Why:** one language for web, worker and shared schemas (zod) reduces duplication; Supabase/Next.js integration is first-party; Vercel handles TLS for wildcard subdomains; Remotion (R3) is TypeScript. Python is added only for Manim in R3, isolated in the render container.
- **Disadvantages:** founder appears more practised in Python; Next.js caching semantics need care (TH-05); Vercel function limits (300 s default/800 s max, 4.5 MB body [V]) → long work in worker.
- **Cost:** Vercel Pro $20/seat [V] (Hobby forbids commercial use [V]); Railway Hobby/Pro $5–20 + usage [V].
- **Revisit when:** Vercel cost > ~$300/month without matching value, or the founder strongly prefers Python (then FastAPI + React with the same DB design is viable).

### ADR-004 Identity and membership
- **Decision:** Google OAuth through Supabase Auth; membership only via invitation acceptance whose email equals the verified Google email; membership read from the DB on every request, **not** cached in JWT claims; host-only session cookies per subdomain.
- **Alternatives:** custom access-token hook adding institute claims [V: possible] (stale until refresh); join codes (R2, with approval); parent-domain cookies.
- **Why:** removes stale-claim and auto-join risks.
- **Disadvantages:** students without Google accounts cannot join (Q-04); a per-request membership lookup (indexed, cached per statement).
- **Revisit when:** many students lack Google accounts → add phone OTP.

### ADR-005 No privileged credentials in request paths
- **Decision:** web uses the user's JWT only; worker uses a custom `worker` role subject to RLS with transaction-local tenant context; the Supabase secret key is used only by ops scripts.
- **Why:** the secret key bypasses RLS [V]; removing it from runtime removes a whole class of leaks.
- **Disadvantages:** some admin operations need SECURITY DEFINER RPCs (allowlisted, tested).

### ADR-006 Retrieval: pgvector + Postgres full-text, Voyage embeddings
- **Decision:** tenant chunks searched with exact distance over the pre-filtered (institute, subject, readable docs) set + keyword search, fused by RRF; library chunks use HNSW with iterative scans [V]; `voyage-4` 1024-dim; rerank only if the eval proves it helps.
- **Alternatives:** Pinecone/Qdrant/Weaviate (separate isolation model, another vendor); OpenAI embeddings; one shared HNSW index with filters (loses recall under selective filters and couples tenants [V]).
- **Why:** same RLS as the rest of the data; no extra vendor.
- **Disadvantages:** exact search cost grows with a tenant's subject size → add partial/partitioned HNSW above ~100K chunks per tenant [E]. Voyage data-use policy unverified (Q-08); Hindi quality unverified.
- **Cost:** ≈ $0.06/MTok embeddings [V]; first 200M tokens free [V].
- **Revisit when:** Q-08 fails (switch provider), or Hindi retrieval eval < target.

### ADR-007 Background jobs: pg-boss in Postgres + one worker service
- **Alternatives:** Inngest / Trigger.dev (managed, extra vendor + keys), Supabase Queues (pgmq, fewer features), Vercel Workflows.
- **Why:** retries with backoff, dead-letter, cron, priority [V pg-boss README]; jobs live next to our data; a container is needed anyway for R2/R3 media work.
- **Disadvantages:** we operate the worker; pg-boss + transaction pooler compatibility **unverified** → worker uses a session/direct connection for pg-boss and transaction-local tenant settings for data access [U: verify in Phase 1].
- **Revisit when:** queue throughput or ops burden becomes significant.

### ADR-008 LLMs: Claude family with per-feature routing
- **Decision:** Haiku 5.5 (tutor default, effort low), Sonnet 5.5 (escalation, grading assist, summaries, dual-solve), Opus 5.5 (authoring, never student-triggered), Batch API for non-urgent work.
- **Alternatives:** Gemini or OpenAI models (comparable capability; not price-verified in this session), multi-vendor routing from day one.
- **Why:** verified prices [V]; native citations via `search_result` blocks [V]; PDF input [V]; one vendor = one key per env.
- **Disadvantages:** single-vendor dependency (outage/price change). Mitigation: routing config isolates model ids; a second vendor can be added behind the gateway.
- **Revisit when:** eval shows quality gaps for Indian languages, or cost per student exceeds the pricing model.

### ADR-009 AI gateway module as the only path to providers
- **Why:** metering, quotas, tenant assertions, kill switch and logging in one place; lint rule forbids provider SDK imports elsewhere.

### ADR-010 Two knowledge layers; no automatic copying into the library
- **Decision:** library = ExamEdge-owned, expert-reviewed, provenance recorded; institute content never flows into the library or another institute.
- **Why:** privacy, copyright, competitive trust between institutes.

### ADR-011 Media: code-driven video, Sarvam TTS (R2/R3)
- **Decision:** Remotion + Manim + ffmpeg for video; Sarvam Bulbul for Indian-language speech.
- **Alternatives:** generative video models (inaccurate text/formulas, high cost), ElevenLabs/Google TTS (not price-verified here).
- **Disadvantages:** Remotion company licence cost [U]; Sarvam single-speaker requests [V]; bandwidth cost of video delivery.

### ADR-012 Assessment integrity
- **Decision:** answer keys in a separate table with no student policy; DB-clock deadlines in RPCs; server-side grading; ranks computed once at release and stored; questions immutable once used.

### ADR-016 Mixed tests, manual theory checking, two ranks (founder decision, 2026-10-15)
- **Decision:** a test can mix MCQs, numerical and written (theory) questions. Objective parts are marked automatically; every written answer is marked by a teacher, because correct answers can differ from both the model answer and the AI's answer. Totals and ranks are computed only after all written answers are checked and the teacher releases results. Two ranks: **test rank** and **overall rank** (average percentage across the batch's institute tests, missed test = 0 %; Q-05, founder decision 2026-10-15). Practice quizzes never affect rank. Each student has a full progress page, visible to their teachers and to the student.
- **Why:** founder requirement; teacher judgement is the fair standard for theory answers.
- **Changes from earlier plan:** written answers moved from R2 to R1 (Phase 7); AI marking becomes an optional R2 helper only.

### ADR-013 Pilot billing is manual
- **Decision:** invoices outside the product during the pilot; Razorpay Subscriptions (UPI AutoPay/cards/eMandate [V]) in R2 after price validation.

### ADR-014 Regions
- **Decision:** Supabase ap-south-1 Mumbai [V]; Vercel functions pinned near Mumbai (`bom1` [U]); worker region close to Mumbai [U].
- **Revisit when:** latency measurements in Phase 1 contradict.

### ADR-015 Staff visibility of student AI chats
- **Decision (provisional):** staff see aggregates only (topics, counts), not chat text. Pending Q-03 and legal advice.

### ADR-017 Error tracking: JSON logger now, Sentry when an account exists (2026-10-15, Accepted)
- **Decision:** Phase 1 ships the PII-scrubbing JSON logger (`packages/core/src/log.ts`) only. Sentry (AC1.5) is BLOCKED until the founder approves creating a Sentry account.
- **Why:** creating online accounts needs founder approval; the logger already enforces the "no PII in logs" rule.
- **Revisit when:** the founder approves Sentry (free tier) — add `@sentry/nextjs` + `@sentry/node` with a `beforeSend` scrubber reusing `scrub()`.

### ADR-018 Staging deploy deferred (2026-10-15, Accepted)
- **Decision:** AC1.4 (staging health URL), AC1.6 (CI applies migrations to staging) are BLOCKED until the founder approves Supabase cloud, Vercel and Railway accounts. Everything is verified locally and in GitHub Actions against a local Supabase stack.
- **Revisit when:** the founder approves accounts (needed before Phase 10 at the latest).

### ADR-019 Grants on schema `private` and explicit table grants (2026-10-15, Accepted)
- **Decision:** RLS policies run as the caller, so helper functions in `private` need `grant usage on schema private to authenticated` plus `grant execute` on each helper only. `private` stays out of the exposed API schemas (`supabase/config.toml` `schemas`), its tables get no grants for `anon`/`authenticated`, and each helper is SECURITY DEFINER with `search_path = ''`. The smoke test asserts these real properties instead of "no usage on private".
- **Fact found (local stack, CLI 2.121.0):** with `auto_expose_new_tables = false`, new `public` tables owned by `postgres` grant `anon`/`authenticated` only TRUNCATE/REFERENCES/TRIGGER/MAINTAIN by default, and new functions grant no PUBLIC execute (`select * from pg_default_acl`). So every exposed table needs explicit `grant select/insert/update/delete` per role, and migrations `revoke truncate, references, trigger on all tables in schema public from anon, authenticated` (TRUNCATE ignores RLS).
- **Why:** least privilege; a missing grant fails closed.

### ADR-020 Development-only demo sign-in (2026-10-15, Accepted)
- **Decision:** with no Google OAuth client yet (BLOCKED, founder approval), local dev, CI and E2E sign in seeded users with "Sign in as demo user": server action `signInDemo` calls `signInWithPassword` with a fixed local password (`packages/core/src/demo.ts`). It works only when `DEMO_LOGIN_ENABLED=true` **and** `NEXT_PUBLIC_SUPABASE_URL` is `127.0.0.1`/`localhost` (unit-tested), so it can never run against a cloud project. Invitation emails (Resend) are BLOCKED: the admin is shown the invite link once (`create_invitation` returns the raw token; only its SHA-256 is stored).
- **Revisit when:** Google OAuth credentials and a Resend account are approved — enable `[auth.external.google]` in `supabase/config.toml` and send links from the worker.

### ADR-021 Phase 2 schema refinements (2026-10-15, Accepted)
- **citext → lowercase-checked text** for `institutes.slug`, `institute_domains.hostname`, `invitations.email`: citext operators live in schema `extensions`, so inside `search_path = ''` definer functions `=` would silently become a case-sensitive text comparison. Values are normalised with `lower(trim())` and check constraints.
- **`platform_admins` lives in schema `private`** (never exposed); `private.is_platform_admin()` also requires an MFA session (`aal = aal2`), which enforces AC2.7 in the database.
- **`audit_events.institute_id` has no FK** so audit rows survive institute deletion (DATABASE_DESIGN §7). An audit trigger covers memberships, batch members and invitations (ids/roles only; emails and token hashes are stripped).
- **Owner/admin changes are owner-only** (trigger), and `invitations.token_hash` is not selectable by any API role (column grants). A revoked invitation cannot be un-revoked (policy check).
- **Tenant host:** the web app reads `x-forwarded-host` before `host` (Next dev server actions and Vercel put the client host there). A spoofed value only changes which institute context is rendered; RLS still requires membership and session cookies are host-only.
- **Invite creation UI** (single + CSV) is built with the Phase 3 institute dashboard; Phase 2 delivers the RPC, accept page and pgTAP/E2E proof.

### ADR-022 Phase 3 refinements (2026-10-15, Accepted)
- **`institute_quotas` created in Phase 3** (one default row per institute via trigger) so the platform admin can set limits now; Phase 5 enforces them in the AI gateway.
- **Platform admin host:** `proxy.ts` rewrites `admin.<root>` to `/platform` and returns 404 for `/platform` on any other host. Pages and Server Functions read the MFA level from verified JWT claims (`getClaims().aal`), never from the unverified cookie session; the database re-checks `aal2` in every policy and RPC.
- **Contrast tokens:** text on the accent colour uses dark ink (`--on-accent`), and `--good`/`--bad` were darkened, so axe reports no serious colour-contrast issues (AC3.3). Institute brand colour picks black or white text by contrast (`lib/brand.ts`).
- **Logo upload deferred to Phase 4** (needs Storage); branding is colour only (`{"color":"#rrggbb"}` check constraint).

### ADR-023 Phase 7 refinements: tests, checking and ranks (2026-10-15, Accepted)
- **Test statuses** are `draft | scheduled | results_released | cancelled`. "Open", "closed" and "waiting for checking" are derived from `opens_at`/`closes_at` and unmarked written answers, so no job has to flip statuses at the right second (DATABASE_DESIGN's `closed`/`grading` are not stored).
- **Release is a manual click** by owner/admin or a teacher of every batch of the test (`results_release_at` = release time). Releasing again = "Recalculate" after fixing an answer key. Changing a mark after release recalculates both ranks at once.
- **Marking:** objective answers are re-graded from the current keys on every release/recalculate unless a teacher set the marks; multi-correct = exact set, no partial marks; blank = 0; numerical tolerance absolute or percentage of |value|; written answers 0..max in half marks.
- **Students read no questions, keys or answers directly** — only through `get_attempt_questions` / `get_attempt_review` (after release). Score and rank stay null until release. Students see their own `batch_standings` row only; teachers see their batches.
- **PostgREST shape:** `question_keys` has `unique (institute_id, question_id)` so the composite FK is one-to-one and embeds return one object. The `tests` read policy checks owner/admin/creator inline because `can_see_test(id)` cannot see a row inside its own `insert … returning`.
- **Times are entered and shown in India time** (shortcut in `lib/assess.ts`; per-institute timezone later).
- **Deferred:** student practice quizzes → Phase 9 (Studio); AI question generation + dual-solve (AC7.5) → after Phase 5 (built: ADR-032); AC7.4 (500 concurrent starts, p95 < 2 s) → BLOCKED until a staging/prod-sized database exists (a laptop run would not prove the target; measured with k6 in Phase 10, AC10.3).

### ADR-024 Phase 4 refinements: documents and ingestion (2026-10-16, Accepted)
- **Text extraction: `pdfjs-dist` 6.4.299** (Mozilla, Apache-2.0) in the worker, picked in the Phase 4 spike: it extracts English, Hindi (Devanagari) and formula symbols from generated PDFs, returns `''` for image-only pages and throws `InvalidPDFException` on corrupt/empty files. Test PDFs come from the dependency-free `scripts/make-pdf.ts`.
- **Upload flow:** the server action inserts `documents` + `document_versions` with `processing_status='uploading'` and returns a signed upload URL; the browser PUTs the file straight to the private `documents` bucket (the file never passes the web server, R-04). Storage insert is allowed only for an object whose version is still `uploading`. Confirm = the user moves the version to `queued`; that is the only status change an API user may make (trigger). Path = `{institute_id}/{document_id}/{version_id}` (check constraint, stricter than "starts with institute_id").
- **Web never enqueues jobs.** The worker polls `private.pending_jobs()` (definer, worker only) every 5 s and sends pg-boss jobs to queue `ingest` (policy `stately`, `singletonKey` = version id). The same poll is the sweeper: versions stuck in `processing` for > 30 min (`claimed_at`) are picked up again. Claim and chunk swap are idempotent; a failed version keeps the previous version live.
- **Worker storage service account:** a dedicated Supabase Auth user listed in `private.service_accounts` downloads files; its storage policy only reads objects whose version is `queued|processing`. No secret key in the worker (ADR-005).
- **Fake OCR and embeddings** (`packages/core/src/ai/`) are not metered yet; metering and quotas arrive with the gateway in Phase 5. AC4.5 (OCR formula review) and AC4.6 (cost per 100 pages) are BLOCKED until real keys exist.
- **Limits:** bucket cap 50 MiB, 300 pages (worker). Per-institute `institute_quotas.max_upload_bytes` is not enforced yet (Phase 5 with the other quotas).
- **Students never open the staff document page;** they open `/documents/<id>/file`, which re-checks access through RLS and redirects to a 5-minute signed URL. Withdraw/delete stops minting at once (AC4.3).
- **Institute delete cascade fix:** `test_questions`/`attempt_answers` → `questions` were `ON DELETE RESTRICT`, so deleting an institute failed. Now cascade, and `guard_question` refuses deleting a question used by a non-draft test (`question_used_in_test`) unless its institute is being deleted.
- **Logo upload** (closes the ADR-022 deferral): platform admin uploads PNG/JPG/WebP ≤ 500 KB through a Server Action (fits the 1 MB body limit) to the public `logos` bucket (insert only by aal2 platform admin); `branding.logo = '<institute_id>/<uuid>'`. Replaced logos stay in the bucket until the Phase 10 purge job.

### ADR-025 Phase 5: AI metering, quotas and kill switches (2026-10-16, Accepted)
- **Reserve → call → settle.** The gateway (`packages/core/src/ai/gateway.ts`, `metered()`) first reserves the call's worst-case cost (upper-bound token estimate: UTF-8 bytes of the input + the call's max output) through `ai_reserve` (web, user's session) or `ai_reserve_job` (worker, institute = the job's tenant context, never a parameter). The database checks the global switch, the institute's `ai_enabled`, suspension, the monthly budget (pending reservations count) and the student's daily counter in one transaction that locks the institute's `institute_quotas` row, so parallel calls can never overshoot (AC5.3, proven with 100 parallel calls). Blocked → `AiBlocked(reason)` and the provider is never called. After the call the real cost is settled once, capped at the reservation; a failed call settles as `error` and gives the student's counter back.
- **The database owns the rules.** `private.ai_features` maps each feature to who may call it (member or worker), its counter and a per-call reserve cap, so a student calling the RPC with their own token cannot pick a cheaper counter, reserve more than one call costs, or use worker features. Record ids are random and students cannot read `usage_records`, so a student cannot settle (or refund) the server's in-flight call.
- **Daily limits are for students only**; staff are limited by the institute budget. Days and months are India time (like test times, ADR-023).
- **Kill switches act on the next call (AC5.4):** platform-wide `private.settings.ai_enabled` (aal2 platform admin via `set_ai_enabled`, audited as `platform.ai_enabled`), per-institute `institute_quotas.ai_enabled` (platform admin form), and institute suspension. A blocked ingestion fails with `ai_unavailable`.
- **Prices** live in `packages/core/src/ai/routing.ts` as integer micro-USD per 1,000 tokens (verified 2026-10-16), incl. Haiku's long-prompt tier and the Batch discount; fake models cost 0 but still write usage rows with token estimates.
- **`safeupdate`:** PostgREST sessions on Supabase load `safeupdate`, which refuses UPDATE/DELETE without WHERE (SQLSTATE 21000) even inside definer functions; pgTAP cannot load it, so the kill switch is also tested through the API (`apps/worker/src/usage.int.test.ts`).
- **Deferred / BLOCKED:** no Anthropic SDK yet — the real provider (streaming, citations, refusals) is written with the tutor in Phase 6 using the claude-api skill, so AC5.2 (metered cost ±2 % vs provider tokens) is BLOCKED (no key). Budget alert emails BLOCKED (Resend) → the owner's AI usage page shows a 50/80/100 % banner. Provider spend limits BLOCKED (no accounts). Per-institute `max_upload_bytes`, `max_storage_bytes` and `max_concurrent_jobs` are stored but not enforced yet → Phase 10 (bucket cap 50 MiB applies meanwhile).

### ADR-026 Phase 6: source-grounded AI tutor (2026-10-16, Accepted)
- **Labels come from citations, never from the model.** Passages go to Claude as `search_result` blocks with citations on; `assemble()` numbers cited pages (one citation per document page) and a paragraph with a citation is "From your institute's notes: <title>, p.N" (links to `/documents/<id>/file#page=N`), anything uncited is "General explanation". A segment's citations attach only to its first non-empty paragraph. No passage at all → the answer is labelled general; the relevance threshold of AI_PIPELINE §4.8 is deferred until real embeddings exist (the eval records `top_similarity` to pick it).
- **Streaming route** `POST /api/tutor` (NDJSON `delta` / `done` / `error`), institute from the host, every read and write with the user's own session (RLS bounds retrieval), metered through `ai_reserve`/`ai_settle` in the user's session. The `Origin` host must equal the request host (403 `bad_origin`) because route handlers do not get the Server Action origin check. Responses are `private, no-store`.
- **The chat is saved only after an answer exists** (conversation + question + answer), so a blocked or failed question is not counted as a doubt and nothing half-written is stored.
- **Defence in depth (TH-06):** `tutorAnswer` throws `tenant_mismatch` if any retrieved passage's `institute_id` differs from the host's institute. AC6.4 is proven by `apps/web/lib/retrieval.int.test.ts` (1,000 PostgREST calls as A's student, 0 passages from B).
- **Safe Markdown without KaTeX:** `lib/markdown.ts` builds React elements only (no `dangerouslySetInnerHTML`); images become their alt text, links their label, raw HTML is shown as text; `$…$` is shown as code. KaTeX is deferred (shortcut noted in the file). T-SEC-19 (20 XSS payloads) and T-AI-09 (20 injection passages with the demo provider) are unit tests.
- **Staff see reports, not chats (ADR-015):** conversations/messages are owner-only. Tapping Report copies the question + answer into `answer_reports` via definer `report_answer`; staff read and resolve reports but never see who reported (no column grant on `reported_by`). Progress pages show doubts per subject (counts only) via `tutor_activity`.
- **Premium ("Solve step by step") only through the button** (Sonnet, `tutor_premium` counter). The numerical/derivation auto-detect heuristic and the gateway's "retry once on Sonnet after a Haiku refusal" are deferred until real-model evals show they are needed; a refusal shows a fixed friendly text.
- **Demo provider:** the fake tutor answers with the retrieved sentences that best match the question, each cited to its passage, so labels, citations, metering and storage run the real code paths. Retrieval eval: `npm run eval -- <change>` (golden set `evals/datasets/demo-retrieval.json`, results in `evals/results/`).
- **Deferred / BLOCKED:** rerank experiment (needs real embeddings, ADR-006); AC6.1 real recall threshold and the pilot golden set; AC6.2 citation support, AC6.3 human-graded correctness, AC6.5 p95 first token on staging, AC6.6 cost per answer — all need an Anthropic key and/or staging (founder approval). Conversations have no `deleted_at` (students delete chats outright; retention job in Phase 10).

### ADR-027 Phase 8: shared library engine and pilot seed (2026-10-16, Accepted)
- **Pilot library = JEE Main Physics** (Q-02 documented default; founder can change it later without code changes). The full chapter list follows the NTA syllabus [U: re-check against the current NTA bulletin before the pilot]; topics with a reviewed explanation + formula sheet exist only for the four chapters the demo notes cover (Units and Measurements, Laws of Motion, Rotational Motion, Gravitation). AC8.1 is PARTIAL: the rest needs Opus generation (no key) and an expert reviewer (not hired) — BLOCKED.
- **Reviewer = an aal2 platform admin** (no subject expert hired yet). The database enforces the workflow: a new item is always a `draft` by its author (trigger), `reviewed` stamps `reviewed_by` = the caller (no column grant, cannot be forged), `status <> 'draft'` requires `reviewed_by` + `reviewed_at` (check), changing text/kind/topic sends the item back to `draft` with `version + 1`, and `publish_library_item` (definer, audited `library.publish`) refuses a draft (AC8.2). `provenance` is `not null` (AC8.3). No four-eyes rule yet: the author may review their own item — revisit when a reviewer is hired.
- **Text kinds only** (`explanation | formula_sheet | worked_example`); `question` and `flashcard_set` wait for Studio/generation (Phase 9+).
- **Retrieval:** `library_chunks` carries the library subject (denormalised) and an HNSW cosine index (one shared, non-tenant corpus, ADR-006); `match_library_chunks` = same hybrid as `match_chunks` with `hnsw.iterative_scan = relaxed_order`. Institutes opt in per subject (`subjects.library_subject_id`, owner/admin). The tutor embeds the question once, searches both layers and keeps the top 8 by fused score with at most 6 from either layer (`mergeLayers`); library passages go to Claude as `lib:<item>` with title "ExamEdge library: <topic>" and their chips open `/library/<item>` (published items only, RLS). Prompt version `tutor-v2`.
- **Keyword half = OR of content words.** `websearch_to_tsquery` ANDed every word incl. "what/is/the", so most natural questions had no keyword match and only the vector half ranked (library recall@8 0.81, AC8.4 failing). `private.keyword_query(q)` ORs the question's words after dropping English stop words (`ts_lexize('english_stem', w) = '{}'`); both `match_chunks` and `match_library_chunks` use it (migration `20261022000010`). Demo eval: recall@8 1.0 on notes and on 21 library questions. Hinglish stop words ("kya", "hai") are not dropped — revisit with real embeddings and a pilot golden set.
- **Platform metering:** library work belongs to no institute, so `usage_records.institute_id` is nullable for feature `library_embed` (who `platform`), reserved/settled by `ai_reserve_platform` / `ai_settle_platform` (aal2 platform admin); the global kill switch applies; there is no platform budget (provider spend limits, BLOCKED with the accounts). Only platform admins read these rows.
- **Demo seed:** original text written for the seed, provenance says it is NOT expert-reviewed (demo use only); published with `reviewed_by` = the seed's platform admin; Demo Physics is mapped, Rival is not.
- **Deferred / BLOCKED:** Batch-API generation with Opus (no key); expert review of the seed; KaTeX (formulas shown as code, ADR-026); library content-error queue (students' Report goes to their institute's teachers, not to ExamEdge, for now).

### ADR-028 Phase 9: Studio basics (2026-10-16, Accepted)
- **Scope:** summary, flashcards, mind map and practice quiz (`study_guide` = summary; tables/slides/audio/video later). Each is made from **one chapter's published notes** (chunks of `documents.status = 'published'` read in the caller's session, so a student only uses notes published to their batches). The library layer is not used by Studio yet.
- **Synchronous Server Action, not a worker job.** `generate` reserves through the gateway (`feature = generation`, counter `generations`), calls the provider and stores the artifact in one request. shortcut: a real Sonnet summary may take 20–60 s; move generation to a pg-boss job with a "generating" status when the real provider is switched on.
- **Reuse (AC9.2):** `input_hash = sha256([kind, chapter, sorted chunk ids])` + `prompt_version`; a matching institute artifact (or the student's own) is returned before any reservation, so no usage row. Chunk ids change when a note is replaced, so new notes give a new artifact. Partial unique indexes make two simultaneous clicks store one row (the loser redirects to it).
- **Schema and citations (AC9.1, AC9.3):** zod schemas in `packages/core/src/ai/studio.ts` are both the validator and Claude's structured-output schema (`client.beta.messages.parse`); sources are numbered in the prompt because API citations cannot be combined with structured outputs, and `validateArtifact` rejects any citation index ≥ the number of sources, a quiz answer that is not one of its options, or a mind map over 60 nodes. Every section/card/branch/question cites ≥ 1 source. Sonnet for summaries, Haiku for the others; real provider BLOCKED (no key), tested against a recorded response.
- **Approval:** institute artifacts are always inserted as `draft` (trigger), staff edit text only (shape and citations kept, validated again; an edit returns it to draft), and `published` needs ≥ 1 row in `artifact_audience` (a table with composite FKs instead of `audience_batch_ids uuid[]`, so batches cannot cross tenants; teachers may only add batches they teach). Statuses: `draft | published | withdrawn` (`generating/failed` unnecessary while generation is synchronous).
- **Student artifacts are private (AC9.4):** `owner_scope = 'student'` rows are readable only by `owner_user_id` (set by the trigger, never the caller) — not by classmates, teachers, owners or other institutes; staff see practice counts/averages only via `practice_activity` (definer, same callers as `tutor_activity`).
- **Practice quizzes graded in SQL:** `submit_practice` (definer) grades against the stored quiz and writes `practice_attempts` (no insert grant); quiz runner gets questions without answers, explanations come back after grading. A student can still read their own quiz's answers through the API — accepted: practice never counts for rank. Demo quizzes are fill-in-the-blank from note sentences.
- **Mind map** is rendered as a nested list (depth ≤ 3 below the root); markmap not used (no new dependency, better on phones and for screen readers).
- **Deferred / BLOCKED:** real-provider quality and latency (no key); worker-based generation; KaTeX (ADR-026); flashcard review tracking for "flashcards reviewed" on the progress page.

### ADR-029 Phase 10 (local parts): limits, retention, backups, runbooks (2026-10-16, Accepted)
- **Scope:** the parts of Phase 10 that need no cloud account. Everything else is BLOCKED on founder approval:
  production Supabase/Vercel/Railway, domain + wildcard TLS, production Google OAuth, Sentry and spend alerts, the
  real restore drill (G7, AC10.2), k6 load test on production-sized compute (AC10.3, AC7.4), deployment rollback
  rehearsal (AC10.5), and the legal opinion Q-01 (G8, AC10.4).
- **Upload and storage limits in the database** (closes the ADR-025 deferral): trigger `guard_upload` (definer, so
  teachers need no read access to quotas) refuses a version whose declared size is over `max_upload_bytes`
  (`file_too_large`) or that would take the institute's total of all stored versions over `max_storage_bytes`
  (`storage_full`); a per-institute advisory lock makes parallel upload starts take turns. The worker then fails a
  file larger than its declared size (`too_large`), so the real file cannot get round the check. The 50 MiB bucket
  cap still applies on top (raising `max_upload_bytes` above 50 MiB also needs the bucket limit raised). A refused
  first upload soft-deletes the empty document it created.
- **Job concurrency:** `pending_jobs` hands out at most `max_concurrent_jobs` versions per institute (minus those
  running), so one institute's big upload cannot starve the others; `job_slot_free()` (definer, worker only, advisory
  lock until the claim commits) is the strict check at claim time, so it also holds with several workers. A job
  without a free slot is skipped and its version stays `queued` for the next poll. "Running" = claimed within 30 min.
- **Retention purge:** definer `purge_expired()` run by the worker daily at 03:00 India time (pg-boss schedule):
  messages older than 12 months (per message, so an active chat loses only its old part), chats with no messages
  left, `usage_counters` older than 35 days. Logs counts only. `activity_events` does not exist in R1, so there is
  nothing more to purge. Soft-deleted documents' files and replaced logos: purged since ADR-031.
- **Backups:** `scripts/backup.ts` = `pg_dump -Fc` (PostgreSQL 17 client, `brew install postgresql@17`, must match
  the server) + a copy of every Storage object + a manifest of row counts and checksums. The drill restores as
  `supabase_admin` inside the local DB container (only it can own `auth`/`storage` objects; as `postgres` 121
  ownership/grant errors) into a scratch database and fails on any count or checksum difference. Local only (the
  script refuses non-local URLs) until the production project exists.
- **Runbooks** in `docs/RUNBOOKS.md`: incident, key rotation, backup/restore, offboarding, fake → real AI, rollback.
  Writing them found that `AI_PROVIDER=anthropic` covers the tutor and Studio only: Claude OCR (`ocr.ts`) and the
  Voyage client (`embed.ts`, Q-08) are not written, so the worker must stay on fake AI until they are.

### ADR-030 Claude OCR provider (2026-10-16, Accepted)
- **Decision:** `AI_PROVIDER=anthropic` now also switches OCR to Claude Haiku 5.5 (`claudeOcr` in
  `packages/core/src/ai/claude.ts`), closing the gap ADR-029 found. The worker renders each page that needs OCR
  (no/garbled text layer) and each photo to a **JPEG with the long edge ≤ 2,000 px** (`@napi-rs/canvas`, already
  installed with pdfjs-dist, now a declared worker dependency) and sends ≤ 20 labelled images per call (`Page N:` +
  image), streamed, effort `low`, `max_tokens` = 4,000 per page. The answer is split on `<page n="N">…</page>`; a
  missing page is empty, a page cut off by `max_tokens` keeps what was written.
- **Why images, not PDF document blocks:** a document block bills every page of the file, but only the pages that need
  OCR should be paid for; per-page images keep each call ≤ 20 pages (< 100K tokens, R-08) and ≤ 20 images also avoids
  the API's stricter size rule for requests with more than 20 images [V 2026-10-16, vision docs]. 2,000 px ≈ 3,700
  visual tokens per A4 page (limit 4,784 at 2,576 px); JPEG q85 keeps a 20-page request well under 32 MB [E].
- **Rendering happens inside the reservation:** pages are rendered only after `ai_reserve_job` passed, so a blocked
  institute costs no rendering, and only one batch of images is in memory at a time.
- **Refusal:** Haiku has no server-side fallback; a refused batch is settled as `refused` (billed) and the version
  fails with `ocr_refused` (shown to staff). Text in images is treated as content to copy, never instructions.
- **Bug found:** the canvas binding throws on NUL characters, which garbled text layers contain; the render context
  drops them (integration test proves the document now becomes `ready`).
- **BLOCKED:** real-key run, AC4.5 (formula accuracy on 3 real documents) and AC4.6 (cost per 100 pages).
### ADR-031 Purge of unreachable files (2026-10-16, Accepted)
- **Decision:** one rule in the database, `private.purgeable(bucket, name, created)`: a file older than a day is
  purgeable when no version of a live document (or one deleted < 30 days ago) points at it, or, for logos, when no
  institute's branding uses it. This covers deleted documents after their 30-day grace, files left by a deleted
  institute (DATABASE_DESIGN §7) and replaced logos (ADR-024) — closing the ADR-029 gap.
- **How:** Postgres may not delete Storage objects (`storage.protect_delete`), so the daily `purge` job lists them with
  `private.purgeable_files()` (definer, worker role, ≤ 1,000 a day) and deletes them through the Storage API as the
  worker service account. New storage policies `purge_select`/`purge_delete` let only a service account delete, and
  only what `purgeable()` names, so a bug in the worker cannot delete a live file. `purge_expired()` then hard-deletes
  documents past their grace whose files are gone (versions, chunks and audiences cascade); a document whose files
  are still there waits for the next day.
- **The one-day age** keeps an in-flight upload or logo change safe (the row that points at the file may commit later).
- **Accepted:** Storage deletes with `delete … returning`, which needs a SELECT policy, so the worker account can also
  download a purgeable file until the job deletes it (at most a day). Nobody else gains access.
- **Not purged:** files of superseded and failed versions of live documents (they count against the institute's
  storage limit until the document is deleted) — revisit if institutes hit `storage_full` from re-uploads.

### ADR-032 AI-made bank questions with a blind second solve (2026-10-16, Accepted)
- **Closes the AC7.5 deferral (ADR-023).** A teacher picks a chapter, a type (MCQ one correct, MCQ more than one
  correct, numerical; written questions are not generated — they have no answer to check), a count (1–20) and a
  difficulty on the question bank. The chapter's published notes (`apps/web/lib/notes.ts`, shared with Studio) are
  the only source.
- **Two models, two metered calls** (`packages/core/src/ai/questions.ts`): Opus 5.5 writes the questions with their
  keys and citations; Sonnet 5.5 solves them **without the key or the explanation**. Both use structured output, effort
  `medium` (set explicitly: it is Opus 5.5's default), `max_tokens` 16,000 (thinking is always on) and the server-side
  fallback (`fallbacks: "default"`). New AI feature `question_gen` (≤ 1 USD reserved per call, no student counter);
  `ai_reserve` refuses it to anyone but owner/admin/teacher, so a student token cannot spend the budget on it.
- **Agreement = the second answer would be marked correct** against the key (same option set; a number within
  `tolerance_abs`, which must be > 0). A question with a broken shape (options not a–d, a single with two keys, a
  citation to a source that was not sent, …) is dropped, not the whole batch. If the solve fails or is refused the
  questions are kept as `unverified`.
- **Approval in the database:** a trigger stores every `origin = 'ai'` question as `draft`, refuses `approved` while
  `verification` is `unverified` or `dual_solve_disagree` (`question_not_verified`), and lets `verification` change
  only to `teacher_verified`, so nobody can mark a question as AI-checked by hand. A matched draft is approved with one
  click; a flagged or unchecked one shows the second answer next to the key and is approved when the teacher saves it
  (→ `teacher_verified`). Scheduling already refused tests with unapproved questions (`test_question_not_ready`).
- **Stored in one transaction** by `add_ai_questions` (invoker: RLS and column grants apply, staff of the host's
  institute only); the second answer goes in `question_keys.second_solve` (staff only, like the key).
- **Synchronous Server Action** like Studio (ADR-028). shortcut: a real Opus write + Sonnet solve of 20 questions may
  take 1–2 minutes; move to a pg-boss job with a "generating" state when the real provider is switched on.
- **Demo mode:** fill-in-the-blank / which-words / fill-in-the-number questions from the notes' sentences, solved by
  looking them up in the notes; every fourth answer is changed on purpose so the "answers differ" path is visible.
- **BLOCKED:** real-provider quality (agreement rate, teacher rejection rate — AI_PIPELINE §5), cost per question.

---
### ADR-033 Platform admin deletes an institute created by mistake (2026-10-17, Accepted)
- **Why:** founder testing found no way to undo an institute created with a wrong owner email or address; the only
  path was SQL as `postgres` (RUNBOOKS offboarding). New scope beyond the roadmap, asked for by the founder.
- **Rule:** `public.delete_institute(inst, confirm_slug)` (SECURITY DEFINER in `private`) needs an aal2 platform admin,
  the institute's address typed exactly, and **no membership rows** (any role or state). Institutes people joined keep
  the suspend → offboarding → SQL path, so the button can never destroy tenant data.
- Cascades remove host, quotas and invitations; the audit trigger keeps an `institutes.delete` row
  (`actor_kind = platform_admin`); a logo file is removed by the daily purge (ADR-031).
- Tests: pgTAP `150_delete_institute.sql`; platform E2E deletes its test institute and is refused for Demo Classes.

### ADR-034 Local demo sign-in creates unknown accounts (2026-10-17, Accepted)
- **Why:** founder testing kept failing with "Sign-in failed" for every new invited email, because a local account
  had to be created by hand first. Google sign-in (the real path) is not configured yet.
- **Rule:** `signInDemo` signs up an unknown email with the demo password when sign-in fails with
  `invalid_credentials`. Still gated by `demoLoginAllowed` (only `DEMO_LOGIN_ENABLED=true` with a localhost Supabase
  URL), so it can never run in production. A new account has no membership: it sees nothing until it accepts an
  invitation, same as a first Google sign-in.
- Test: E2E `isolation.spec.ts` invitation test no longer pre-creates the invited account (failed before, passes now).

### ADR-035 Google sign-in and invitation emails switched on (2026-10-17, Accepted)
- **Unblocks ADR-020** after the founder created a Google Cloud OAuth client and a Resend account (keys only in the
  gitignored root `.env` and `apps/web/.env.local`).
- **Google:** `[auth.external.google] enabled = true`; client id/secret come from env (`supabase start` reads the root
  `.env`). "Continue with Google" calls `signInWithOAuth` (PKCE) with `redirectTo = <same host>/auth/callback?next=…`;
  the callback exchanges the code and redirects to the **request's own host** (Next's `request.url` carries the dev
  server hostname, which would drop the host-only session cookie), `next` passed through `safeNext`. The admin host
  serves `/auth/callback` too (proxy skips the `/platform` rewrite for it). The button is live only when Supabase
  reports Google enabled (`/auth/v1/settings`, cached 5 min). CI uses placeholder credentials; E2E stubs Google's page.
- **Emails:** sent from the Server Function that creates the invitation (People, and the platform "Create institute"
  owner invite), **not the worker** as ADR-020 planned: only that function ever holds the raw token (the DB stores
  its hash), and handing the token to a job would store it. Resend batch API, 100 per call, plain `fetch` (no SDK).
  The one-time link is still shown on screen with an "emailed / not emailed" badge as a fallback. No key → nothing
  is sent. No PII in logs (status and count only).
- **Limits [U]:** without a verified domain Resend only delivers to the account's own address (test sender
  `onboarding@resend.dev`); verify a domain and set `EMAIL_FROM` before real institutes. Free tier 100 emails/day
  (R-06). Batch validation is strict: one rejected address fails its chunk of 100 (shortcut noted in `lib/email.ts`).
- Google OAuth consent screen is in **Testing** mode: only listed test users can sign in until it is published.

### ADR-036 Platform admin sends a new owner invitation (2026-10-17, Accepted)
- **Why:** founder testing: an owner email typed wrong, or a lost/expired owner link, could only be fixed with SQL.
  New scope beyond the roadmap, asked for by the founder.
- **Rule:** `public.reinvite_owner(inst, owner_email)` (SECURITY DEFINER in `private`) needs an aal2 platform admin and
  is refused (`has_owner`) once the institute has an active owner. It revokes every pending owner invitation (old
  links stop working) and creates a new one, returning the raw token once (only its hash is stored). The audit
  trigger on invitations records both. The web action emails the link like "Create institute" and shows it once.
- The platform admin still cannot read memberships or invitations (TH-15), so the form is always shown and the
  database answers "already joined".
- Address minimum stays 3 characters (founder, 2026-10-17); the create form now says so and the browser explains a
  too-short address.
- Tests: pgTAP `160_reinvite_owner.sql`; platform E2E (refused for Demo Classes, replaces Gamma's link).

---
## Release 1.1 — founder change list (approved 2026-10-17, PROGRESS.md "Next exact action" groups A–E)
These override older text in HOW_IT_WORKS, DATABASE_DESIGN and AI_PIPELINE_DESIGN. Each is built on its own branch
in the order of PROGRESS.md; the "Built" line is filled in when it merges.

### ADR-037 Remove the ExamEdge library (R1.1 group E; reverses ADR-010 and ADR-027)
- **Decision:** ExamEdge shares no content with institutes. Drop the library tables (`library_subjects`,
  `library_chapters`, `library_topics`, `library_items`, `library_chunks`), `subjects.library_subject_id`,
  `match_library_chunks`, `publish_library_item`, the platform metering path
  (`ai_reserve_platform` / `ai_settle_platform`, feature `library_embed`), the platform library pages, the
  subject → library link, the library on student pages and in the tutor. Tutor = the institute's notes + labelled
  "General explanation" only (prompt `tutor-v3`).
- **Why:** founder decision (2026-10-17): no shared content; it also confused testing (both newtown subjects were
  linked to "JEE Main Physics", so its chapters showed under Sources).
- **Kept:** `exams` (batches reference it). Old chat messages may still carry `library` labels/citations; they are
  shown as plain text without a link (no rewrite of stored chats). `usage_records.institute_id` is `not null` again;
  the 24 fake-cost platform rows (`library_embed`, cost 0) were deleted by the migration. Eval: library questions
  dropped from `demo-retrieval.json`.
- **Built:** migration `20261029000017_remove_library.sql`, branch `r11-remove-library`.

### ADR-038 Subjects inside batches; Subject → Topic → Subtopic (R1.1 groups A1–A3)
- **Subject belongs to one batch.** `subjects.batch_id not null`, composite FK `(institute_id, batch_id)` → batches,
  `unique (institute_id, batch_id, name)` replaces `unique (institute_id, name)`; `batch_subjects` is dropped. The
  owner types a batch's subjects on the batch page; there is no institute-wide Subjects list any more.
  Students read a subject when they are (or were, ADR-040) in its batch (`private.has_subject`).
- **Migration of existing rows:** a subject linked to several batches is copied once per extra batch (its topics too);
  the original row keeps all content (documents, questions, artifacts, chats) and its first batch. An unlinked subject
  is deleted if empty; if it has content the migration stops (manual decision). Founder's local data: newtown
  `physics` (jee 2027 + neet 2027) becomes two subjects; nothing else changes.
- **Topic = the existing `chapters` table** (UI says "Topic"; the DB name stays). Renaming would break stored SQL
  function bodies and every query for no behaviour change.
- **New `subtopics`** (`institute_id`, `subject_id`, `chapter_id`, `name`, `position`), composite FK
  `(institute_id, subject_id, chapter_id)` → chapters, RLS like chapters (staff write; students of the subject read).
- **Notes live in a subtopic.** `documents.chapter_id` and new `documents.subtopic_id` become `not null`, FK
  `(institute_id, chapter_id, subtopic_id)` → subtopics. Existing documents without one get a "General" subtopic
  (and a "General" topic if they had no chapter). A document's audience may only be its subject's batch (trigger),
  so "Publish" means "publish to this batch".
- **Topic page** `/topics/<id>`, tabs **Subtopics | Smart Study**. Subtopics: each subtopic with its notes (uploaded
  + AI notes) and, for staff, an "Upload notes" button inside the subtopic (A3). Smart Study: the AI for the whole
  topic — retrieval over the published notes of all its subtopics (`match_chunks` gets a topic filter; no subtopic
  picker), tutor chats are scoped to the topic (`conversations.chapter_id`), Studio tools (summary, flashcards, mind
  map, practice quiz) are made from the topic's notes (C3: practice is per topic and never counts for rank).
- **Teachers see only subjects of batches they teach** in the portal (a UI filter), so nobody uploads into a subject
  no batch of theirs studies (founder finding A3). RLS still lets all staff read subjects: teachers read all institute
  notes by design (TH-03), and staff pages embed subject names. The filter is applied on the Subjects list and on the
  subject and topic pages (a teacher of another batch gets 404).
- **Subject names repeat per batch**, so staff pickers (question bank) label a subject "Physics · JEE 2027 Morning".
- **Built:** migrations `20261030000018_structure.sql` (tables, RLS, backfill) and `20261031000019_topic_scope.sql`
  (`conversations.chapter_id`, `match_chunks(..., topic)`); batch page subjects, Subjects list per batch, subject page =
  topic list, `/topics/<id>` (Subtopics | Smart Study), upload inside a subtopic; branch `r11-structure`.

### ADR-039 Teacher AI = AI notes + AI test (R1.1 group B)
- **Teachers lose** Studio, the staff AI tutor and the question-bank "Make questions with AI" form. The database
  refuses the student AI features (`tutor`, `tutor_premium`, `generation`) to staff, so the budget cannot be spent on
  them through the API. **Students keep** tutor, summary, flashcards, mind map and practice quiz (Smart Study).
- **B1 AI notes (inside a subtopic):** the teacher types an explanation → the AI (Sonnet 5.5, new staff-only feature
  `notes_gen`) writes detailed Markdown notes → the teacher edits → Save stores them as a **document** whose version is
  a Markdown file (`text/markdown`) in the same private bucket. The worker processes it like a PDF (text → chunks →
  embeddings), so Publish / Withdraw / audience / retrieval / tutor citations all reuse the existing path. The note
  opens as an in-app page (safe Markdown renderer); "Download as PDF" = the browser's print dialog with print CSS
  (no PDF library). Editing = a new version.
- **B2 AI test (inside a topic):** the teacher asks for a quiz (MCQ), theory (written) questions or a mix, a count and
  a difficulty → questions are made from the topic's published notes (ADR-032 pipeline; MCQ/numerical keep the blind
  second solve) and put into a **new draft test**; the teacher reviews/edits each question and schedules the test
  (scheduling already refuses unapproved questions). Written questions get a model answer and max marks; they cannot
  be second-solved, so they stay `unverified` until the teacher saves them (`teacher_verified`).
- **Built:** migration `20261101000020_teacher_ai.sql` (`notes_gen`, staff/student AI split in `ai_reserve`,
  `text/markdown` versions, `documents.kind`, `add_ai_test`); core `notes.ts` (`notes-v1`, `claudeNotes`) and
  `questions-v2` (written questions); worker reads Markdown as text; web: "Write notes with AI" in each subtopic,
  edit + publish on the document page, `/notes/<id>` with "Download as PDF" (print CSS), topic tab **AI test** for
  staff (Smart Study for students only), bank AI form removed; branch `r11-teacher-ai`.

### ADR-040 Batch history and Contest page (R1.1 group C)
- **Past membership:** `batch_members.left_at timestamptz` (null = current). Promotion tool for owner/admin on the
  batch page: "move these students to <batch>" adds them to the new batch and sets `left_at` on the old one in one
  transaction; nothing is deleted. One batch per class per year (batches already carry `academic_year`), so an old
  batch only ever holds that year's content — the student's "own time" needs no date filters.
- **Past batch = same pages, read-only for tests:** `start_attempt` refuses a test of a batch the student has left
  (`not_current_member`); notes, results, progress and Smart Study (tutor + Studio on the old notes) keep working
  (founder answer Q4).
- **Batch switcher** in the student portal header (like Vedam's semester dropdown): current batch first, then past
  batches; the choice is kept in a cookie and only selects among the student's own batches (RLS decides).
- **Built so far:** `batch_members.left_at`, `start_attempt` refusal, standings (migration 18); promotion =
  invoker RPC `move_students(from, to, members)` (migration 19, one statement, RLS: owner/admin) behind "Move students
  to another batch" on the batch page.
- **Contest page** (`/contests`, student sidebar next to Home / My progress): every institute test of the selected
  batch — upcoming, live (Start), finished (waiting for results), results (marks, test rank). Practice quizzes never
  appear there.
- **Built (step 6):** switcher in the student sidebar (shown with 2+ batches; cookie `batch`, httpOnly, only one of
  the student's own `batch_members` rows, else the current batch). Home, Contest and My progress show the selected
  batch; a batch lists only the tests held while the student was in it (`closes_at` after joining, `opens_at` before
  leaving — the same rule as the overall rank). `student_progress`, `tutor_activity`, `practice_activity` take an
  optional `batch` (migration `20261102000021_batch_view.sql`); `student_progress` now also skips tests opened after
  the student left (before, they showed as missed). Starting a test of a past batch says so (`past_batch`).

### ADR-041 AI use per institute for the platform; the institute's bill waits (R1.1 group D)
- **Now (D2 part 1):** the platform "All institutes" table shows each institute's AI use this month (India time):
  tokens (input + output) and real cost, from `usage_records` (platform admins already read every row; counts only,
  no student data, TH-15). One invoker SQL function aggregates it.
- **Waits for the founder's formula:** the per-institute commission field. **Built (founder, 2026-10-18, session 37):**
  the owner/admin "AI usage" page is now **Bill** (`/usage`): only "This month's AI charge: ₹X" (+ AI on/off), no
  tokens, features, dollars or budget banners. ₹X = this India month's AI cost × one rate the platform admin sets
  ("₹ per US$", `private.settings.inr_per_usd`, `set_inr_per_usd` aal2 + audited); until it is set the bill says "Not
  available yet". `public.institute_bill(inst)` is invoker (RLS on `usage_records`). Migration 27, pgTAP `240_bill.sql`.
  Owners can still read their own `usage_records` through the API (RLS unchanged); only the page hides them.
- **Built (step 7, part 1):** migration `20261103000022_platform_usage.sql` (`public.platform_usage()`, invoker; pending
  calls count at their reservation like `usage_summary`), column "AI this month" on `/platform`, pgTAP
  `210_platform_usage.sql`, E2E in `portals.spec.ts` (platform) and `usage.spec.ts` (Rival sees only its own row).

### ADR-042 New test on the Tests page: AI request box or typed questions (R1.2 item 1, founder 2026-10-18)
- **Decision:** a test is made on the Tests page only. **New test** = subject (a list grouped by batch — picking the
  subject picks its batch; teachers see only batches they teach), title, opens, closes, duration → a **draft** test
  for that subject's batch, then its test page. On a draft test that has a subject the teacher fills it two ways:
  **With AI** — a request box ("10 MCQs + 5 theory on Networking and HTML, medium"), each Send adds one batch of
  questions; **Manual** — "Type a question" (MCQ single/multi: stem, options, correct; numerical: value, tolerance;
  theory: question + model answer; topic; marks). "Add from the bank" stays. Review (approve AI drafts) → Schedule, as
  today. The topic page's **AI test** tab, `makeAiTest` and the question bank's **New question** form are removed; the
  bank stays the store (list, edit, approve, delete) and every question made on a test page is saved there.
- **AI request → plan → questions:** the request text goes through the gateway as feature `question_gen` (staff
  only) to `planTest` (Haiku 5.5, effort low, structured output): `{difficulty, parts: [{topic, type, count}]}`, where
  `topic` is the index of one of the subject's real topics sent with the request. The server validates it (topic index
  in range, type in `single|multi|numerical|written`, 1 ≤ count ≤ 20, ≤ 4 parts, ≤ 40 questions), then for each part
  runs the existing `generateQuestions` (ADR-032/039: Opus writes from **that topic's** published notes, Sonnet solves
  MCQ/numerical blind). A topic without published notes is skipped and the page says the test is partial. Demo mode:
  a deterministic parser (number before "mcq/multi/numerical/theory", topic names found in the text, difficulty word;
  no topic named = every topic with notes).
- **Why not a multi-turn chat:** one request → one batch keeps it stateless (no chat table, the request text is never
  stored, TH-10); "Send" again adds more. The request is the teacher's own text, the model only returns a plan that is
  checked against real topic ids, and questions are still written from the notes with the existing prompts, so prompt
  injection cannot reach other data.
- **Database:** `tests.subject_id` (nullable — older tests have none and keep "Add from the bank" only; composite FK
  → subjects, `on delete set null`); invoker RPC `add_test_questions(inst, test, items)` replaces `add_ai_test`
  (dropped): the test must be a draft the caller may manage (RLS on `test_questions`) and have a subject; every item's
  topic must be a topic of that subject; `origin` `ai` (review trigger keeps it a draft, keys + blind second answer
  stored) or `teacher` (approved, `teacher_verified`); questions, keys and `test_questions` (appended, marks per item)
  in one transaction.
- **Disadvantages:** several Opus calls run inside one server action (≤ 4 parts × 2 calls); on Vercel this needs a
  longer `maxDuration` [U] or a worker job later. Old multi-batch tests stay as they are.
- **Built** (session 36, branch `r12-new-test`): New test form = subject list grouped by batch; Fill panel on the
  draft test page; topic page AI test tab and the bank's New question form removed; E2E `question-gen`,
  `assessments`, `studio` rewritten for the new journey.
- **Founder follow-up (session 37):** "Type a question" also takes **negative marks for a wrong answer** (MCQ and
  numerical; theory is marked by the teacher) — `add_test_questions` reads `negative_marks` per item (migration 25,
  default 0, column check 0 ≤ it ≤ marks). A typed theory question's **model answer is optional** (the key check
  already accepted an empty string; the form no longer requires it, and the checking and review pages hide an empty
  one). AI theory questions still come with a model answer.

### ADR-043 One-click batch switcher, Home after switching, Smart Study tiles (R1.2 items 2–4, founder 2026-10-18)
- **Switcher:** choosing a batch in the dropdown submits at once (small client component; a `<noscript>` "Show"
  button keeps it working without JavaScript). `chooseBatch` then goes to **Home** of that batch, so the student never
  stays on the old batch's subject page.
- **Smart Study tools** look like NotebookLM's "Studio": a grid of tiles (Summary, Flashcards, Mind map, Practice
  quiz), each with an icon in the institute's colour; tapping a tile makes it (one form, one submit button per tool —
  the same `generate` action). Below: "Made by you" and "From your teachers" for this topic, to open again. Audio,
  video, slides, reports, infographics and data tables are later (not built).

### ADR-044 A teacher's uploaded notes publish themselves (R1.2, founder 2026-10-18)
- **Decision:** a teacher's own uploaded notes need no check. The upload (`confirmUpload`) adds the subject's batch as
  the audience (RLS-checked, as a manual publish would be); the `documents` guard trigger (migration 24) publishes a
  `draft` `file` document when the worker makes its first version current, so students never get a link before the
  file is readable. AI notes (`ai_notes`) still stay drafts until the teacher reads and publishes them (ADR-039).
  A withdrawn document is not republished by a new version.
- **Why in the trigger:** the database already refuses `published` without a current version; publishing at upload
  time would fail, and the worker should not decide audiences. Covered by pgTAP `230_notes_autopublish.sql` and E2E
  `documents.spec.ts`.

### ADR-045 Multiple-correct MCQs marked like JEE Advanced (founder, 2026-10-18)
- **Decision:** replaces ADR-023's "exact set or nothing". Only correct options picked: all of them = full marks,
  otherwise marks ÷ 4 per correct option picked (+1 each on a 4-mark question, like JEE Advanced's +3/+2/+1); any wrong
  option picked = −negative marks (the teacher sets them per question, e.g. 2); blank = 0. Single-correct and
  numerical unchanged. `private.grade_objective` (migration 26), pgTAP `060_assessments.sql`.
- **Why the quarter:** the founder chose JEE Advanced's rule over splitting marks by the number of correct options;
  the quarter keeps it exact for 4-mark questions and proportional for other marks.
- **Note:** a test released before this keeps its stored marks until a teacher clicks Recalculate.

### ADR-046 Students see their own result right after submitting (founder, 2026-10-18)
- **Decision:** amends ADR-023 (nothing before release). Right after submitting (or at the deadline) the student's
  test page shows their marks so far, each question right/wrong with its marks, and written answers with the
  teacher's marks once checked ("Not checked yet" before). Correct answers and explanations of objective questions
  appear only once the test's closing time passes; a written question's model answer and both ranks still come only
  with "Release results". `private.get_attempt_review` (migration 28) marks objective answers live with the same
  `grade_objective` (or the teacher's override) that release uses; pgTAP `060_assessments.sql`, E2E `assessments.spec.ts`.
- **Why keys wait for closing time:** students start at different times inside the test window; an early finisher
  who saw the key could pass it to classmates still writing (founder chose this over showing keys at once).

### ADR-047 Student reviews, read only by owner/admin (founder, 2026-10-18)
- **Decision:** a "Review" page in the student sidebar (text up to 2000 characters, "Hide my name" tick box) and a
  "Reviews" page for owner/admin listing them newest first with name + batch, or "Anonymous" + batch. Teachers have
  no link and get 404; RLS gives them no rows. Table `public.reviews` (migration 29), plain RLS insert (no definer
  function). pgTAP `250_reviews.sql`, fixture row in `test_helpers.sql` (isolation matrix), E2E `reviews.spec.ts`.
- **How a hidden name stays hidden:** `reviews.user_id` is null, so nothing the institute can read (pages, API,
  exports) names the author. The author is kept only in `private.review_authors` (no API role can read it; migration
  31), used solely by `my_reviews()` so the student still gets the reply (founder asked for that). The platform's
  own database access could link them; the institute cannot. The batch stays so the owner knows which class it is about
  (in a very small batch that can narrow it down; the page says only owner/admin read it).
- **Replies (founder, same day):** owner/admin write one reply per review (editable; empty = removed); the database
  stamps `replied_by`/`replied_at` (trigger). The student sees replies under "Your reviews", anonymous reviews included
  (migration 31, see above). Migration 30.
- **Not built (not asked):** delete/hide, star rating, limits per student, notifications of a reply.

### ADR-048 CBT tests: full screen, 3 warnings, then auto-submit (founder, 2026-10-18)
- **Decision:** "CBT mode" is a tick box on New test and in a test's Settings (owner/admin/teacher only; practice
  quizzes are another table and never have it). On a CBT test the student's page asks for full screen at "Start test
  in full screen"; the test then fills the whole page (no menu) and the questions are covered whenever the page is not
  in full screen. Leaving full screen, switching tab or app (page hidden or window blur — founder chose to count it),
  reloading/leaving the page and coming back, or trying to copy, cut or paste (blocked; founder, 2026-10-19) is one
  warning; warning 3 submits the attempt (`auto_submitted`). The submit question is asked on the page, not with a
  browser `confirm()` popup (Chrome leaves full screen for it; founder found the gap, 2026-10-19).
  Teachers see the count per student in the rank list and the CSV.
- **Where it is counted:** `test_attempts.cbt_warnings` (0–3), changed only by definer `cbt_warning(attempt)` (own
  running attempt of a CBT test; the 3rd submits it), so a reload cannot reset it. `tests.cbt` cannot change once the
  test is open (`guard_test`). Migration 32, pgTAP `260_cbt.sql`, E2E `cbt.spec.ts`. The page saves pending answers
  before each warning, so the 3rd one keeps them.
- **Browser:** the founder tells students to use Google Chrome. The page accepts browsers that report the "Google
  Chrome" or "Chromium" brand (`navigator.userAgentData`, so also Edge and other Chrome-based browsers — a Chrome-only
  name check would also refuse the automated test browser) with the full-screen API; Safari, Firefox and every iPhone
  browser get "Open it in Google Chrome". `userAgentData` exists only on https or localhost, so a phone opening the
  local app by LAN IP over http is refused too.
- **Limits (a browser cannot prevent these):** a second device or a phone camera; a student can still open developer
  tools. It discourages copying; it does not make it impossible.

## Review log (skeptical principal-engineer pass, 2026-10-14)

| # | Issue found | Resolution |
|---|---|---|
| R-01 | `institute_id` column alone would allow a child row to reference another tenant's parent | Composite unique + composite FKs everywhere (DATABASE_DESIGN §2) |
| R-02 | Worker using pooled connections could leak tenant context via session `SET` | Transaction-local `set_config(..., true)` only + static check T-SEC-08 |
| R-03 | Shared HNSW index with tenant filter loses recall and couples tenants [V] | Exact search on filtered tenant sets; HNSW only for the shared library (ADR-006) |
| R-04 | Uploads through Vercel functions hit 4.5 MB body limit [V] | Direct signed upload to Storage |
| R-05 | Supabase built-in SMTP allows only team addresses, 2/hour [V] | Own email via Resend; Google-only auth needs no Supabase emails |
| R-06 | Resend free tier is 100 emails/day [V] — bulk invites of 500 students fail | Resend Pro in pilot budget; invites queued and throttled |
| R-07 | Storage files are not in DB backups [V] | Separate nightly storage copy + restore drill (G7) |
| R-08 | Haiku 5.5 price ×5 above 100K-token prompts [V] | Prompt size cap; OCR in ≤ 20-page batches |
| R-09 | Views bypass RLS by default [V] | `security_invoker` views only; covered by T-ISO-05 |
| R-10 | Answer keys readable through a broad `questions` select policy | Keys moved to `question_keys` with no student policy |
| R-11 | Lost or duplicate ingestion jobs | Singleton key + sweeper + idempotent chunk swap |
| R-12 | Markdown image URLs can exfiltrate data after prompt injection | Remote images and raw HTML disabled in renderer |
| R-13 | JWT claims for membership go stale | Membership read from DB per request (ADR-004) |
| R-14 | Original order put quotas after the tutor | Quotas moved before tutor (Phase 5) |
| R-15 | Video cost model ignored bandwidth | Added; bandwidth dominates (COST_MODEL §5) |
| R-16 | Remotion licence is not free for companies > 3 employees [V] | Flagged Q-09 before R3 |
| R-17 | Voyage data-use/training terms unverified | Q-08 blocks embedding real institute documents (Phase 4 gate) |
| R-18 | DPDP children's rules: verifiable parental consent and tracking ban, with an educational-institution exemption limited to educational activities/safety; commencement ~18 months after 13 Nov 2025 [V3] | Legal track Q-01 blocks pilot launch; data minimisation defaults now |
| R-19 | Overengineering risk: Redis, separate vector DB, microservices, multi-LLM routing at launch | Removed from MVP |
| R-20 | Docker not installed → local Supabase stack impossible | Q-11 before Phase 1 |
| R-21 | `examedge_ai/` is ignored by the parent git repo (`.gitignore` allowlists only `vulnops-validation/`) — work here is not version-controlled | Q-10: separate repository (Phase 1 Task 1) |

### ADR-049 UI redesign: Brilliant-like layout, own indigo + saffron theme (founder, 2026-10-19)
- **Decision:** the founder found the UI "very bad" and picked brilliant.org (of five references) as the layout and
  feel reference, but not its colours. ExamEdge's theme is deep indigo `#2D2A7A` + saffron `#F2A93B` on warm
  off-white, with a dark mode. Fonts stay Poppins + Lora. CSS/markup only, no new dependency.
- **Plan and token table:** `docs/UI_REDESIGN_PLAN.md` (branch `r13-ui`; the founder sees student Home + test page
  before the rest is restyled).

**ADR-049 update (founder, 2026-10-19, session 41):** the indigo + saffron theme is replaced by the founder's palette
`#3368A0` (primary), `#66A3BF` (secondary), `#C8DFDB` (mint), `#F2EFE7` (warm off-white), and the founder asked for a
real redesign, not a recolour. Built ("workbook" direction, founder said "keep this type of UI"): Plus Jakarta Sans for
the interface + Source Serif 4 for page titles, numbers and long reading (replacing Poppins + Lora); page sections are
divided by hairlines and space instead of boxes, cards only for things you press or fill; mint = "yours/current"
(selected answer, active nav); `#66A3BF` only for progress fills and accent rules (2.4–2.8:1, never text); links in
`#244E7A`; dark mode derived. Entry pages: name + purpose left, sign-in right. Home shows Upcoming tests + My progress
before subjects. Test runner: timer with answered-progress bar, serif question stem, large option rows, Previous/Next
pinned at the bottom on phones. An institute's brand colour now tints only its own logo mark (it used to replace the
accent everywhere). No logic, DB or E2E selector change.

**ADR-049 polish (founder, 2026-10-19, session 42):** **light theme only** (the dark-mode block is removed,
`color-scheme: light`). Type: body 16 px, UI text (tables, labels, buttons, nav) 15 px, hints 14 px minimum, badges
13 px, h2 22 / h3 18 px, page title 32–44 px, weights 400–700 (no 650). Spacing: 20 px between form fields and rows of
fields (`.inline` now styles any element, not only `form.inline` — `div.inline` field rows had no gap at all), 48 px
between page sections, 14 px table cell padding, forms max 560 px, page content max 960 px. Sidebar 248 px, 40 px
logo, 44 px nav items, full-width quiet Sign out. Destructive actions get a red-outline `.danger` style (class only).

**ADR-049 refine (founder, 2026-10-19, session 43):** founder asked to polish the UI using the techniques (not the maroon
theme) of a 21st.dev "fintech landing" reference. Taken: raised surfaces (white top highlight + low soft shadow,
lifting on hover), button depth on primary buttons, one easing `cubic-bezier(0.2, 0.8, 0.2, 1)` at 200 ms, tighter
page titles (-0.025em, balanced lines), a faint mint glow at the top of every page, a fading drafting grid behind the
entry page, and a menu button on phones for staff (6–8 links): an animated panel with numbered links that closes on
navigation and Escape (`(portal)/main-nav.tsx`). Students keep the visible link row (4 links fit at 375 px). Not
taken: dark slabs, 3D objects, oversized display type, extra colours. The page "rise" animation moves only (no fade):
fading text failed axe colour-contrast in CI. "Continue with Google" follows Google's button rules (white, grey
outline, full-colour G). Page titles use the template "Page · ExamEdge AI" (`noindex` stays: private portal, so no
sitemap or robots.txt).

### ADR-050 Smart Study without notes + audio/video overviews with the browser voice (founder, 2026-10-19)
- **Decision (founder):** Summary, Flashcards, Mind map and Practice quiz must not depend on teacher notes. If a topic
  has no published notes, the AI writes them from its own knowledge of the topic (subject + topic name, standard
  syllabus). Such artifacts store no source refs and are labelled "General explanation, not from your institute's
  notes", like the tutor's general answers. With notes, the old rule stays: every part cites a sent source.
- **Decision (founder):** add **Audio overview** and **Video overview** (NotebookLM-like). For now the **free browser
  voice** (Web Speech API, `speechSynthesis`, en-IN voice when the device has one) reads an AI-written script; the
  video is narrated slides on the page (each slide highlighted while its narration is read). No audio or video file
  is made or stored, no new vendor. A paid natural voice (e.g. Sarvam, R2 in the roadmap) replaces the browser voice
  later — founder will choose it.
- **Built:** migration `20261114000033_overviews.sql` (kind check + 2 kinds), `STUDIO_PROMPT_VERSION` studio-v2,
  `GENERAL_PROMPT`, schemas `audio_overview` / `video_overview`, `(portal)/studio/[id]/speaker.tsx`.
- **Risk:** general-knowledge material is not checked against the institute's syllabus; it is labelled, student
  artifacts stay private, and institute artifacts still need a teacher's approval before students see them. Voice
  quality and Hindi depend on the device.
- **Tutor too (founder, same day):** when no notes match, the tutor says so in one sentence and then answers fully from
  standard textbook knowledge (prompt `tutor-v4`; the Claude request adds "(No passages from your notes matched.)").
  Uncited paragraphs were already labelled "General explanation"; demo mode now shows the same two-part shape.

### ADR-051 Gemini free tier as a test-only AI provider (founder, 2026-10-19)
- **Decision (founder):** add Google Gemini (free API key from AI Studio) so every AI feature can be tried locally
  before paying for Claude. `AI_PROVIDER=gemini` + `GEMINI_API_KEY` (in `apps/web/.env.local`, read by web and worker).
  Claude stays the production plan (ADR-008); `fake` stays the default; embeddings are untouched (`EMBEDDINGS_PROVIDER`).
- **Data rule:** Google's pricing page (checked 2026-10-19) says free-tier content **is used to improve Google's
  products**. Use it only with local test institutes, never real student or teacher data, and never in production.
- **Built:** `packages/core/src/ai/gemini.ts` over the REST API with `fetch` (no new dependency; the forbidden-pattern
  check now also keeps `generativelanguage.googleapis.com` inside `packages/core/src/ai`). Models (models.get,
  2026-10-19, output limit 65,536): `gemini-3.5-flash-lite` where Claude uses Haiku (tutor, flashcards / mind map /
  quiz, OCR, test plan, blind solver) and `gemini-3.8-flash` where Claude uses Sonnet/Opus (step-by-step tutor,
  summary, overviews, question writer, AI notes). Metered through the same gateway as provider `google` at cost 0
  (migration `20261115000034_gemini.sql`). Free-tier rate limits are per account and shown only in AI Studio [U].
- **Differences from Claude:** no citation blocks, so the tutor numbers passages and the model cites `[n]`; the tutor
  answer is not streamed (shows at once); `maxItems` is stripped from the JSON schema (Gemini rejected some schemas
  with it on 2026-10-19), the Zod check after the call still enforces the limits. One retry on 429/5xx.
