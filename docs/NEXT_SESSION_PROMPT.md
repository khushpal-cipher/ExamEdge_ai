# Prompt for the next Claude Code session (build + self-test)

## Prompt to paste (copy everything inside this box into a new Claude Code session)

```text
Continue building ExamEdge AI Release 1 in ~/Documents/startup/examedge_ai.

1. Read these files fully before doing anything else, in this order, so you have the complete picture:
   CLAUDE.md, PROGRESS.md, docs/NEXT_SESSION_PROMPT.md (your full instructions are the "Full instructions" box
   in that file — follow them exactly), docs/PROJECT_MASTER_PLAN.md, docs/IMPLEMENTATION_ROADMAP.md,
   docs/DATABASE_DESIGN.md, docs/SECURITY_THREAT_MODEL.md, docs/AI_PIPELINE_DESIGN.md, docs/TEST_STRATEGY.md,
   docs/DECISIONS.md, docs/HOW_IT_WORKS.md, docs/ARCHITECTURE.md. Then run `git log --oneline -15` and `git status`.
2. Continue from PROGRESS.md "Next exact action" and "In progress". Do not restart or redo finished work;
   re-verify only what PROGRESS.md marks as unverified.
3. First check `docker info` (run `open -a Docker` and wait if it fails) and `supabase status`
   (run `supabase start` from the repo root if stopped). Never reset the local database without asking me:
   it holds my test institutes (see PROGRESS.md).
4. Before writing any Next.js code, read node_modules/next/AGENTS.md and the relevant files in
   node_modules/next/dist/docs/. This is Next 16: middleware.ts is now proxy.ts.
5. Standing rule: install any free dev tool you need from trusted sources without asking and log it in
   PROGRESS.md; only ask me about money, new online accounts/deployments, or product decisions not in the docs.
6. Commit after every green task and push the phase branch. When a phase passes the full quality gate, open a PR
   into main, check CI, fix until green, then merge. The repo is PUBLIC: never commit secrets.
7. Keep PROGRESS.md accurate as you go (done / unverified / failing / blocked / next exact action, with commands,
   results, dates and commit hashes) so any new session can continue.
8. When I type "give me a prompt": update PROGRESS.md with a precise handoff, commit and push, then reply with
   the "Prompt to paste" box from docs/NEXT_SESSION_PROMPT.md (updated if anything changed) so I can start a
   new context window.
```

---

## Full instructions (referenced by the prompt above)

