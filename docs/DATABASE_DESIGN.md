# ExamEdge AI — Database Design

Status: **Draft for approval** · Last updated: 2026-10-14 · Labels: see [ARCHITECTURE.md](ARCHITECTURE.md) header.
Source of truth after Phase 1 = SQL migrations in `supabase/migrations/`. This document is the design they implement.

## 1. Ownership classes

| Class | Meaning | Examples | Who can read |
|---|---|---|---|
| **G — Global/platform** | Owned by ExamEdge, shared by all institutes, read-only to tenants | exams, institutes (own row only) | Any authenticated user; writes = platform admins |
| **T — Tenant** | Owned by one institute | batches, subjects, documents, tests | Members of that institute per role |
| **S — Student-private (inside a tenant)** | Owned by one student within one institute | conversations, messages, practice_attempts, student-scope artifacts | That student; staff see **aggregates only** by default (open question Q-03) |
| **O — Operational** | Metering, audit, jobs | usage_records, audit_events, pg-boss schema | Platform admins; institute owners/admins see their own institute's rows |

**Rule:** adding `institute_id` is not isolation. Isolation = (1) RLS policy on every table, (2) composite FKs so
cross-tenant references are impossible, (3) no privileged role in request paths, (4) automated tests (TEST_STRATEGY §3).

## 2. Conventions

- PK: `id uuid default gen_random_uuid()` unless noted. Timestamps `timestamptz default now()`.
- Every tenant table: `institute_id uuid not null references institutes(id)`, plus `unique (institute_id, id)` on
  tables that are referenced by children. Children reference `(institute_id, parent_id)` → `parent(institute_id, id)`.
- Soft delete via `deleted_at` only where recovery matters (documents); everything else hard-deletes with cascade.
- Enums as Postgres `text` + `check` constraints (easier migrations than enum types) [R].
- Case-insensitive identifiers (slug, hostname, email) are lowercase-checked `text`, not `citext` (ADR-021).
- Every exposed table: `alter table … enable row level security` — enforced by a pgTAP test.
- Views: `with (security_invoker = true)` only (views otherwise bypass RLS [V]).
- `SECURITY DEFINER` functions: only in schema `private` (not exposed by the API), `set search_path = ''`,
  fully qualified names [V]. Allowlist enforced by a pgTAP test.
- RLS helper calls wrapped as `(select private.fn(...))` for per-statement caching [V]; every policy column indexed [V].

## 3. RLS helper functions (schema `private`, SECURITY DEFINER, stable)

| Function | Returns true when |
|---|---|
| `private.uid()` | wrapper for `auth.uid()` (null for anon) |
| `private.is_platform_admin()` | caller in `platform_admins` |
| `private.has_role(inst uuid, roles text[])` | caller has an **active** membership in `inst` with one of `roles` |
| `private.member_id(inst uuid)` | caller's membership id in `inst` (or null) |
| `private.in_batch(batch uuid)` | caller's membership is in `batch_members` for that batch (any batch role) |
| `private.teaches_batch(batch uuid)` | caller is teacher in that batch, or admin/owner of its institute |
| `private.can_read_document(doc uuid)` | staff of the institute, **or** student enrolled in a batch in `document_audience` and doc `status='published'` and `deleted_at is null` |
| `private.job_institute()` | `nullif(current_setting('app.institute_id', true), '')::uuid` — worker tenant context |

Role hierarchy: `owner ⊃ admin ⊃ teacher`; `student` is separate. "staff" = owner, admin, teacher.

## 4. Tables — MVP (Release 1)

Format: **purpose · keys · columns · indexes/constraints · deletion · access (S=select, I=insert, U=update, D=delete)**.

### 4.1 Global / platform

**institutes** (G-ish: one row per tenant, read by own members)
- Purpose: the tenant. Columns: `slug citext unique` (subdomain; `^[a-z0-9-]{3,40}$`), `name`, `status` (`pilot|active|suspended|offboarding`), `cell text default 'main'`, `branding jsonb` (logo path, primary colour), `created_at`.
- Deletion: offboarding → export → hard delete after 30-day grace [A, Q-07]. An institute nobody has joined can be deleted at once from the platform admin (`delete_institute`, ADR-033). Until an owner joins, the platform admin can replace the owner invitation (`reinvite_owner`, ADR-036). `suspended` blocks all member access in `has_role`.
- Access: S own institute (any active member) / platform admin all. I/U/D platform admin only (via RPC).

