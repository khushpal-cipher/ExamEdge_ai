# ExamEdge AI — Progress

Last updated: 2026-10-15

## Current phase
**Phase 1 (Foundations) IN PROGRESS** on git branch `phase-1-foundations`. Started 2026-10-15.
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

## In progress
### Phase 1 — local quality gate PASSED (session 4, 2026-10-15)
Evidence (all run on 2026-10-15 on branch `phase-1-foundations`, macOS arm64, Supabase CLI 2.121.0):
| Command | Result |
|---|---|
| `npm run format:check` | All matched files use Prettier code style |
| `npm run lint` | eslint 0 warnings; `check-forbidden: ok` |
| `npm run typecheck` | exit 0 (web, worker, core, scripts) |
| `npm test` | 2 files, 7 tests passed (logger + forbidden-pattern rules) |
| `npm run test:db` | `000_smoke.sql .. ok`, Tests=4, PASS |
| `npm run test:int` | no integration tests yet; exit 0 (`--passWithNoTests`) |
| `npm run build` | Next 16.4.1 build OK; `check-bundle: ok` |
| `npm run test:e2e` | 1 passed (`/api/health` ok + commit + no-store) |
| AC1.3 hook proof | staged a fake AWS key in `tmp-leak/creds.txt`; `git commit` → gitleaks `leaks found: 2`, exit 1; file removed |

Fixes made in session 4:
- `scripts/check-forbidden.ts`: `session-SET` rule missed `SET ROLE x` (its unit test caught it) → regex now also matches `set role`.
- `npm run test:int` uses `--passWithNoTests` (project-level option is ignored by Vitest 5).
- ADR-017 (Sentry BLOCKED → JSON logger), ADR-018 (staging BLOCKED), ADR-019 (`private` schema grants; default ACL facts) added.
- CLAUDE.md "## Commands" filled in.

Phase 1 acceptance status:
- AC1.1 local PASS; CI → see PR below. AC1.2 local PASS; CI → see PR. AC1.3 local hook PASS; CI gitleaks job runs on every PR
  (a fake secret is deliberately NOT pushed to the public repo — it would stay in history forever).
- AC1.4, AC1.6 BLOCKED (ADR-018, needs accounts). AC1.5 BLOCKED (ADR-017, needs Sentry account).
- Local part of AC1.4 done in session 3: worker heartbeat row written via pg-boss cron.

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
Push `phase-1-foundations`, open PR into `main`, fix CI until green, merge. Then start Phase 2 on branch `phase-2-identity`.

## Relevant files and commands
- Plan entry point: `docs/PROJECT_MASTER_PLAN.md`
- Roadmap and acceptance criteria: `docs/IMPLEMENTATION_ROADMAP.md`
- Commands: `supabase start` / `supabase status` / `supabase test db`; scripts in root `package.json`.
- Local Supabase: API http://127.0.0.1:54321, DB postgresql://postgres:postgres@127.0.0.1:54322/postgres (local defaults; keys via `supabase status -o env`, never commit them).
- Playwright Chromium (session 3, `npx playwright install chromium`, chromium-1243/headless-shell-1248 in ~/Library/Caches/ms-playwright).
- Tools installed by Claude: Docker Desktop 4.95.0 (`brew install --cask docker-desktop`), Supabase CLI 2.121.0 and gitleaks 8.30.1 (`brew install supabase/tap/supabase gitleaks`).

## Known regressions
- None.

## Session log
| Session | Date | Summary | Last commit |
|---|---|---|---|
| 1–2 | 2026-10-14/15 | Planning docs, founder decisions, tools, git init, workspaces, local Supabase init + pgTAP smoke | `5d26fc7` |
| 4 | 2026-10-15 | Phase 1 full local gate green; SET ROLE lint hole fixed; ADR-017/018/019; PR to main | see `git log` |
| 3 | 2026-10-15 | Phase 1: web skeleton (build OK), pg-boss schema + worker heartbeat (ran OK), logger, lint/format/test configs, forbidden-pattern check (lint OK), bundle scan, gitleaks hook, CI workflow, .env.example. Full gate NOT yet run; nothing pushed before the WIP commit. | see `git log` |
