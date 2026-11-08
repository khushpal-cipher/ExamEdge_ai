# ExamEdge US — Build Plan

Written 2026-11-08. Goal: turn a copy of ExamEdge AI (Indian coaching) into a product for **US private schools,
microschools and tutoring centres**, while the coaching version stays untouched in its own folder.

Item numbers (#1–#77) are the agreed change list from the planning chat. #18 (SAT/ACT sets) was dropped.
Tags: **[D]** before showing it to US schools · **[S]** before real students use it · **[L]** after paying customers.

---

## 1. Ground rules

- **Two folders, two products.** `~/Documents/startup/examedge_ai` = coaching (frozen, only urgent fixes).
  `~/Documents/startup/examedge_us` = US version (all new work).
- **Separate everything online too:** new private GitHub repo, new Supabase project (US region), new Vercel project,
  new Render worker, new domain. The US copy must never use the coaching project's keys or database.
- **Because it is a fork, change text directly.** No translation system, no "India/US" switch. Delete or hide India-only
  parts in the copy instead of making them configurable.
- Same repo rules as before (`CLAUDE.md`): RLS on every table, `institute_id` from the host, no secret keys in web or
  worker, only `packages/core/ai` calls AI providers, no PII in logs, `npm run check` green before every commit.
- One task = one commit on a phase branch; PR to `main` at the end of each phase.
- Nothing is built without the founder saying **"build"**.
- **Security audits:** the founder runs `/security-audit` in 2–3 days, without asking. Its confirmed findings go into
  step 4.5. Until then the leads below are "not confirmed".

---

## 2. Open findings (carried over, NOT fixed yet)

From `/ponytail-review`, `/ponytail-audit` and the stopped `/security-audit` (session 69, see coaching `PROGRESS.md`).

| # | Finding | Status | Fixed in step |
|---|---|---|---|
| F1 | Pay pressed (or second tab) while Razorpay Checkout is open deletes the draft → `order.paid` webhook unmatched → paid, no access (`20261208000061_pay_online_15_minutes.sql` L18-19, `usage/pay-online.tsx`) | **Not fixed** — must fix | 0.1 |
| F2 | Free Supabase fails at 50 concurrent test starts (AC7.4 not met) | **Not fixed** — money decision | 5.1 |
| F3 | `private.worker_heartbeats` gets a row a minute, never purged | **Not fixed** | 1.5 |
| F4 | `PROGRESS.md` ~197 KB, needs archiving | **Not fixed** | 0.4 |
| F5 | `video/`, `.freebuff/`, `mango-website-notes.md` not in `.gitignore` (public repo) | **Not fixed** | 0.1 |
| F6 | Double press can create two waiting payment drafts (needs unique partial index) | **Not fixed** | 0.1 |
| S1 | `x-forwarded-host` trusted for tenant/admin host (`lib/tenant.ts`, `proxy.ts`, `auth/callback/route.ts`) | Lead, not confirmed | 4.4 |
| S2 | No CSP / security headers in `next.config.ts` (checked: none) | Lead, confirmed missing | 4.4 |
| S3 | Batch cookie without explicit `secure` | Lead, not confirmed | 4.4 |
| S4 | `accept_invitation` has no attempt limit | Lead, not confirmed | 2.5 |
| S5 | `<source>` delimiter in AI prompts not escaped | Lead, not confirmed | 4.4 |
| S6 | Hardening notes: stricter email regex, invite link from host not `Origin`, cap Markdown length | Notes | 4.4 |

---

## 3. Phases and steps

Each step: what · files · done when · recommended model / effort.

### Phase 0 — Set up the US copy (1–2 days)

**0.1 Fix payments and repo hygiene in the coaching folder first (F1, F5, F6, #51, #65)**
The coaching site is live and takes real money, and the copy should start from fixed code.
Keep a draft that already has a Razorpay order; don't refresh the page while Checkout is open; unique partial index
for one waiting draft; pgTAP cases (16-minute draft replaced, draft with `razorpay_payment_id` kept); unit test of
`isOnlineFresh`; `.gitignore` additions. Merge `r41-pay-expiry` to `main`.
Done when: `npm run check` green, PR merged.
→ Model: opus
→ Effort: high
→ Why: money code on a live site; a mistake loses a payment.

**0.2 Make the copy**
```bash
cd ~/Documents/startup
git clone examedge_ai examedge_us        # copies code + history, NOT node_modules, .env files or untracked files
cd examedge_us
git remote set-url origin <new private GitHub repo URL>   # founder creates the repo
cp ../examedge_ai/docs/US_BUILD_PLAN.md docs/            # this file (untracked in the coaching folder)
npm ci && git config core.hooksPath .githooks
```
In `supabase/config.toml`: `project_id = "examedge_us"` and every port +1000 (54321 → 55321, etc.) so both local
stacks can run side by side. New `.env.local` files from `.env.example` with **local** values only.
Done when: `supabase start`, `npm run db:reset`, `npm run check` all green in the new folder.
→ Model: sonnet
→ Effort: low
→ Why: mechanical setup; the only risk is copying a production key, which this avoids.

**0.3 Founder: new online accounts (founder clicks)**
New private GitHub repo · new Supabase project in a **US region** (Free for now) · new Vercel project (region `iad1`)
· new Render worker (US region) · buy the `.com` domain (#41). No production deploy yet.
→ Model: haiku
→ Effort: low
→ Why: checklist; Claude only verifies settings.

**0.4 Fresh project docs (F4)**
New `CLAUDE.md` (US product, US rules), new short `PROGRESS.md` (old one moved to `docs/PROGRESS_ARCHIVE.md`),
new `NEXT_SESSION_PROMPT.md`, ADR in `DECISIONS.md`: "US fork: separate repo, infra and domain".
→ Model: sonnet
→ Effort: low
→ Why: writing docs from decisions already made.

**0.5 Founder: demand check, runs in parallel with all phases (#55)**
Follow `docs/designs/us-private-schools-validation.md`: about 150 contacts over 3 weeks, outreach starts on day 1.
Gate: nothing in Phases 1-6 is built until the week-3 review in that doc (fewer than 5 conversations → change the
message, not the product).
→ Model: opus
→ Effort: high
→ Why: decides whether the rest is worth building.

### Phase 1 — US basics (about 1 week)

**1.1 Time zone per school (#27)**
Column on `institutes` (default `America/New_York`); replace `TZ = 'Asia/Kolkata'` (`apps/web/lib/assess.ts:5`) and
worker schedules (`apps/worker/src/index.ts:39-45`) with the school's zone. Test opens/closes across zones.
→ Model: sonnet
→ Effort: medium
→ Why: touches every test time; easy to get off by hours.

**1.2 USD pricing and currency (#26, #70)**
Founder decides first: price per student per year, lower minimum (e.g. 20 students), yearly deal. Then: USD prices,
`$` everywhere, cents in billing tables, remove rupee rate job and ₹99 charm logic.
→ Model: opus
→ Effort: high
→ Why: pricing decision plus billing migration; re-check against the F1 fix.

**1.3 US words, spelling and formats (#28, #29, #49)**
Batch → Class, Topic → Chapter, Subtopic → Section, Doubt → Question, Institute/Coaching → School, Bill → Billing;
US spelling; MM/DD/YYYY, 12-hour time, percent + A–F; remove JEE/NEET/coaching text.
→ Model: sonnet
→ Effort: low
→ Why: many files but mechanical; e2e tests need the new labels.

**1.4 Hide India exam features (#43–#47, #50)**
Hide audio/video overview; ranks, rank scroller, contests off; negative marking and CBT under "More options";
remove exam dropdown; academic year optional; subtopics hidden.
→ Model: haiku
→ Effort: low
→ Why: hiding and defaults.

**1.5 Small safety fixes (#52, F3)**
Untick "Move students" by default; daily purge of `private.worker_heartbeats`.
→ Model: haiku
→ Effort: low
→ Why: two small changes with clear tests.

### Phase 2 — Simple teacher portal (about 2–3 weeks)

**2.1 UI spec**
List the 10 most common teacher jobs, count today's clicks, write the 8 rules (one place per thing, same list
pattern, one main button, defaults, plain words, undo, empty states with a button, role-based menus).
Target ≤ 3 clicks per job. Output: `docs/UI_SPEC_US.md`.
→ Model: opus
→ Effort: high
→ Why: shapes every page after it.

**2.2 Colour mockup**
2–3 palettes on a student home and a teacher class page; founder picks one. Student side bright with a colour per
subject, teacher side calm, reading pages soft; all pass contrast checks.
→ Model: sonnet
→ Effort: medium
→ Why: cheap design choice before code.

**2.3 New menu and class page (#30–#32)**
Teacher menu: Home · Classes · Tests · Reviews (owner also People · Billing · Settings). Class page tabs:
Students | Chapters | Tests | Results. Subjects and Question bank move inside.
→ Model: sonnet
→ Effort: medium
→ Why: navigation across many pages.

**2.4 Students tab (#6, #7, #8, #10)**
"Add students" panel (join code / pick from school / invite by email), tick boxes + action bar
(Move · Remove · Mark as left), Current/Past filter, Undo.
→ Model: sonnet
→ Effort: high
→ Why: "Mark as left" changes the seat count used for billing.

**2.5 Join link/code and teacher invites (#4, #5, #64, S4)**
Join code per class (new table with RLS and composite FK), student signs in with Google and joins; "Invite a
teacher"; attempt limits on join codes and `accept_invitation`. pgTAP isolation tests.
→ Model: opus
→ Effort: high
→ Why: sign-up and tenant isolation.

**2.6 Setup wizard (#1, #2, #12, #33, #50)**
One screen: class → subjects → paste chapters (one per line) → drop notes → invite. Breadcrumbs, "⋯" row menus,
drag to reorder. Database stays the same.
→ Model: sonnet
→ Effort: medium
→ Why: new screens on existing save functions.

**2.7 Three-step test creation (#13)**
What (class + chapter) → Questions ("Make 10 with AI", review, approve) → When (defaults: now, 7 days, 30 min).
→ Model: sonnet
→ Effort: medium
→ Why: rearranges an existing flow.

**2.8 Checklist and the 8 rules everywhere (#11, #35)**
Get-started checklist on Home; one-line hints, one main button, empty states with a button on every remaining page.
→ Model: sonnet
→ Effort: medium
→ Why: same patterns repeated.

**2.9 Apply colours and small celebrations (#25, #34)**
→ Model: sonnet
→ Effort: medium
→ Why: one CSS file, many screens to check.

**2.10 Chromebook and accessibility pass (#42)**
Every page at 1366×768, keyboard only, screen reader labels, contrast.
→ Model: sonnet
→ Effort: medium
→ Why: checking many pages.

### Phase 3 — Safe AI and student features (about 2 weeks)

**3.1 Safe tutor (#21, #22, #23)**
"Hints only" mode per class, safety flagging (self-harm, bullying) to the teacher, teacher can read students' AI chats.
→ Model: opus
→ Effort: high
→ Why: child safety and prompt design.

**3.2 Age gate (#58, #67)**
Grade or age at sign-up; block under 13 for now.
→ Model: sonnet
→ Effort: medium
→ Why: legal guard at a trust boundary.

**3.3 Simplify and Spanish in study tools (#24)**
→ Model: sonnet
→ Effort: low
→ Why: new options on existing tools.

**3.4 Extra time per student on tests (#16)**
→ Model: sonnet
→ Effort: medium
→ Why: touches timers and auto-submit; re-check carefully.

**3.5 "What to reteach" report (#14)**
→ Model: sonnet
→ Effort: medium
→ Why: AI grouping over existing data; watch AI cost.

**3.6 Weekly parent report email (#15)**
Parent email per student (opt-in by school), weekly summary.
→ Model: sonnet
→ Effort: medium
→ Why: new emails to parents; re-check privacy at high effort.

### Phase 4 — Money, legal, security (about 1 week)

**4.1 Payments for US (#37, #48, #56, #57, #72, #73)**
Founder turns on Razorpay International Payments and asks the CA about the GST LUT. Code: USD orders, hide UTR/UPI,
invoice PDF without Indian GST, US refund/cancellation terms.
→ Model: sonnet
→ Effort: high
→ Why: money code.

**4.2 Pilot 14–30 days, one whole class (#71)**
→ Model: sonnet
→ Effort: low
→ Why: change existing pilot limits.

**4.3 Legal and privacy (#38, #39, #66)**
US contact in `business.ts`, US privacy policy, terms, student data agreement; promise: no selling, no AI training,
deletion on request; check Claude and Gemini data terms (paid tiers only) and list them.
→ Model: sonnet
→ Effort: medium
→ Why: drafting; lawyer review later (#60).

**4.4 Security hardening (#63, S1–S3, S5, S6)**
CSP and security headers, `secure` cookie, take the host from a trusted source only, escape AI prompt delimiters,
hardening notes.
→ Model: opus
→ Effort: high
→ Why: security-sensitive, children's data.

**4.5 Founder's security audit results (#62)**
Founder runs `/security-audit` (2–3 days from 2026-11-08). Fix every confirmed finding, add a test for each.
→ Model: opus
→ Effort: high
→ Why: confirmed security bugs.

### Phase 5 — US launch readiness (about 1 week)

**5.1 Database for real students (#40, #53, F2)**
Upgrade the US Supabase project to Pro, push migrations, re-run the load test (`scripts/load/`) at 50 and 500 starts.
→ Model: sonnet
→ Effort: high
→ Why: production data; load result decides go or no-go.

**5.2 Deploy (#40, #41)**
Vercel `iad1`, Render US worker, `.com` domain with wildcard subdomains, Resend on the new domain, Google OAuth for
the new domain, Razorpay webhook to the new domain.
→ Model: sonnet
→ Effort: medium
→ Why: checklist with many settings; founder clicks the money and account steps.

**5.3 School IT guides (#74, #75)**
Test sign-in with a real school Google Workspace account; one-page "allow ExamEdge" guide for Google admins and web
filters (GoGuardian, Securly).
→ Model: sonnet
→ Effort: medium
→ Why: depends on real-world testing.

**5.4 Selling material (#36, #69, #77)**
US home page, a seeded demo school ("Grade 8 Science"), five 1-minute help videos.
→ Model: sonnet
→ Effort: medium
→ Why: content and seed data.

**5.5 Support and alerts (#76)**
Email support promise (reply within 12 hours), uptime alert to the founder's phone.
→ Model: haiku
→ Effort: low
→ Why: setup and text.

**5.6 Usability test (#61)**
2–3 new people: set up a class, invite a student, make a test, without help; timed.
→ Model: haiku
→ Effort: low
→ Why: observation; failures go back to Phase 2.

### Phase 6 — After 2–3 paying customers [L]

| Step | Items |
|---|---|
| 6.1 US company, US bank (or Skydo/Payoneer), Stripe, insurance | #59 |
| 6.2 Lawyer review of the privacy agreement | #60 |
| 6.3 Upload a PDF → AI suggests chapters | #3 |
| 6.4 "New school year" button | #9 |
| 6.5 Rubric grading with teacher approval | #17 |
| 6.6 US standards tags | #19 |
| 6.7 Google Classroom / Clever, only if asked | #20 |
| 6.8 "Export all our data" for a school | #68 |

---

## 4. Coverage check (every item has a step)

| Items | Step |
|---|---|
| #1 #2 #12 #33 #50 | 2.6 (#50 also 1.4) |
| #3 #9 #17 #19 #20 #59 #60 #68 | Phase 6 |
| #4 #5 #64 | 2.5 |
| #6 #7 #8 #10 | 2.4 |
| #11 #35 | 2.8 |
| #13 | 2.7 |
| #14 #15 #16 | 3.5, 3.6, 3.4 |
| #21 #22 #23 | 3.1 |
| #24 | 3.3 |
| #25 #34 | 2.2, 2.9 |
| #26 #70 | 1.2 |
| #27 | 1.1 |
| #28 #29 #49 | 1.3 |
| #30 #31 #32 | 2.3 |
| #36 #69 #77 | 5.4 |
| #37 #48 #56 #57 #72 #73 | 4.1 |
| #38 #39 #66 | 4.3 |
| #40 #41 #53 | 0.3, 5.1, 5.2 |
| #42 | 2.10 |
| #43–#47 | 1.4 |
| #51 #65 | 0.1 |
| #52 | 1.5 |
| #54 | 0.1 (.gitignore), 0.4 (archive), 1.5 (heartbeats) |
| #55 | 0.5 |
| #58 #67 | 3.2 |
| #61 | 5.6 |
| #62 #63 | 4.5, 4.4 |
| #71 | 4.2 |
| #74 #75 | 5.3 |
| #76 | 5.5 |
| #18 | dropped |

Rough total: 7–9 weeks of sessions for Phases 0–5, depending on demand-check results.