**institute_domains**
- `hostname citext unique`, `institute_id`, `kind` (`subdomain|custom`), `verified_at`.
- Access: no direct S for users. Read only through `public.resolve_institute(host)` (SECURITY DEFINER in `private`, exposed wrapper returns `id, slug, name, branding` only). Platform admin manages.

**profiles** — `user_id uuid pk references auth.users on delete cascade`, `full_name`, `avatar_url`.
- Access: S self; S by staff of any institute where the profile's user is an active member (helper `private.shares_institute_as_staff(user_id)`). U self (name only). Email comes from `auth.users`, never copied into tenant tables except `invitations.email`.

**platform_admins** — `user_id pk`, `granted_by`, `granted_at`. Access: none via API; managed by migration/ops script. MFA required (Phase 2 acceptance).

**exams** — `code text unique` (`JEE_MAIN`, `NEET_UG`…), `name`. S all authenticated. Writes platform admin.

**Library tables — removed in R1.1 (ADR-037).** `library_subjects/chapters/topics/items/chunks`, `match_library_chunks`,
`publish_library_item` and platform metering (`library_embed`) are dropped; ExamEdge shares no content with institutes.

### 4.2 Tenant core

**memberships** (T)
- `institute_id`, `user_id → auth.users`, `role` (`owner|admin|teacher|student`), `status` (`active|suspended|removed`), `created_at`, `removed_at`.
- `unique (institute_id, user_id)`; `unique (institute_id, id)`; index `(user_id, institute_id) where status='active'`.
- Deletion: set `removed` (keeps history for test results); hard delete with institute.
- Access: S own row; S all rows of institute for admin/owner; S rows of students in teacher's batches for teachers. I only via `accept_invitation` RPC or owner/admin RPC. U role/status: owner/admin (owner role changes: owner only). No student writes.

**invitations** (T)
- `institute_id`, `email citext`, `role`, `batch_id` (nullable; composite FK), `token_hash bytea unique` (SHA-256 of a 32-byte random token; raw token only in the email), `expires_at` (default +7 days), `accepted_at`, `accepted_by`, `revoked_at`, `created_by`.
- Partial unique `(institute_id, email) where accepted_at is null and revoked_at is null`.
- Acceptance (RPC `accept_invitation(token)`, SECURITY DEFINER): token valid, unexpired, unrevoked, unaccepted **and** caller's verified Google email equals `email` (case-insensitive) → creates membership (+ batch membership) in one transaction, marks accepted, writes audit event. Rate-limited.
- Access: S/I/U owner/admin (teachers may invite students to batches they teach [R]). Students none.

**batches** (T) — `name`, `academic_year`, `exam_id → exams` (nullable), `archived_at`; `unique(institute_id, name, academic_year)`, `unique(institute_id,id)`.
- S staff; S students in batch. I/U/D admin/owner.

**batch_members** (T) — pk `(batch_id, membership_id)`, `institute_id`, `batch_role` (`teacher|student`), `left_at` (R1.1, ADR-040: null = current; set when a student is promoted to a new batch — the row is kept so the student still sees their own year read-only; `start_attempt` refuses tests of a left batch). Composite FKs to `batches(institute_id,id)` and `memberships(institute_id,id)`. Index `(membership_id)`.
- Check: `batch_role='student'` requires membership role `student` (trigger) — prevents a student being made a batch teacher.
- S staff of institute; S own rows. I/D admin/owner (teachers for students in own batches [R]). U `left_at` owner/admin. Promotion = `move_students(from_batch, to_batch, members)` (invoker, one statement: old rows get `left_at`, new rows are inserted).

**subjects** (T) — `batch_id` (composite FK → batches, R1.1 ADR-038), `name`; `unique(institute_id, batch_id, name)`, `unique(institute_id,id)`. A subject belongs to exactly one batch (`batch_subjects` dropped in R1.1).
**chapters** (T) — shown as **Topic** in the UI (DB name kept, ADR-038). `subject_id` (composite FK), `name`, `position`; `unique(institute_id, subject_id, id)`.
**subtopics** (T, R1.1) — `subject_id`, `chapter_id` (3-column composite FK → chapters), `name`, `position`; `unique(institute_id, chapter_id, id)`. Notes are uploaded into a subtopic, never onto a topic.
- Access for all three: S owner/admin all; teachers subjects of batches they teach; students subjects of batches they are or were in (`private.has_subject`). Writes: subjects owner/admin; topics/subtopics owner/admin/teacher [R].

### 4.3 Documents and retrieval (T)

