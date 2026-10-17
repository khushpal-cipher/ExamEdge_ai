# ExamEdge AI — Project Master Plan

Status: **Draft for approval** · Last updated: 2026-10-14 · Labels: see [ARCHITECTURE.md](ARCHITECTURE.md) header.
This is the entry point. Details live in one place each — this file summarises and links, it does not restate specifications.

| Topic | Source of truth |
|---|---|
| Founder's original requirements | [ORIGINAL_BRIEF.md](ORIGINAL_BRIEF.md) |
| Student and teacher walkthrough (plain language) | [HOW_IT_WORKS.md](HOW_IT_WORKS.md) |
| Plain-language summary to share (no jargon) | [PLAN_EXPLAINED_SIMPLY.md](PLAN_EXPLAINED_SIMPLY.md) · web page copy: [share/examedge-plan.html](share/examedge-plan.html) |
| Architecture, tenancy, flows, deployment | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Tables, constraints, RLS, roles | [DATABASE_DESIGN.md](DATABASE_DESIGN.md) |
| Threats, authorization matrix, security gates | [SECURITY_THREAT_MODEL.md](SECURITY_THREAT_MODEL.md) |
| AI models, ingestion, retrieval, feature matrix | [AI_PIPELINE_DESIGN.md](AI_PIPELINE_DESIGN.md) |
| Integrations and credentials | [API_AND_SECRETS_INVENTORY.md](API_AND_SECRETS_INVENTORY.md) |
| Costs and pricing hypothesis | [COST_MODEL.md](COST_MODEL.md) |
| Phases, tasks, acceptance criteria | [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md) |
| Testing and quality gates | [TEST_STRATEGY.md](TEST_STRATEGY.md) |
| Operations: incidents, key rotation, backup/restore, offboarding, switching to real AI | [RUNBOOKS.md](RUNBOOKS.md) |
| Decisions and review log | [DECISIONS.md](DECISIONS.md) |
| Open questions, risks, assumptions | [RISKS_AND_OPEN_QUESTIONS.md](RISKS_AND_OPEN_QUESTIONS.md) |
| Current status and next action | [../PROGRESS.md](../PROGRESS.md) |

## 1. Vision
An AI learning platform where each coaching institute gets its own branded, isolated space. Teachers organise
material, tests and AI-generated study content. Students get a topic-by-topic tutor ("Smart Study") that answers from their institute's notes
(the ExamEdge library was removed in R1.1, ADR-037), without uploading anything themselves, with clear citations. Inspired by NotebookLM;
built independently (NotebookLM has no API we rely on).

## 2. Architecture in one paragraph
One Next.js app (Vercel) + one Supabase project in Mumbai (Postgres with Row-Level Security, Google sign-in, private storage,
pgvector) + one Node worker (Railway) running a Postgres-backed job queue. Institutes are logical tenants identified by
subdomain; the database enforces isolation; no privileged key runs in request paths. All AI calls pass through a metering
and quota gateway. Claude Haiku 5.5 answers most questions; Sonnet 5.5 handles hard ones; Opus 5.5 authors reviewed
content. The design can move a large institute to its own database ("cell") later. Rejected: database-per-institute now
(cost/ops), separate vector DB (second isolation model), generative video models (inaccurate formulas), Redis/microservices (not needed).

## 3. Scope by release

| Capability | R1 Pilot MVP | R2 | R3 |
|---|---|---|---|
| Platform admin: institutes, subdomains, branding, quotas, usage | ✅ (institute creation via ops script + admin UI) | Self-serve onboarding | Custom domains, enterprise cells, SSO |
| Staff: batches, subjects, chapters, invitations, roles | ✅ | Join codes with approval | Custom roles |
| Documents: PDF + images, OCR, publish/withdraw per batch | ✅ | DOCX/PPTX | — |
| AI tutor with citations + labels | ✅ (institute + general; topic-scoped "Smart Study" in R1.1) | Personalised hints from mastery | Web search (current affairs) |
| Shared library | Removed in R1.1 (ADR-037) | — | — |
| Tests: MCQ single/multi, numerical, written (theory); auto marking + teacher checking; test rank + overall rank; student progress page | ✅ | Optional AI-suggested marks for theory answers | — |
| Student practice quizzes, flashcards, summaries, mind maps | ✅ | Tables/reports | Slides, infographics |
| Analytics | Basic (attempts, scores, usage counts) | Teacher dashboards, recommendations | — |
| Audio overviews | — | Hindi + English (Sarvam) | More languages |
| Animated video | — | — | Remotion + Manim |
| Billing | Manual invoices | Razorpay Subscriptions | — |
| Mobile | Responsive web | PWA | Native app if justified |

## 4. Launch criteria for the pilot (Release 1)
1. Security gates G1–G8 green with evidence (SECURITY_THREAT_MODEL §4), including the **legal opinion on minors' data (Q-01)**.
2. Tutor eval thresholds met (Phase 6 AC6.1–AC6.6) on pilot subjects.
3. Grading/ranking correctness suite and exam-day load test passed (Phase 7).
4. Restore drill completed; runbooks written; spend alerts configured.
5. Pilot institutes signed data-processing terms; students/guardians informed per legal advice.

## 5. Top risks
Cross-tenant leakage (RK-01), wrong answers to students (RK-02), AI cost vs. price (RK-03), minors' data compliance
(RK-04), solo-founder scope (RK-05). See RISKS_AND_OPEN_QUESTIONS.md.

## 6. Go / no-go
- **Go for Phase 1** once the founder approves this plan and answers Q-10 (separate repo) and Q-11 (Docker).
- **No-go for embedding real institute documents** until Q-08 (Voyage data terms) is resolved.
- **No-go for pilot launch** until Q-01 (legal) is resolved and all Phase 10 acceptance criteria pass.
