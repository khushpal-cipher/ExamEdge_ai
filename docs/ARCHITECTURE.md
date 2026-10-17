# ExamEdge AI — Architecture

Status: **Draft for approval** · Last updated: 2026-10-14
Evidence labels (used in every planning doc):
**[V]** verified on 2026-10-14 from an official source (link in [COST_MODEL.md](COST_MODEL.md) § Sources or inline) ·
**[V3]** verified from a third-party source only · **[U]** unverified, must be checked before relying on it ·
**[A]** assumption · **[E]** estimate · **[R]** engineering recommendation · **[D]** depends on a future decision.

Decisions referenced as `ADR-NNN` live in [DECISIONS.md](DECISIONS.md). Tables are specified in
[DATABASE_DESIGN.md](DATABASE_DESIGN.md). Threats are in [SECURITY_THREAT_MODEL.md](SECURITY_THREAT_MODEL.md).

---

## 1. The idea in simple English

ExamEdge is **one application and one database** that serves many coaching institutes. Each institute
*feels* like it has its own platform: its own web address (`allen-kota.examedge.ai`), logo, teachers,
batches, students and content. Behind the scenes, every piece of institute data carries the institute's
ID, and **the database itself refuses** to return a row to anyone who is not an active member of that
institute. This is a *logical* environment.

A *physically separate* environment is a separate database (or server) per institute. It costs more,
needs N times the upgrades and backups, and is hard for one person to operate. We design so that a big
institute **can later be moved** to its own database without rewriting the app (ADR-001).

| | Logical environment (our default) | Physically separate environment |
|---|---|---|
| What separates institutes | Database rules (Row-Level Security), composite keys, per-institute storage folders, tenant-scoped jobs | Different database / project / server |
| Cost per extra institute | ~zero fixed cost | Fixed cost per institute (DB + compute) |
| Upgrades / migrations | Once | Once per institute |
| Blast radius of a bug | A policy bug could expose other tenants → mitigated by layered defences + automated isolation tests | Bug stays inside one institute |
| When we use it | All institutes at launch | Enterprise customers who pay for it (later, ADR-001) |

## 2. Isolation options evaluated

| Option | Security | Reliability | Cost | Ops complexity (solo founder) | Scalability | Verdict |
|---|---|---|---|---|---|---|
| 1. Shared app + shared DB (RLS) | Good *if* layered + tested | One DB = one failure domain | Lowest | Lowest | Good to ~100s of tenants on one Postgres [E] | **Adopt now** |
| 2. Shared app + separate DB for selected institutes | Better for those tenants | Smaller failure domains | Medium | Needs routing + per-DB migrations | Good | **Design-ready, build when a customer pays** |
| 3. Fully dedicated infra per enterprise | Best isolation | Independent | Highest | Highest (N stacks) | — | Only on contract |
| 4. Hybrid "cells" (1 by default, 2/3 as needed) | Per cell | Per cell | Pay as needed | Low at start | Best long-term | **Chosen target shape**: start as one cell |

**Hybrid-ready rules we follow from day one (cheap now, expensive to retrofit):**
1. Every tenant row has `institute_id NOT NULL`; parents expose `UNIQUE (institute_id, id)` and children use
   **composite foreign keys** so a row can never point at another institute's row.
2. No table mixes tenant data with other tenants' data except usage/audit tables, which are keyed by institute.
3. Global data (exam catalog) is **read-only reference data** that can be copied to another cell.
4. `institutes.cell` column exists (always `'main'` for now). Tenant resolution goes through one function, so a
   future router can send a host to a different cell.
5. All storage paths start with `{institute_id}/`; an institute's files can be exported or moved by prefix.

## 3. System diagram

