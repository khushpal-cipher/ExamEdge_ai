# ExamEdge AI — Risks and Open Questions

Status: **Draft for approval** · Last updated: 2026-10-14 · Labels: see [ARCHITECTURE.md](ARCHITECTURE.md) header.
**Blocks** = what cannot proceed until resolved.

## 1. Open questions

| ID | Question | Why it matters | Default until answered | Resolved by | Blocks |
|---|---|---|---|---|---|
| Q-01 | Under India's DPDP Act 2023 and DPDP Rules 2025: is a coaching institute an "educational institution" ("an institution of learning that imparts education, including vocational education" [V3]) for the Fourth Schedule exemption from verifiable parental consent and the tracking/behavioural-monitoring ban (limited to its educational activities or child safety [V3])? Is ExamEdge a Data Processor for institute data and a Data Fiduciary for the shared library/personalisation? What consent flow, notices, retention and grievance mechanism are required, and from when (children's provisions reportedly commence ~18 months after 13 Nov 2025 [V3])? | Most students are minors; tracking and personalisation are core features | Collect minimum data; staff see aggregates; no marketing; record consents; assume parental consent needed | Indian data-protection lawyer (written opinion); read official Gazette text | **Pilot launch (G8)** |
| Q-02 | Which exam and subject for the pilot library seed (JEE / NEET / CBSE / UPSC)? | Determines library content and reviewer | JEE Physics [A] | Founder + pilot institutes | Phase 8 |
| Q-03 | May institute staff read students' tutor chats? | Privacy vs. teaching value; legal input | No — aggregates only | Founder + pilots + lawyer | Phase 6 UI for staff |
| Q-04 | Do all students have Google accounts they may use? Under-13 students? | Google-only login (ADR-004) | Google only; institutes confirm | Pilot institutes | Phase 2 rollout to students |
| Q-05 | **Resolved 2026-10-15:** overall rank = **average percentage** across the batch's released institute tests (missed = 0 %, tests before a student joined are excluded; same average = same rank). | Fairness | — | Founder | — |
| Q-06 | Retention periods: chats, activity events, attempts after a student leaves | DPDP erasure duties, storage | 12 months chats/events; attempts kept for the academic year | Lawyer + institutes | Phase 10 |
| Q-07 | Institute offboarding: export format and grace period | Contract | Export (CSV + files) then delete after 30 days | Founder + lawyer | Phase 10 |
| Q-08 | Voyage AI: are API inputs used for training by default; opt-out; retention; DPA? (one unanswered user forum post suggests opt-out exists [V3]) | Institute documents and student queries are sent for embedding | Do not embed real institute data until confirmed; fallback: another embedding provider with a clear no-training commitment | Written confirmation from Voyage / their terms | **Phase 4 with real data** |
| Q-09 | Remotion company licence price and terms for SaaS rendering | R3 cost | Budget unknown | Remotion sales/FAQ | Phase 17 |
| Q-10 | Create `examedge_ai` as its own private Git repository? (parent repo ignores this folder) | Version control of all work | Yes, separate repo | Founder | **Phase 1** |
| Q-11 | Install a Docker-compatible runtime for the local Supabase stack? (Docker Desktop licence terms for small businesses [U]) | Local DB + RLS tests | Install Docker Desktop | Founder | **Phase 1** |
| Q-12 | Upload limits per file (size/pages) and per institute storage | Cost, abuse | 50 MB, 300 pages, 20 GB/institute | Founder | Phase 4 |
| Q-13 | Does Google require brand verification for sign-in-only scopes with our logo shown? | Sign-in UX / launch timing | Plan for brand verification lead time | Google Cloud console during Phase 2 | Phase 10 |
| Q-14 | Willingness to pay (₹49 / ₹99 / ₹149 per student per month)? | Business viability | Unvalidated hypothesis | Conversations with ≥ 5 institutes | R2 billing |
| Q-15 | Company status / employee count (licences, contracts, GST invoicing) | Remotion, DPAs, Razorpay KYC | Sole founder | Founder | R2/R3 |

## 2. Risks

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| RK-01 | Cross-tenant data leak through a policy bug | Low | Severe | Layered isolation + generated RLS matrix + release gate G2 | Founder |
| RK-02 | AI gives a wrong answer to a student (esp. numericals) | Medium | High (trust) | Citations, labels, report button, eval gates, teacher-approved tests | Founder |
| RK-03 | AI cost exceeds price (heavy users, Sonnet share) | Medium | High | Quotas, budgets, alerts, routing; measure in pilot | Founder |
| RK-04 | DPDP non-compliance with minors' data | Medium | Severe | Q-01 before launch; data minimisation | Founder + lawyer |
| RK-05 | Solo-founder bandwidth: scope too big | High | High | Strict MVP; R2/R3 only after pilot; ponytail rule (least code) | Founder |
| RK-06 | Library content quality/copyright | Medium | High | Self-generated + expert review + provenance; no scraping | Founder + reviewer |
| RK-07 | OCR/formula extraction poor on scanned notes | Medium | Medium | Phase 4 spike with real pilot documents; human-visible extraction preview | Founder |
| RK-08 | Indian-language quality (retrieval, generation, TTS) below expectations | Medium | Medium | English-first pilot; language evals before enabling | Founder |
| RK-09 | Vendor dependency (Supabase, Anthropic, Vercel) outages or price changes | Low–Medium | Medium | Gateway abstraction, exportable data, backups off-platform | Founder |
| RK-10 | Exam-day load spikes (500+ simultaneous starts) | Medium | High | k6 test, compute upgrade before scheduled tests, DB-clock deadlines tolerate latency | Founder |
| RK-11 | Pilot institutes don't adopt (product risk) | Medium | Severe | Weekly usage review; build what pilots use; validate pricing early | Founder |
| RK-12 | Unverified technical claims (marked [U]) turn out wrong | Medium | Low–Medium | Each [U] has a verification step in the phase that first depends on it | Founder |

## 3. Assumptions register (key)
Active rate 60 %, 120 tutor msgs/active student/month, 15 % Sonnet share, ₹88/$ (COST_MODEL §2) · pilot of 2–3 institutes,
≤ 1,500 students · English-first UI, Hindi/Hinglish answers when asked · students cannot upload documents in R1 · one subject
seeded in the library during R1 · pilot billing manual.
