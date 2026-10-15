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
- **Deferred:** student practice quizzes → Phase 9 (Studio); AI question generation + dual-solve (AC7.5) → after Phase 5; AC7.4 (500 concurrent starts, p95 < 2 s) → BLOCKED until a staging/prod-sized database exists (a laptop run would not prove the target; measured with k6 in Phase 10, AC10.3).

---
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