```
                         Browsers (desktop + mobile web, PWA later)
       admin.examedge.ai        {slug}.examedge.ai  (institute staff + students)
                 │                        │
                 └──────────┬─────────────┘
                            ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ WEB APP — Next.js on Vercel  (one codebase, routes by host + role)        │
│  • Tenant resolution: Host header → institute (never trusted from client) │
│  • Server components / server actions / route handlers                    │
│  • Talks to Supabase with the *user's* session → RLS always applies       │
│  • AI gateway module (tutor chat streaming)                               │
└──────────────┬───────────────────────────────┬────────────────────────────┘
               │ user JWT (RLS)                │ enqueue jobs (tenant-tagged)
               ▼                               ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ SUPABASE  (region ap-south-1 Mumbai [V])                                  │
│  Postgres: tenant tables + RLS · pgvector · full-text search · pg-boss    │
│  Auth: Google OAuth only (Phase 2) · Storage: private buckets per prefix  │
└──────────────▲───────────────────────────────▲────────────────────────────┘
               │ role `worker` + per-job       │
               │ tenant context (RLS applies)  │
┌──────────────┴───────────────────────────────┴────────────────────────────┐
│ WORKER — Node/TypeScript container on Railway [D: host]                   │
│  ingestion · AI generation · grading/rank release · emails · sweepers     │
│  (Release 2–3: audio TTS, video render with Remotion/Manim + ffmpeg)      │
└──────────────┬────────────────────────────────────────────────────────────┘
               │ all AI calls go through the AI gateway (metering + quotas)
               ▼
  Anthropic (Claude) · Voyage (embeddings, rerank) · Resend (email)
  Sentry (errors) · Release 2+: Sarvam (TTS), Razorpay (payments)
```

## 4. Components in simple English

| Component | What it does | Why it exists |
|---|---|---|
| **Web app (Next.js on Vercel)** | Serves every page: platform admin, institute dashboard, student portal. Streams tutor answers. | One codebase for all three levels keeps work small (ADR-003). |
| **Tenant resolver** | Reads the web address, finds the institute, then checks the signed-in user's membership in the database. | The browser can lie; the address + DB membership cannot be forged by the user. |
| **Supabase Postgres** | Stores everything. Row-Level Security policies decide which rows each user sees. | Isolation enforced at the lowest layer, so app bugs fail closed (ADR-002). |
| **pgvector + full-text search** | Finds the most relevant note passages for a question. | Same database = same RLS = no separate vector store to secure (ADR-006). |
| **Supabase Auth** | Google sign-in. Proves *who* the user is. | Does **not** grant institute access — only an accepted invitation does (ADR-004). |
| **Supabase Storage** | Holds PDFs, images, generated audio/video in private buckets under `{institute_id}/…`. | Storage policies + short-lived signed URLs. |
| **pg-boss queue (inside Postgres)** | Background job queue with retries, dead-letter, cron. | No extra vendor; jobs are transactional with our data (ADR-007). |
| **Worker** | Runs long tasks: read PDFs, OCR, embed, generate quizzes, release results, send emails, later render audio/video. | Vercel functions have time/size limits (300 s default, 800 s max on Pro [V]; 4.5 MB request body [V]). |
| **AI gateway (code module, not a service)** | The only code allowed to call AI providers. Checks quota, tags institute/user/feature, records tokens and cost, applies kill switch. | Prevents unbounded cost and untracked usage (ADR-009). |
| **Platform admin area** | Create institutes, set quotas, see usage, audited "break-glass" support access. | Central control without touching tenant data casually. |
| **Sentry + structured logs** | Errors and traces with IDs only (no names, emails, prompts). | Debugging without leaking student data. |

## 5. Request and data flows

### 5.1 Page load and tenant resolution
1. Browser requests `https://allen-kota.examedge.ai/subjects`.
2. Next.js middleware extracts host → calls `public.resolve_institute(host)` (returns id, name, branding only).
   Unknown host → 404. The resolved `institute_id` is put in a **server-only** request context, never read back from the client.