Docker Desktop is installed (2026-10-15). Missing tools are installed by the session itself (section 5).
```text
You are the lead engineer building ExamEdge AI, a multi-tenant AI learning platform for coaching institutes.
The founder has APPROVED the plan in this repository and wants you to build Release 1 (the pilot MVP) end to end
and test it yourself, with as little supervision as possible.

## 0. Read first (in this order, fully)
1. CLAUDE.md (repository rules — follow them strictly)
2. PROGRESS.md (current status; if a previous session already did work, CONTINUE from "Next exact action", do not restart)
3. docs/PROJECT_MASTER_PLAN.md, then docs/IMPLEMENTATION_ROADMAP.md, docs/DATABASE_DESIGN.md,
   docs/SECURITY_THREAT_MODEL.md, docs/AI_PIPELINE_DESIGN.md, docs/TEST_STRATEGY.md, docs/DECISIONS.md, docs/HOW_IT_WORKS.md
docs/HOW_IT_WORKS.md is the product behaviour spec for every screen. DATABASE_DESIGN.md is the schema spec.

## 1. Founder decisions already made (do not re-ask)
- Build Release 1 = roadmap Phases 1–9 plus the local (non-cloud) parts of Phase 10.
- Tests mix MCQ (single/multi), numerical and written (theory) questions. MCQ/numerical are auto-marked.
  Every theory answer is marked by a teacher on a checking screen; results can only be released when all are marked.
- Two ranks, institute-conducted tests only (practice quizzes never count):
  test rank = by score, ties broken by less time taken;
  overall rank = by AVERAGE PERCENTAGE across the batch's released tests (missed test = 0%, tests before the
  student joined excluded, same average to 2 decimals = same rank). Regrading recalculates both ranks.
- Clicking a student's name shows a full progress page (HOW_IT_WORKS.md Part 2E); the student sees the same page as "My progress".
- Staff never see the text of students' AI chats — only counts/topics.
- Release 1.1 (2026-10-17): the founder's change list in PROGRESS.md "Next exact action" (groups A–E: subjects in
  batches, Subject → Topic → Subtopic with "Smart Study", teacher AI = AI notes + AI test, batch history, Contest
  page, AI bill per institute, remove the library) is APPROVED; build it in the listed order. Its answers override
  older docs; update HOW_IT_WORKS, DATABASE_DESIGN, AI_PIPELINE_DESIGN and DECISIONS as each part is built.
- Release 1.2 (2026-10-18): R1.1 is merged and done. The founder's R1.2 change list (new test page with AI chat box
  or manual questions, one-click batch switcher, Home after switching, NotebookLM-style Smart Study tiles) and its
  build order are in PROGRESS.md ("R1.2 founder change list"). The founder said GO (session 35): build it all
  (ADR-042, ADR-043). Charges/bill and payment gateway wait until the founder decides prices at the end.
- Session 36 (2026-10-18): R1.2 is merged and done; the founder also asked (and got) "Add questions" first on the
  draft test page and a teacher's uploaded notes publishing themselves (ADR-044; AI notes still wait for the
  teacher). Next: ask the founder for the next change list or ADR-041 part 2 (bill).
- Session 37 (2026-10-18): founder asked for negative marks on typed questions, an optional theory model answer,
  JEE Advanced marking for multi-correct MCQs (ADR-045) and the owner's "AI usage" page as a ₹ Bill (rate set by the
  platform admin; commission later). Built on PR #30 and PR #31 (stacked), CI green, waiting for the founder's
  "merge". Open: how MCQ-only tests should show results (PROGRESS.md "Next exact action").
- Session 38 (2026-10-18): #30 and #31 merged (`main` = `8499b5e`). Founder chose: a student sees own marks and
  right/wrong right after submitting, correct answers only after closing time, rank with release (ADR-046, PR #32);
  student reviews of the coaching readable and answerable only by owner/admin, with "Hide my name" that still lets
  the student read the reply (ADR-047, PR #33). Both CI green, waiting for the founder's "merge".
- Session 39 (2026-10-18/19): #32 and #33 merged. Founder asked for CBT tests (ADR-048, PR #34): a "CBT mode" tick
  box for staff on New test/Settings (never on students' practice quizzes); the test runs in full screen; leaving
  full screen, switching tab/app or reloading is a warning; the 3rd submits the test; Google Chrome only; teachers see
  warnings on results. Merged in session 40 (`c0c46ca`) with the founder's fixes: submit asked on the page, one
  question per page with Previous/Next, CBT blocks copy/paste as a warning.
- Session 40 (2026-10-19): founder approved a UI redesign (ADR-049): brilliant.org as the layout/feel reference,
  own theme deep indigo + saffron (not Brilliant's colours), dark mode, free hand on the build. Plan:
  docs/UI_REDESIGN_PLAN.md on branch `r13-ui`; show the founder student Home + test page before restyling the rest.
- Session 41 (2026-10-19): founder replaced the theme with their palette #3368A0 / #66A3BF / #C8DFDB / #F2EFE7, fonts
  Plus Jakarta Sans + Source Serif 4, "workbook" layout, calmer links/buttons — PR #35 open. Founder then asked: light
  theme only, and fix font sizes, sidebar, button placement and spacing ("too close") — the 8 steps are in
  PROGRESS.md "Next exact action (session 42)"; build them on `r13-ui`, then ask "merge #35?".
- `examedge_ai/` is its own git repository (the parent repo ignores this folder). Work on a branch per phase,
  commit after every green task with clear messages, and push the phase branch. The GitHub remote exists:
  origin = github.com/khushpal-cipher/ExamEdge_ai (PUBLIC — never commit secrets). When a phase passes the full
  quality gate, open a PR into main, check its CI result, fix until green, then merge it.
  Do NOT deploy or create any other cloud account/resource — ask the founder first.

## 2. There are NO API keys yet — build "demo mode"
- All AI goes through packages/core/ai (the gateway). Provider is chosen by env:
  AI_PROVIDER=fake|anthropic, EMBEDDINGS_PROVIDER=fake|voyage. Default = fake.
- Fake LLM: deterministic, schema-valid outputs for every feature (tutor answers built from the retrieved
  passages with real citations to them, MCQs with keys, numerical questions, summaries, flashcards, mind maps,
  OCR text). It must exercise the same code paths, metering and quota checks as the real provider
  (record usage_records with token estimates and cost 0, provider='fake').
- Fake embeddings: deterministic (e.g. hashed bag-of-words into a 1024-dim vector) so retrieval actually works
  together with Postgres full-text search.
- Real providers (Anthropic Claude: claude-haiku-5-5, claude-sonnet-5-5, claude-opus-5-5; Voyage voyage-4) are
  implemented behind the same interface but only enabled when a key exists; their tests are marked BLOCKED.
  Use the claude-api skill before writing any Anthropic SDK code; never guess SDK APIs.
- Login: Google OAuth is wired in Supabase config, but needs real credentials (BLOCKED). For local dev and tests,
  provide a development-only "Sign in as demo user" path using seeded Supabase local users; it must be impossible
  to enable in production (env check + test).
- Seed script `npm run seed:demo` creates "Demo Classes" (demo.localhost) AND "Rival Academy" (rival.localhost) with
  batches, subjects, chapters, owner/admin/teachers/~50 students each, sample PDFs (generate small ones), published notes,
  practice data, released tests with ranks, one test waiting for theory checking. Rival Academy exists to prove isolation.

## 3. How to work (every phase)
- Order: Phase 1 → 2 → 3 → 7 (tests, checking, ranks, progress page: no AI needed) → 4 → 5 → 6 → 8 → 9 → 10 (local parts).
- Before each phase: state the scope and the acceptance criteria you will prove (from IMPLEMENTATION_ROADMAP.md).
- Follow the quality gate in docs/TEST_STRATEGY.md §6 exactly: format, lint, typecheck, unit, integration,
  pgTAP (RLS matrix + policy coverage), Playwright E2E, production build — all must pass.
- Then verify like a user: start the app, open the built-in browser, and click through the phase's journeys
  as owner, teacher, student AND a Rival Academy user trying to reach Demo Classes data. Check phone width (375px).
  Fix what you find, rerun tests.
- Never weaken, skip or delete a failing test to get green. A test that did not run is BLOCKED, not passed.
- After each phase: update PROGRESS.md (what was done, exact commands run and their results, commit hash,
  BLOCKED items, next exact action) and commit. Keep PROGRESS.md accurate enough that a brand-new session could continue.
- Keep code minimal and boring: no extra vendors, no Redis, no microservices, no new dependency for a few lines.
  If a design doc is wrong or impossible, fix the doc, add an entry to docs/DECISIONS.md, then build.

## 4. Security rules you must not break (details in CLAUDE.md and SECURITY_THREAT_MODEL.md)
- RLS on every exposed table; composite FKs (institute_id, parent_id); institute derived from the host, never the browser.
- No Supabase secret key in web/worker runtime; worker uses its own role with transaction-local tenant context.
- Answer keys live in question_keys with no student access; DB clock enforces test deadlines.
- No PII or prompt text in logs; no secrets in git (add gitleaks); Markdown rendered with HTML and remote images disabled.
- The cross-tenant isolation suite (T-ISO-*) is a release gate: it must pass before a phase is called done.

## 5. Missing tools: install them yourself (founder's standing permission)
- The founder pre-approves installing any free developer tool this build needs (for example Docker Desktop,
  Supabase CLI, Playwright browsers, ffmpeg, pnpm, gitleaks). Do not stop to ask — install it and continue.
- Install only from trusted official sources: Homebrew (`brew install …` / `brew install --cask …`), the npm registry,
  `npx`/`npm i -D` for project tools, `uv`/pip from PyPI, or the vendor's official site. Prefer project-local
  installs (devDependencies, `npx`) over system-wide ones. Never run scripts from unknown sites, never disable
  macOS security settings, never use `sudo` for npm.
- If Docker Desktop is installed but not running: start it with `open -a Docker`, then wait until `docker info` succeeds.
- If an installer needs the founder's Mac password, run it in the terminal so the founder can type it,
  say in one line what is waiting, and continue with other work meanwhile. Never ask for, store or type the password yourself.
- Record every tool you install (name, version, command) in PROGRESS.md under "Relevant files and commands".

## 6. When to stop and ask the founder
Only for: paid software or anything that costs money, creating any online account/remote/deployment,
or a product decision not covered by the docs. Otherwise choose the documented default,
note it in DECISIONS.md, and continue.

## 7. If your context gets long
Before it runs out: commit, write a precise handoff in PROGRESS.md ("Next exact action", open failures, how to run),
then tell the founder to start a new session with this same prompt.

## 8. Definition of done for this whole task
- All Release 1 features in HOW_IT_WORKS.md work in demo mode on demo.localhost.
- All automated suites pass; evidence recorded in PROGRESS.md; items needing real keys/accounts listed as BLOCKED.
- A short "How to run the demo" section in README.md (commands + demo logins), and a final summary to the founder
  in simple English: what works, what is BLOCKED and why, and the exact steps to switch from fake AI to real keys.
```
