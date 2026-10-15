# ExamEdge AI — Test Strategy

Status: **Draft for approval** · Last updated: 2026-10-14 · Labels: see [ARCHITECTURE.md](ARCHITECTURE.md) header.
Rule: a test that did not run is **BLOCKED**, never "passed". Never weaken, skip or delete a failing security test to make CI green.

## 1. Layers

| Layer | Tool [R] | What it covers | Runs |
|---|---|---|---|
| Format + lint | Prettier, ESLint | style, unsafe patterns (`dangerouslySetInnerHTML`, session `SET` in worker) | pre-commit + CI |
| Types | `tsc --noEmit` | all workspaces | CI |
| Unit | Vitest | pure logic: grading, marking, ranking, chunking, prompt builders, quota math, schema validators | CI |
| Database | pgTAP via `supabase test db` [U: verify command in Phase 1] | RLS matrix, constraints, triggers, RPCs, policy coverage | CI (local Supabase in Docker) |
| Integration | Vitest + local Supabase | server actions, worker jobs end-to-end against a real DB, provider calls mocked at the HTTP boundary | CI |
| End-to-end | Playwright | user journeys on `*.localhost` with two seeded institutes | CI (nightly full, PR smoke) |
| AI quality | `evals/` scripts (real provider calls, small budget) | retrieval recall, citation support, correctness samples, injection suite | on prompt/model/retrieval changes; manual trigger with budget |
| Security | gitleaks, npm audit/OSV, bundle secret scan, XSS corpus | supply chain, secrets, injection | CI |
| Performance | k6 [R] | tutor endpoint p95, retrieval p95, test-start burst (500 students in 60 s) | before pilot, then per release |
| Ops | restore drill | backups actually restore | before pilot, quarterly |

## 2. Fixtures
- Seed script creates **Institute A and Institute B with identical structure** (2 batches, 2 subjects, teachers, 5 students each,
  documents, a test with keys, conversations, practice attempts) plus one platform admin and one user who is a member of both.
- Every isolation test runs the same operation as each role of A against B's objects and against A's other batch.
- Canary content: B contains a unique phrase used to detect leakage in retrieval and UI.

## 3. Tenant-isolation suite (release gate G2)

| ID | Test |
|---|---|
| T-ISO-01 | Student ↔ student (same institute): every S-class table × select/insert/update/delete → denied |
| T-ISO-02 | Every role of A × every table/RPC/storage path of B → denied/empty |
| T-ISO-03 | Teacher of batch X × attempts/students/tests of batch Y → denied |
| T-ISO-05 | Policy coverage: every table in exposed schemas has RLS enabled + ≥ 1 policy; every tenant table has `institute_id not null`; SECURITY DEFINER functions only from allowlist with `search_path=''`; all views `security_invoker` |
| T-ISO-06 | Retrieval canary: A queries with B's canary phrase → zero B chunks |
| T-ISO-08 | Worker job with A's context touching B's ids → not found, zero writes |
| T-ISO-14 | Student reads `question_keys` via REST, RPCs and storage before/after release → never |
| T-E2E-ISO-01 | Playwright: A's student uses raw REST with own token against B ids; visits B subdomain → "not a member" |

Generated matrix: a pgTAP helper iterates over the table list from `pg_tables` so **new tables are tested automatically** (prevents "forgot to add test").

## 4. Security and ops tests

| ID | Test |
|---|---|
| T-SEC-04 | Forged `institute_id` in bodies/headers and crafted Host headers have no effect; unknown hosts → 404 |
| T-SEC-05 | Authenticated responses are `private, no-store`; same path for two users of different tenants returns different content |
| T-SEC-07 | Signed URL minted only for readable documents; expired URL rejected |
| T-SEC-08 | Static check: no session-level `SET` / `set_config(..., false)` in worker code |
| T-SEC-10 | Prompt builder emits no PII fields; log snapshot contains no emails/names/prompt text |
| T-SEC-11 | Client bundle contains no secret env names/values; gitleaks clean |
| T-SEC-12 | Quotas (per student, per institute budget), concurrency limits and kill switch enforced |
| T-SEC-13 | Webhook bad signature → 400; duplicate event id → no double effect (R2) |
| T-SEC-15 | Platform admin without break-glass session cannot read tenant rows; session expiry enforced |
| T-SEC-17 | Dependency audit: no high/critical advisory without a dated exception |
| T-SEC-18 | Invitation: email mismatch, reuse, expiry, revocation all rejected |
| T-SEC-19 | XSS corpus in Markdown/LaTeX (stems, notes, chat) renders inert |
| T-OPS-16 | Restore drill into a scratch project: row counts, sample checksums, storage spot checks; RTO measured |

## 5. AI quality tests
- Golden sets per pilot subject (AI_PIPELINE_DESIGN §4). Stored in `evals/datasets/` (no student data).
- Metrics recorded per run in `evals/results/{date}-{change}.json` with model ids, prompt versions, cost.
- Generated-question checks: schema, KaTeX compile, dual-solve agreement rate (track), teacher rejection rate (track in pilot).
- Injection suite T-AI-09: 20 adversarial documents; pass = no remote images/HTML rendered, no secret/system prompt disclosure, no cross-scope claims.

## 6. Phase quality gate (applies to every phase)
1. Read requirements + relevant ADRs. 2. Implement approved scope only. 3. Format + lint. 4. Unit. 5. Integration.
6. Security/isolation suites where applicable. 7. Typecheck + production build. 8. Inspect logs/test output. 9. Fix and rerun.
10. Review diff (unrelated changes, secrets, regressions). 11. Verify acceptance criteria. 12. Record evidence in PROGRESS.md
(command, result, date, commit) and remaining risks. Missing credentials/infra → mark **BLOCKED** with what is unverified.
