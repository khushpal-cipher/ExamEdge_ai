# ExamEdge AI — Implementation Roadmap

Status: **Draft for approval** · Last updated: 2026-10-14 · Labels: see [ARCHITECTURE.md](ARCHITECTURE.md) header.
Every phase ends with the quality gate in [TEST_STRATEGY.md](TEST_STRATEGY.md) §6. Evidence goes in [PROGRESS.md](../PROGRESS.md).
Each phase is annotated with a recommended model and effort level (per the founder's CLAUDE.md rule).

## 1. Changes to the proposed order (and why)

| Proposed | Revised | Reason |
|---|---|---|
| 3 Auth & membership, 4 Isolation tests | **Merged into Phase 2** | RLS must be written together with the tables; testing isolation afterwards invites gaps. |
| 10 Usage metering & quotas (after tutor) | **Phase 5, before the tutor** | Exposing AI to students without quotas = unbounded cost (TH-12). |
| 13 Observability, deployment at the end | **Phase 1** (CI, Sentry, staging deploy) | Errors must be visible from the first feature; deployments are rehearsed early. |
| 9 Quiz & testing after library | **Phase 7, can run in parallel with 4–6** | Tests/ranks need no ingestion; they are the institutes' core need. |
| 8 Shared library before quizzes | **Phase 8 after tutor** | Library reuses the retrieval built in Phase 6; content needs expert review time. |
| Billing in MVP | **Release 2** | Pilot invoices manually; Razorpay only after price is validated. |
| — | **Legal review track starts now** (parallel, blocks pilot launch) | Minors' data (DPDP) — Q-01. |

## 2. Dependency graph and critical path

```
P0 Plan ─► P1 Foundations ─► P2 Identity+Tenancy+Isolation ─► P3 Portals shell ─┬─► P4 Documents ─► P5 AI gateway ─► P6 Tutor ─► P8 Library ─┐
                                                                                 │                         └──► P9 Studio basics ──────────────┤
                                                                                 └─► P7 Tests & ranks (deterministic part; AI question gen after P5) ─┤
Legal/consent track (parallel from now) ──────────────────────────────────────────────────────────────────────────────────────────────────────────┴─► P10 Pilot hardening & launch
```
**Critical path:** P0 → P1 → P2 → P3 → P4 → P5 → P6 → P10. P7, P8, P9 and the legal track can be reordered or overlapped (solo founder: "parallel" means order-flexible, not simultaneous).

## 3. Release 1 (pilot MVP) phases

---
### Phase 0 — Planning and approval (this session)
- **Objective:** approved, internally consistent plan; first phase specified with measurable acceptance criteria.
- **Required decisions:** founder approves architecture (ADR-001…012) and answers blocking questions Q-10, Q-11.
- **Tasks:** done in this session (docs in `docs/`, `PROGRESS.md`, `CLAUDE.md`).
- **Completion gate:** founder's explicit approval recorded in PROGRESS.md.
- → Model: opus · Effort: high · Why: architecture-defining planning.

---
### Phase 1 — Foundations
- **Objective:** an empty but production-shaped project: repo, workspaces, Next.js + worker skeletons, local Supabase, CI, Sentry, staging deploy of a health page.
- **Required decisions:** Q-10 (separate git repo), Q-11 (Docker runtime), domain name purchase (can be staging subdomain of a Vercel URL initially).
- **Dependencies:** Phase 0 approval.
- **Tasks:**
  1. `git init` in `examedge_ai/` (parent repo ignores this folder), private GitHub repo, branch protection on `main`.
  2. npm workspaces: `apps/web` (Next.js, TypeScript strict), `apps/worker` (Node 22+ TS), `packages/core`.
  3. Supabase CLI + `supabase init`; local stack runs; first migration enables `pgvector`, creates `private` schema; `supabase/tests/000_smoke.sql` (pgTAP).
  4. ESLint (incl. custom rule/grep for session `SET` in worker), Prettier, Vitest, Playwright skeleton.
  5. GitHub Actions: install (`npm ci`), lint, typecheck, unit, `supabase test db`, build, gitleaks, `npm audit --audit-level=high`; actions pinned by SHA.
  6. Sentry in web + worker with PII scrubbing `beforeSend`; JSON logger with `request_id`.
  7. `/api/health` (web) + worker heartbeat job via pg-boss.
  8. Staging: Supabase project (ap-south-1), Vercel project, Railway service; migrations applied by CI on merge to `main`.
  9. `.env.example` (names only), `.gitignore` covering `.env*` except example.
- **Files/modules:** root `package.json`, `apps/*`, `packages/core`, `supabase/config.toml`, `supabase/migrations/0001_init.sql`, `.github/workflows/ci.yml`, `.env.example`, `CLAUDE.md` (update commands).
- **Database changes:** extensions (`vector`), `private` schema, pg-boss schema created by worker on start.
- **Integrations:** GitHub, Supabase, Vercel, Railway, Sentry (no AI providers yet).
- **Automated tests:** smoke unit test; pgTAP smoke; Playwright opens `/api/health`; CI green on a PR.
- **Manual verification:** visit staging health URL; trigger a test error and see it in Sentry with no PII; worker heartbeat row visible.
- **Security checks:** G3 (gitleaks + bundle scan stub), G4 (audit); no secrets in repo history.
- **Acceptance criteria:**
  - AC1.1 `npm ci && npm run lint && npm run typecheck && npm test && npm run build` exit 0 locally and in CI.
  - AC1.2 `supabase start` + `supabase test db` pass locally and in CI.
  - AC1.3 A PR with a deliberately committed fake secret is **blocked** by gitleaks (then removed).
  - AC1.4 Staging `/api/health` returns 200 with commit SHA; worker heartbeat recorded within 2 minutes of deploy.
  - AC1.5 Sentry receives a test error from web and worker, tagged with environment; event contains no email/name.
  - AC1.6 Migration applied to staging by CI, not by hand.
- **Completion gate:** all ACs evidenced in PROGRESS.md.
- **Rollback:** everything is new; revert commits / delete staging resources.
- **Complexity:** medium. **Risks:** Docker not installed; Railway/Vercel region choice; Supabase CLI command drift → verify against current docs.
- → Model: haiku · Effort: low · Why: standard scaffolding with clear answers. (CI security steps: sonnet/medium.)

---
### Phase 2 — Identity, tenancy and isolation
- **Objective:** institutes, memberships, invitations, batches, subjects, chapters with RLS; Google login; tenant resolution; full isolation suite green.
- **Required decisions:** host-only cookies per subdomain vs shared parent-domain session (default host-only, ADR-004); invitation rules (Q-04).
- **Dependencies:** Phase 1.
- **Tasks:**
  1. Migrations for: institutes, institute_domains, profiles, platform_admins, memberships, invitations, batches, batch_members, subjects, batch_subjects, chapters, audit_events, consent_records, exams (seed), private helper functions, `resolve_institute`, `accept_invitation`.
  2. Composite unique/foreign keys per DATABASE_DESIGN §2; check constraints; indexes for every policy column.
  3. RLS policies per DATABASE_DESIGN §4; column privileges where needed.
  4. Supabase Auth: Google provider (staging OAuth client); redirect URL allowlist for `*.staging-domain` [U: verify wildcard support]; local `*.localhost`.
  5. Next.js middleware: host → institute; unknown host 404; session refresh via `@supabase/ssr` [U: verify current package/API].
  6. Invitation flow: admin creates invite (single + CSV), email via Resend from worker, accept page, email-match check, audit.
  7. Platform admin: ops script (secret key, local only) to create an institute + owner invitation; MFA enforcement for platform admins.
  8. Seed script for Institute A/B fixtures (TEST_STRATEGY §2).
  9. pgTAP: RLS matrix generator, policy coverage (T-ISO-05), T-ISO-01/02/03, invitation tests T-SEC-18.
  10. Playwright: login (test-mode auth for E2E [R: seed sessions via local auth admin API]), visit own vs other subdomain.
- **Files/modules:** `supabase/migrations/0002_tenancy.sql…`, `supabase/tests/rls_*.sql`, `apps/web/middleware.ts`, `apps/web/app/(auth)/…`, `apps/web/app/invite/[token]/…`, `apps/worker/jobs/send-invitation.ts`, `packages/core/tenant/*`, `scripts/create-institute.ts`, `supabase/seed.sql`.
- **Integrations:** Google OAuth, Resend.
- **Automated tests:** all above; CI must run them on every PR.
- **Manual verification:** two real Google accounts on staging: invite → accept → see own institute; other institute subdomain shows "not a member"; wrong-account acceptance rejected.
- **Security checks:** G1, G2; review every SECURITY DEFINER function line by line.
- **Acceptance criteria:**
  - AC2.1 Policy coverage test passes with 0 tables missing RLS/policies; 0 non-allowlisted definer functions.
  - AC2.2 Isolation matrix: for every tenant table × role (owner, admin, teacher, student, other-institute user, anon) × operation, actual = expected; report committed.
  - AC2.3 Google login alone creates **no** membership (test asserts zero rows).
  - AC2.4 Invitation acceptance with mismatched email, reused, expired and revoked tokens all fail; correct one succeeds once.
  - AC2.5 Forged `institute_id` in request bodies has no effect (T-SEC-04).
  - AC2.6 Every membership/role change writes an audit event.
  - AC2.7 Platform admin account cannot sign in to admin area without MFA.
- **Completion gate:** ACs + G1/G2 evidence; skeptical self-review of all policies recorded.
- **Rollback:** migrations are new tables; down path = drop in reverse order on staging; no production data yet.
- **Complexity:** high. **Risks:** RLS recursion/performance; OAuth redirect config per subdomain; email deliverability.
- → Model: opus · Effort: high · Why: security-critical foundation; re-verify Phase 1 CI wiring runs the DB tests before starting.

---
### Phase 3 — Portals shell
- **Objective:** usable navigation for platform admin, institute staff and students (no AI yet).
- **Dependencies:** Phase 2.
- **Tasks:** institute dashboard (batches, subjects/chapters, staff & students lists, invitations), student home (subject grid from batch_subjects), subject page skeleton (Sources / Chat / Studio panes, mobile layout), platform admin (institutes list, quotas form), branding (logo/colour per institute), accessible components, empty states.
- **Files:** `apps/web/app/(institute)/…`, `apps/web/app/(student)/…`, `apps/web/app/(platform)/…`, `packages/core/ui` only if reused ≥ 2 places.
- **DB changes:** none or minor (branding storage bucket + policy).
- **Tests:** Playwright journeys per role; axe accessibility check on key pages [R]; isolation E2E re-run.
- **Manual:** phone-width check (375 px) on student pages.
- **Security:** no new privileged paths; every server action derives institute from host.
- **Acceptance:** AC3.1 each role completes its journey on staging; AC3.2 no page caches tenant data (T-SEC-05); AC3.3 axe: no critical violations on 5 key pages; AC3.4 student sees only own batches' subjects.
- **Rollback:** feature flags per area. **Complexity:** medium. **Risks:** UI scope creep → keep to listed screens.
- → Model: sonnet · Effort: medium · Why: routine UI with some judgment.

---
### Phase 4 — Document upload and processing
- **Objective:** teachers upload PDFs/images, processing to searchable chunks, publish/withdraw to batches.
- **Required decisions:** PDF text-extraction library (spike, 1 day); upload limits (Q-12 defaults: 50 MB, 300 pages).
- **Dependencies:** P3 (UI), P2 (RLS). AI OCR uses provider directly in this phase **only through a minimal gateway stub that records usage** — full quotas arrive in P5.
- **Tasks:** documents/document_versions/document_audience/document_chunks migrations + RLS; storage bucket policies; signed upload; confirm + enqueue; worker ingestion pipeline (AI_PIPELINE_DESIGN §3); sweeper for stuck `queued`; status UI with error codes; publish/withdraw/delete; signed view URL RPC; reindex job.
- **Integrations:** Anthropic (OCR), Voyage (embeddings).
- **Tests:** unit (chunker, page-quality heuristic), integration (ingest fixture PDFs: text PDF, scanned PDF, Hindi PDF, formula-heavy PDF, corrupt PDF, 0-byte, wrong magic bytes), T-ISO-06/08, T-SEC-07, idempotency (run job twice → same chunk count), crash mid-job → old version still served.
- **Manual:** upload 5 real pilot documents; inspect OCR output for formulas.
- **Acceptance:** AC4.1 fixture suite passes; AC4.2 duplicate enqueue causes no duplicate chunks; AC4.3 withdrawn doc invisible to students within one request; AC4.4 cross-tenant job test passes; AC4.5 OCR formula accuracy reviewed on 3 real docs, issues logged; AC4.6 cost per 100 pages measured and recorded.
- **Rollback:** feature flag "uploads enabled" per institute. **Complexity:** high. **Risks:** OCR quality on formulas; large PDFs; Voyage data policy (Q-08) must be resolved before real institute documents are embedded.
- → Model: sonnet · Effort: high · Why: multi-step pipeline with partial-failure semantics.

---
### Phase 5 — AI gateway, metering and quotas
- **Objective:** every AI call metered, quota-checked, tenant-tagged; budgets and alerts.
- **Dependencies:** P2 (tables), P4 stub replaced.
- **Tasks:** `usage_records`, `institute_quotas`, `usage_counters` migrations; quota RPC (atomic); gateway module (AI_PIPELINE_DESIGN §2); price table in `routing.ts`; budget alerts job (50/80/100 %); kill switch; admin usage pages; provider spend limits configured.
- **Tests:** unit (cost math vs hand-computed fixtures), concurrency test (100 parallel calls never exceed limit), T-SEC-12, T-SEC-10.
- **Acceptance:** AC5.1 a code search shows provider SDKs imported **only** in the gateway module (lint rule); AC5.2 metered cost within ±2 % of provider-reported tokens on a 50-call sample; AC5.3 limits enforced under concurrency; AC5.4 kill switch blocks all AI within 1 minute.
- **Rollback:** gateway flag to read-only mode (no AI). **Complexity:** medium. **Risks:** counter contention at scale (fine for pilot).
- → Model: opus · Effort: medium · Why: money + security-sensitive concurrency.

---
### Phase 6 — Source-grounded AI tutor
- **Objective:** subject-scoped chat with citations and labels, institute + general knowledge (library joins in P8).
- **Dependencies:** P4, P5.
- **Tasks:** conversations/messages migrations + RLS; `match_chunks` (hybrid + RRF); rerank experiment; prompt v1; streaming route; citation → label mapping; Markdown/KaTeX rendering with HTML/remote images disabled; feedback + "report answer"; escalation button; golden set (with pilot teacher help) + eval runner.
- **Tests:** eval suite; T-AI-09 injection; T-SEC-19 XSS; T-ISO-06; latency measurement.
- **Acceptance:** AC6.1 retrieval recall@8 ≥ 0.85 on institute questions [A: threshold to confirm after first run]; AC6.2 citation support ≥ 90 % on judged sample; AC6.3 human-graded correctness ≥ 90 % on 30 sampled answers; AC6.4 0 cross-tenant passages in 1,000 eval queries; AC6.5 p95 first token ≤ 4 s on staging [E]; AC6.6 cost per answer recorded and within COST_MODEL assumption ±30 %.
- **Rollback:** tutor feature flag per institute. **Complexity:** high. **Risks:** Hindi/Hinglish retrieval quality; hallucinated "general explanations" — label + report flow.
- → Model: sonnet · Effort: high · Why: core product; correctness and safety tuning.

---
### Phase 7 — Tests, question bank, practice quizzes, ranks
- **Objective:** institutes create/schedule tests mixing MCQ (single/multi), numerical and **written (theory) questions**; students attempt; objective parts auto-graded, written answers **checked manually by teachers**; release; **test rank + overall rank**; student profile page (teacher view and student's own view); student self-practice quizzes.
- **Dependencies:** P3 (deterministic part); AI question generation after P5.
- **Tasks:** questions/question_keys/tests/test_questions/test_audience/test_attempts/attempt_answers/practice_attempts migrations + RLS + RPCs (`start_attempt`, `get_attempt_questions`, `save_answer`, `submit_attempt`, `get_attempt_review`); `grade_answer` + `release_results` RPCs; teacher **checking screen** (one written question at a time across students, shows question, teacher's model answer and the student's answer, marks box 0–max with half marks, optional comment, progress "34/180 checked", option to hide student names while checking); release job (totals, test rank, percentile, recompute `batch_standings` overall rank); regrade after release recomputes both ranks; teacher UI (bank, blueprint, schedule, results, rank lists, Excel export); **student profile page** (click a name → full progress, see HOW_IT_WORKS.md) reused as the student's own "My progress" page; student UI (timer from server deadline, autosave, typed theory answers, review after release with teacher comments); AI generation with dual-solve; practice quiz generation (Haiku).
- **Tests:** grading unit tables (marks, negatives, multi-correct partial rules [A: no partial marks unless configured], numerical tolerance); T-ISO-14; late-save; double-submit; 500-student burst start (k6); rank ties.
- **Acceptance:** AC7.1 grading unit suite 100 % pass; AC7.2 keys unreadable by students via every path; AC7.3 saves after deadline rejected by DB; AC7.4 500 concurrent starts succeed with p95 < 2 s [E]; AC7.5 dual-solve disagreement blocks approval; AC7.6 test and overall ranks match a hand-computed fixture (including ties, missed tests and a regrade); AC7.7 results cannot be released while any written answer is unmarked; AC7.8 teachers can mark written answers only for their own batches; AC7.9 student profile shows identical numbers to the teacher view of the same student.
- **Rollback:** per-test cancel + regrade tool. **Complexity:** high. **Risks:** exam-day load; clock skew (DB clock is authoritative).
- → Model: sonnet · Effort: high · Why: correctness-critical grading logic.

---
### Phase 8 — Shared library engine + pilot seed
- **Objective:** Exam → Subject → Chapter → Topic library, reviewed content, retrieval joined into tutor.
- **Required decisions:** Q-02 pilot exam/subject; reviewer hired (subject expert).
- **Dependencies:** P6.
- **Tasks:** library tables + RLS; library editor (platform admin); Batch-API generation with Opus; reviewer workflow (draft → reviewed → published); `library_chunks` HNSW index; tutor merges both layers with labels; subject mapping UI for institutes.
- **Acceptance:** AC8.1 one subject's syllabus tree complete; ≥ 80 % of topics have reviewed explanation + formula sheet [A]; AC8.2 nothing publishes without reviewer; AC8.3 provenance recorded for every item; AC8.4 eval: library questions recall@8 ≥ 0.85.
- **Complexity:** medium (engineering) + high (content ops). **Risks:** content correctness; reviewer cost/time; copyright (only self-generated + reviewed content).
- → Model: opus · Effort: high · Why: content authoring quality defines the product; implementation parts sonnet/medium.

---
### Phase 9 — Studio basics
- **Objective:** summaries/study guides, flashcards, mind maps (institute-approved and student-personal).
- **Dependencies:** P4, P5 (P8 optional).
- **Tasks:** generated_artifacts migration + RLS; generators with schemas; approval workflow; reuse by input hash; renderers (flashcard viewer, markmap mind map [U: licence check], study guide).
- **Acceptance:** AC9.1 every artifact validates against schema; AC9.2 identical institute request reuses existing artifact (no provider call); AC9.3 citations present per section; AC9.4 student artifacts private to owner (T-ISO-01 extended).
- **Complexity:** medium. → Model: sonnet · Effort: medium · Why: standard generation features.

---
### Phase 10 — Pilot hardening and launch
- **Objective:** production environment safe for real minors' data with 2–3 institutes.
- **Dependencies:** P6, P7 (P8/P9 if ready), legal track complete.
- **Tasks:** production Supabase/Vercel/Railway; domain + wildcard subdomain TLS; prod OAuth client; backups (independent dump + storage copy); **restore drill**; runbooks (incident, key rotation, restore, offboarding); privacy notice, terms, institute data-processing agreement (lawyer-drafted); consent capture per legal advice; k6 load test; full security gate run; Sentry alerts; spend alerts; on-call plan (founder).
- **Acceptance:** AC10.1 G1–G8 all green with evidence; AC10.2 restore drill RTO ≤ 8 h achieved; AC10.3 load test meets P6/P7 targets on prod-sized compute; AC10.4 written legal opinion on Q-01 obtained and implemented; AC10.5 rollback of a deployment rehearsed.
- **Rollback:** pilot institutes can be suspended individually; previous deployments promoted in Vercel/Railway.
- **Complexity:** high. **Risks:** legal timeline; first real data.
- → Model: opus · Effort: high · Why: irreversible step (real student data) and security sign-off.

## 4. Release 2 (after pilot feedback)
| Phase | Scope | Depends on | Model/Effort |
|---|---|---|---|
| P11 Analytics & recommendations | topic_mastery, teacher dashboards (aggregates), next-practice suggestions | P7 | sonnet / medium |
| P12 AI help for written answers | optional AI-suggested marks shown to the teacher while checking; teacher marks stay final | P7, P5 | sonnet / high (grading fairness) |
| P13 Audio overviews | Sarvam TTS, Hindi + English first, per-institute reuse | P5, P9 | sonnet / medium |
| P14 Billing | Razorpay Subscriptions, webhooks, plan limits | validated pricing, P5 | opus / medium (money, webhooks) |
| P15 Tables/reports, DOCX/PPTX ingest, join codes with approval, overall rank | — | P4, P7 | sonnet / medium |

## 5. Release 3
| Phase | Scope | Depends on | Model/Effort |
|---|---|---|---|
| P16 Slides & infographics | HTML/SVG templates → PDF/PPTX/PNG | P9 | sonnet / medium |
| P17 Animated video | scene schema, Remotion + Manim render container, CDN delivery, licence (Q-09) | P13 | opus / high for design, then sonnet / medium |
| P18 Enterprise | dedicated cells, custom domains, SSO | demand | opus / high |
| P19 More languages/exams, web search for current affairs, PWA/mobile polish | — | P8, P13 | sonnet / medium |

## 6. First implementation task (next session, after approval)
**Phase 1, Task 1–2:** initialise `examedge_ai` as its own git repository and create the npm-workspace skeleton
(`apps/web`, `apps/worker`, `packages/core`) with TypeScript strict, ESLint, Prettier, Vitest, and a CI workflow that runs
lint + typecheck + unit + build. Done when AC1.1 passes locally and on a GitHub PR.