**documents** — `subject_id`, `chapter_id`, `subtopic_id` (R1.1: both `not null`, composite FKs; ADR-038), `kind` (`file|ai_notes`, set on insert; AI notes = a Markdown version, ADR-039), `title`, `current_version_id`, `status` (`draft|published|withdrawn`), `published_at`, `withdrawn_at`, `deleted_at`, `created_by`.
- Index `(institute_id, subject_id) where deleted_at is null`.
- S `private.can_read_document(id)`. I/U staff. D: soft delete by staff; after 30 days the daily purge deletes the files (worker service account, Storage API) and then the rows (ADR-031).

**document_versions** — `document_id` (composite FK), `version int`, `storage_path text unique`, `mime` (`application/pdf|image/png|image/jpeg|text/markdown`; Markdown = AI notes, ADR-039), `size_bytes` (≤ 50 MiB), `sha256`, `page_count`, `processing_status` (`uploading|queued|processing|ready|failed`), `error_code`, `extraction_method` (`text_layer|ocr|mixed`), `chunker_version`, `embedding_model`, `claimed_at` (worker claim; stale claims are re-run), `processed_at`; `unique(document_id, version)`.
- Constraint: `storage_path = institute_id || '/' || document_id || '/' || id` (check). API users may only move a version to `queued` (trigger); the worker sets everything else (ADR-024).
- S staff. Students never see versions directly (they read the current published version via signed URL RPC).

**document_audience** — pk `(document_id, batch_id)`, `institute_id`, composite FKs. Which batches see a published document; R1.1: only the subject's own batch (trigger).

**document_chunks** — `document_id`, `document_version_id` (composite FKs), `subject_id` (denormalised for filtering; trigger keeps in sync), `chunk_index`, `page_start`, `page_end`, `heading_path`, `content`, `tsv tsvector generated always as (to_tsvector('simple', content))`, `embedding vector(1024)`, `token_count`.
- `unique (document_version_id, chunk_index)`; btree `(institute_id, subject_id, document_id)`; GIN `(tsv)`.
- **No HNSW index in MVP** — retrieval uses exact distance over the pre-filtered set (one subject of one institute ≈ thousands of chunks [E]) (ADR-006).
- S via `private.can_read_document(document_id)` (backstop); retrieval goes through `public.match_chunks(...)` (SECURITY INVOKER) which first resolves readable document ids. Writes: worker only (tenant context).
- Deletion: chunks of superseded versions deleted in the same transaction that promotes the new version.

**private.service_accounts** — `user_id`, `kind` (`worker`). The worker's Supabase Auth user for Storage downloads; storage policy lets it read only objects whose version is `queued|processing` (ADR-024).

### 4.4 AI conversations and generated content

**conversations** (S) — `user_id`, `subject_id`, `chapter_id` (R1.1: Smart Study chats are per topic; composite FKs), `title`, `created_at` (no `deleted_at`: a deleted chat is gone; ADR-026). Index `(institute_id, user_id, created_at desc)`.
- S/I/D owner (any active member; insert only on a subject the caller can read). Staff: none — counts per subject via `tutor_activity(inst, student)` (definer, same callers as `student_progress`), pending Q-03.