3. Supabase session cookie (host-only, httpOnly) identifies the user. Server code queries with the user's JWT.
4. RLS helper `private.is_member(institute_id, roles)` checks `memberships` on **every** query.
   A user who is a member of institute A visiting B's subdomain sees "You are not a member of this institute".
5. Membership is **not** stored in the JWT (claims can be stale until refresh [V]); it is read from the table each time (ADR-004).

### 5.2 Teacher uploads a PDF
1. Teacher picks subject/chapter/batches. Server action creates `documents` + `document_versions` (status `queued`)
   via RLS-protected insert and returns a **signed upload URL** for `institute-docs/{institute_id}/{document_id}/{version}/file.pdf`.
2. Browser uploads directly to Storage (avoids Vercel's 4.5 MB body limit [V]). Storage policy also checks the path prefix.
3. Server action confirms upload → enqueues `ingest_document {institute_id, document_version_id}` with
   singleton key = version id (duplicate enqueue is harmless). A sweeper re-enqueues versions stuck in `queued` > 5 min (lost-job repair).
4. Worker sets tenant context in a transaction, validates file (magic bytes, size, page count), extracts text per page,
   OCRs low-quality pages with Claude, chunks, embeds, and swaps chunks atomically. Status → `ready`.
5. Teacher reviews and **publishes** to selected batches. Only now can those students retrieve it.

### 5.3 Student asks the AI tutor
1. Student on Physics page sends a question → route handler (streaming).
2. AI gateway: quota check (institute budget, student daily limits) → reject politely if exceeded.
3. Retrieval (RLS-bound): institute chunks from **published documents for the student's batches in this subject**
   (R1.1: the topic's notes; no shared library, ADR-037). Hybrid vector + keyword, fused.
4. Claude receives the passages as `search_result` blocks with citations enabled [V]. Default model Haiku 5.5;
   escalates to Sonnet 5.5 for hard problems within quota (ADR-008).
5. Answer streams back; each paragraph is labelled **Institute notes / General explanation**.
6. Gateway writes `usage_records` (tokens, cost) and the message is stored in the student's private conversation.

### 5.4 Test attempt
1. Student opens a live test → RPC `start_attempt(test_id)` creates the attempt with server-computed `deadline_at`.
2. Questions are served **without** answer keys (keys live in a separate table students cannot read).
3. Each answer is saved via RPC `save_answer` which rejects writes after `deadline_at` (database time).
4. On submit or deadline, worker grades from keys. Results and ranks are computed when `results_release_at` passes.

### 5.5 Background job (any)
```
web/server ──enqueue {institute_id, ids…, idempotency key}──► pg-boss
worker: BEGIN; SET LOCAL ROLE worker; set_config('app.institute_id', $id, true);
        … do work; RLS limits every query to that institute …
        COMMIT  (retries with backoff; dead-letter after N failures; status mirrored on domain row)
```
`set_config(..., true)` is **transaction-local**, which is safe with Supabase's transaction-mode pooler.
Session-level `SET` is forbidden in worker code (pooled connections would leak tenant context) — enforced by a lint/grep check (TEST_STRATEGY §4).

## 6. Cross-cutting concerns

| Concern | Design (MVP) | Later |
|---|---|---|
| **AuthN** | Supabase Auth, Google provider only; host-only cookies per subdomain [R]; platform admins require MFA (TOTP) [U: verify Supabase MFA setup in Phase 2]. | Phone OTP for students without Google accounts [D]. |
| **AuthZ** | Roles per institute: owner, admin, teacher, student. Platform admin is separate. Matrix in SECURITY_THREAT_MODEL §2. | Custom roles. |
| **Tenant resolution** | Host → `institute_domains` → `institutes`. Local dev uses `{slug}.localhost` [R]. | Custom domains (TLS via Vercel) [D]. |
| **DB isolation** | RLS on every exposed table + composite FKs + automated policy-coverage tests. | Separate cell per enterprise. |
| **Storage isolation** | Private buckets; first path segment = institute_id; policies check membership; signed URLs ≤ 5 min [R]. | Zero-egress CDN for video [D]. |
| **Vector isolation** | Same tables + RLS; queries pre-filter by institute and subject; **no shared ANN index across tenants for MVP** (exact search on the filtered set) because filtered HNSW loses recall and lets tenants affect each other [V pgvector README]. | Per-tenant partitions or partial HNSW indexes when a tenant exceeds ~100k chunks [E]. |
| **Jobs** | pg-boss; payload carries institute_id; worker sets transaction-local tenant context; idempotency keys; sweepers. | Separate queues per job class with concurrency per institute. |
| **AI calls** | Only via AI gateway; per-feature model routing; tenant-tagged metering. | Provider fallback (e.g., a second LLM vendor) [D]. |
| **Audio/video** | Not in MVP. | Worker container with ffmpeg; Remotion (licence!) / Manim (MIT [V]). |
| **Caching** | No shared cache service. Authenticated pages are dynamic (`no-store`). Institute-level generated artifacts are reused by `(institute_id, kind, input_hash, prompt_version)` key. | Redis only if measured need. |
| **Rate limits & quotas** | Postgres counters (atomic upsert) per user/day + institute monthly AI budget; hard stop + alerts. | Edge rate limiting (Vercel WAF) [U]. |
| **Billing & metering** | Metering from day one (`usage_records`). Pilot billed manually by invoice. | Razorpay Subscriptions (UPI AutoPay, cards, eMandate [V]). |
| **Logging & monitoring** | Sentry (PII scrubbing), JSON logs with `request_id`, `institute_id`, `user_id` (UUIDs only); uptime check; spend alerts at providers. | Dashboards, log retention policy. |
| **Migrations** | Supabase CLI SQL migrations in git; CI applies to staging on merge; production via manual-approval workflow; expand → migrate → contract for breaking changes. | — |
| **Backups & DR** | Supabase Pro daily backups, 7-day retention [V]. **Storage files are NOT in DB backups [V]** → nightly copy of buckets + nightly `pg_dump` to independent storage [D: provider]. Restore drill before pilot. Pilot targets RPO 24 h / RTO 8 h [R]. | PITR ($100/mo per 7 days retention [V]; RPO ≈ 2 min [V]) at public launch. |
| **Environments** | local (Supabase CLI + Docker), staging, production — separate Supabase projects, separate provider keys. | Preview DB branches [D]. |
| **Enterprise** | Hybrid-ready rules (§2). | Dedicated cell, SSO, custom domain, data-residency contract. |

## 7. Deployment topology

| Environment | Web | Database/Auth/Storage | Worker | AI keys |
|---|---|---|---|---|
| Local | `next dev` on `*.localhost` | Supabase CLI local stack (needs Docker — **not installed** on this Mac) | `node` locally | Dev keys, low spend cap |
| Staging | Vercel Preview/Staging | Supabase project `examedge-staging` | Railway staging service | Staging keys, low cap |
| Production | Vercel Production (Mumbai region `bom1` [U]) | Supabase project `examedge-prod` (ap-south-1 [V]) | Railway production [U: region near Mumbai] | Prod keys, spend alerts |

## 8. Repository layout (proposed, created in Phase 1)

```
examedge_ai/
  apps/web/            Next.js app (all portals)
  apps/worker/         Node worker (pg-boss consumers)
  packages/core/       domain logic, zod schemas, AI gateway, tenant context helpers
  supabase/migrations/ SQL migrations (source of truth for schema + RLS)
  supabase/tests/      pgTAP tests (RLS matrix, policy coverage)
  e2e/                 Playwright tests (two-institute fixtures)
  evals/               AI golden sets + scoring scripts
  docs/                these planning documents
```
npm workspaces (npm 11 installed; pnpm not installed) [R].