**messages** (S) — `conversation_id` (composite FK), `role` (`user|assistant`), `content`, `citations jsonb` (list of `{source_kind, document_id, title, page_start, page_end, cited_text}`), `answer_labels jsonb` (`[{label: notes|general, citations: [index]}]` per paragraph; old rows may say `library`, ADR-037), `model`, `usage_record_id`, `feedback` (`up|down|null`), `created_at`.
- S/I owner (rows written by the server in the user's session after the answer is complete); U `feedback` only. Retention 12 months then deleted daily by `purge_expired()` (chats left empty go too) [A, Q-06].

**answer_reports** (T) — `subject_id` (composite FK), `message_id` (unique; composite FK, `on delete set null`), `reported_by`, `question`, `answer`, `citations`, `reason` (≤ 500), `created_at`, `resolved_at`, `resolved_by`.
- Written only by definer `report_answer(msg, why)` (caller must own the conversation): a copy, so it survives the chat being deleted. S/U(`resolved_at`, `resolved_by`) staff of the institute; `reported_by` has no column grant (staff never see who reported). Students: none.

`match_chunks(query_embedding, query_text, subject, k, topic default null)` (invoker; `topic` = a chapter id, R1.1 Smart Study; null = whole subject) returns `institute_id` and `similarity` with each chunk so the tutor can assert the tenant (TH-06) and evals can record scores.

**generated_artifacts** (T or S, as built in Phase 9, ADR-028) — `owner_scope` (`institute|student`), `owner_user_id` (set by trigger iff student), `kind` (`summary|flashcards|mind_map|quiz`; more kinds in R2/R3), `subject_id`, `chapter_id` (3-column composite FK `(institute_id, subject_id, chapter_id)` → chapters), `source_refs jsonb` (`[{document_id, title, page_start, page_end}]`, cited by index in `content`), `input_hash` (sha256 hex), `prompt_version`, `model`, `schema_version`, `content jsonb` (≤ 200 KB), `status` (`draft|published|withdrawn`), `usage_record_id`, `created_by`, `approved_by`, `approved_at`. Checks: student scope ⇔ owner set; student artifacts stay `draft`; `published` ⇒ `approved_at`.
- Partial unique `(institute_id, kind, input_hash, prompt_version) where owner_scope='institute'` and `(institute_id, owner_user_id, kind, input_hash, prompt_version) where owner_scope='student'` → generate once, reuse.
- Trigger `guard_artifact`: insert = `draft` with owner/creator from `auth.uid()`; a content edit → `draft`; publishing needs ≥ 1 audience row and stamps the approver.
- S: student scope → owner only; institute scope → staff of the institute, students only `published` with an audience batch they belong to (`private.can_read_artifact`). I: students (student scope, on a readable subject) / staff (institute scope). U (`content`, `status`) / D: staff (institute scope), owner student (own rows).

**artifact_audience** (T) — pk `(artifact_id, batch_id)`, `institute_id`, composite FKs to artifact and batch (replaces the planned `audience_batch_ids uuid[]`). Staff of the institute; teachers only batches they teach; audited.

### 4.5 Assessments

**questions** (T) — `subject_id`, `chapter_id`, `type` (`single|multi|numerical|written`; written = theory answer typed by the student, checked by a teacher), `stem` (Markdown + LaTeX), `options jsonb` (`[{id, text}]`), `explanation`, `difficulty`, `origin` (`teacher|ai|library`), `verification` (`unverified|dual_solve_agree|dual_solve_disagree|teacher_verified`), `status` (`draft|approved|retired`), `created_by`.
- Trigger: no UPDATE of `stem/options` once referenced by a non-draft test (edit = new question) — preserves grading integrity.
- Trigger `review` (ADR-032): `origin = 'ai'` rows are inserted as `draft`; `approved` is refused while `verification` is `unverified` or `dual_solve_disagree`; `verification` can only change to `teacher_verified`. AI questions are stored with their keys by `add_ai_questions(inst, subject, chapter, items)` (invoker, one transaction). AI test (ADR-039): `add_ai_test(inst, subject, chapter, title, opens, closes, seconds, items)` (invoker, one transaction) stores the questions + keys, a **draft** test for the subject's own batch and its `test_questions` (`marks` per item; the web uses MCQ 4, theory 5).
- S staff. Students **never** select questions directly; they get stems/options through `get_attempt_questions(attempt_id)` RPC.

**question_keys** (T) — pk `question_id`, `institute_id`, `key jsonb` (`{correct:[optionIds]}`, `{value, tolerance_abs|tolerance_pct, unit}`, or for written questions `{model_answer, max_marks}` — the teacher's reference answer, a guide only, never auto-graded), `second_solve jsonb` (AI questions: the blind second answer, `{correct}` or `{value}`; null if it did not run).
- Separate table so no student-visible policy can ever expose keys. S/I/U staff only. Students: none, ever. Post-release answers shown via `get_attempt_review(attempt_id)` RPC that checks `results_release_at <= now()`.

**tests** (T) — `title`, `opens_at`, `closes_at`, `duration_seconds`, `marking jsonb` (default marks/negative), `shuffle_questions bool`, `results_release_at`, `status` (`draft|scheduled|closed|grading|results_released|cancelled`), `created_by`.
- Checks: `closes_at > opens_at`; `results_release_at >= closes_at`.
- A test with written questions moves `closed → grading`; results can be released only when every written answer has teacher marks (enforced in the `release_results` RPC).
- S staff (teachers: tests targeting their batches); students: tests whose audience includes their batch and `status <> 'draft'`.

**test_questions** — pk `(test_id, question_id)`, `institute_id`, `position`, `marks`, `negative_marks`; composite FKs.
**test_audience** — pk `(test_id, batch_id)`, composite FKs.

**test_attempts** (S) — `test_id`, `user_id`, `membership_id`, `started_at`, `deadline_at` (server: `least(started_at + duration, closes_at)`), `submitted_at`, `status` (`in_progress|submitted|auto_submitted|graded`), `score`, `max_score`, `rank`, `percentile`, `question_order int[]`.
- `unique (test_id, user_id)` (single attempt). Index `(institute_id, test_id, score desc)`.
- S own attempt; S staff (teachers only for their batches). I via `start_attempt` RPC only. U via `submit_attempt` RPC / worker. Rank written only by release job.

**attempt_answers** (S) — pk `(attempt_id, question_id)`, `institute_id`, `response jsonb` (option ids, a number, or typed text for written questions), `answered_at`, `is_correct`, `marks_awarded`, `graded_by`, `graded_at`, `teacher_comment`.
- I/U via `save_answer` RPC only: checks caller owns attempt, `status='in_progress'`, `now() < deadline_at` (DB clock), question belongs to the test. Students cannot set `is_correct/marks_awarded` (column privileges).
- Objective answers (single/multi/numerical) are marked automatically. Written answers are marked **only by a teacher** of that batch (or admin) via `grade_answer` RPC: `0 ≤ marks ≤ max` (half marks allowed), optional comment, audited. Changing marks after release recalculates both ranks.

**practice_attempts** (S) — `user_id`, `artifact_id` (composite FK; the student's own or a published quiz), `answers jsonb` (`{question id: option id}`, only the quiz's ids), `score`, `max_score`, `completed_at`. No insert grant: written only by definer `submit_practice(art, answers)`, which grades in SQL and returns the per-question result. S owner only; staff get counts/averages per chapter via `practice_activity(inst, student)` (definer, same callers as `student_progress`). Never counts for rank.

**batch_standings** (T) — pk `(batch_id, user_id)`, `institute_id`, `average_percentage numeric(5,2)`, `total_marks`, `total_max_marks`, `tests_counted`, `tests_missed`, `overall_rank`, `updated_at`. Recomputed by the release job whenever a test's results are released or regraded. S: staff of the batch; students see their own row and the batch rank list.

Ranking rules (ADR-012, ADR-016) — **two ranks, both from institute-conducted tests only** (self-made practice quizzes never count):
- **Test rank:** `rank() over (partition by test_id order by score desc, (submitted_at - started_at) asc)` where score = auto MCQ/numerical marks + teacher marks for written answers; computed when results are released.
- **Overall rank:** within the batch, by **average percentage** = mean of (score ÷ max marks × 100) over all released tests of the batch that were open while the student was enrolled; a missed test counts as 0 %. Same average (2 decimals) = same rank. Decided by the founder on 2026-10-15 (Q-05) because tests can have very different total marks.

### 4.6 Metering, quotas, activity, audit, consent

**usage_records** (O) — `institute_id`, `user_id` (null for worker jobs), `feature`, `provider` (`fake|anthropic|voyage`), `model`, `counter_key` (daily counter used, refunded on `error`), `job_id`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_write_tokens`, `units` (pages/searches), `reserved_micro_usd`, `cost_micro_usd bigint`, `outcome` (`pending|ok|error|refused|quota_blocked`), `created_at`, `settled_at`.
- Written only by the definer RPCs (ADR-025): `ai_reserve`/`ai_settle` (member, user's session) and `ai_reserve_job`/`ai_settle_job` (worker, job tenant context). No INSERT/UPDATE/DELETE grant to any API role. A `pending` row counts its reservation against the budget until settled once. Index `(institute_id, created_at)`. Monthly partitioning when > ~10M rows [E].
- S owner/admin of institute (own institute), platform admin all. `public.usage_summary(inst)` = this month per feature (invoker, RLS decides).

**institute_quotas** (T) — pk `institute_id`, `monthly_ai_budget_micro_usd`, `student_daily_messages`, `student_daily_premium_messages`, `student_daily_generations`, `max_storage_bytes`, `max_upload_bytes`, `max_concurrent_jobs`, `hard_stop bool`, `ai_enabled bool` (per-institute kill switch). S owner/admin; U platform admin. Every reservation locks the institute's row (serialises reservations, AC5.3). Upload/storage limits are enforced by trigger `guard_upload` on `document_versions` insert, job concurrency by `pending_jobs` + `job_slot_free()` (ADR-029).

**usage_counters** (O) — pk `(institute_id, user_id, day, counter_key)` (`day` = India date; `counter_key` `messages|premium_messages|generations`), `value int`. Students only; updated with `insert … on conflict do update set value = value + 1 where value < limit returning value` inside the reservation (atomic). S own row; owner/admin of institute. Rows older than 35 days purged daily by `purge_expired()` (worker, ADR-029).

**private.ai_features** — feature → `who` (`member|worker`), `counter_key`, `max_reserve_micro_usd`. `ai_reserve` refuses `question_gen` and `notes_gen` (staff AI: AI test, AI notes ≤ 0.5 USD) to students and `tutor`, `tutor_premium`, `generation` (Smart Study) to staff (ADR-039). **private.settings** — one row, platform-wide `ai_enabled` (changed only by `set_ai_enabled`, aal2 platform admin, audited).

**activity_events** (S/O) — `user_id`, `type` (`login|document_opened|tutor_message|practice_completed|test_submitted|artifact_generated`), `subject_id`, `ref_id`, `created_at`. **No free text.** Retention 12 months [A, legal Q-01]. S own rows; staff aggregates only via functions.

**audit_events** (O) — `institute_id` (nullable for platform actions), `actor_user_id`, `actor_kind` (`user|platform_admin|worker|system`), `action`, `target_type`, `target_id`, `metadata jsonb` (ids only), `ip_hash`, `created_at`. Append-only. S owner/admin own institute; platform admin all. Written by triggers/RPCs on sensitive actions (role change, invitation, publish/withdraw, test release, break-glass access, export, delete).

**consent_records** (S) — `user_id`, `kind` (`terms|privacy|guardian_consent|ai_processing`), `policy_version`, `method`, `granted_at`, `withdrawn_at`, `evidence_ref`. Process design blocked on legal review (Q-01); table exists so consent can be recorded from day one.

**pg-boss schema** — managed by pg-boss. Not exposed via API. Worker role has access. Payloads: ids only (no PII, no document text).

## 5. Deferred tables (with release)

| Table | Release | Note |
|---|---|---|
| `subscriptions`, `invoices`, `payment_events (provider, event_id unique)` | R2 | Razorpay; `event_id` unique = idempotent webhooks |
| `ai_grading_suggestions` | R2 | Optional AI-suggested marks for written answers shown to the teacher; teacher marks stay final |
| `topic_mastery (institute_id, user_id, chapter_id, accuracy, attempts, updated_at)` | R2 | Feeds recommendations; derived, rebuildable |
| `notifications` | R2 | In-app + email |
| `media_assets` (audio/video renders) | R2/R3 | Or `generated_artifacts.asset_path` if sufficient |
| `batch_join_codes` | R2 | Join requests require staff approval (never auto-membership) |
| `support_sessions` (break-glass) | R1 if a pilot needs support access, else R2 | Time-boxed, audited, visible to institute owner |

## 6. Database roles and privileged paths

| Role | Used by | RLS | Notes |
|---|---|---|---|
| `anon` | Unauthenticated requests | Yes | Can call only `resolve_institute` |
| `authenticated` | Web app with user JWT | Yes | All request paths |
| `worker` (custom, `NOBYPASSRLS`) | Worker via direct/pooler connection | Yes, policies `to worker using (institute_id = private.job_institute())` | Tenant context set per transaction with `set_config(..., true)` |
| `service_role` / secret key | **Ops scripts only** (create institute, break-glass) | **Bypasses RLS** [V] | Not present in Vercel or worker env (ADR-005) |
| `postgres` | Migrations in CI | Bypasses | CI only, protected environment |

**Risks addressed:** (1) connection poolers — session `SET` forbidden; transaction-local only. (2) security definer
functions — `private` schema + empty `search_path` + allowlist test. (3) views — `security_invoker`. (4) the secret key
bypasses RLS only when no user token is sent [V]; we avoid it entirely in request paths. (5) `raw_user_meta_data` is
user-editable [V] → never used for authorization.

## 7. Migrations, retention, deletion

- Migrations are forward-only SQL; destructive changes use expand → backfill → contract across two releases.
- Every migration PR runs: pgTAP suite, policy coverage test, `supabase db lint` [U: verify command], and E2E isolation tests.
- Deletion cascade: institute → all T/S rows (FK `on delete cascade`) + daily purge of files no row points to (ADR-031) + audit record kept (institute_id nulled, action retained).
- Student removal from institute: membership `removed` immediately (access ends); their S data retained per policy then erased (Q-06).
- Right to erasure (DPDP) handled by an RPC that deletes a user's S data across institutes and anonymises attempts (scores kept for rank integrity if lawful — Q-01).
