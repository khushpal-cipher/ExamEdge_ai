# Launch plan (founder, 2026-10-24, updated 2026-10-25)

Goal: put ExamEdge AI online at `examedgeai.in` as fast as possible, with free pilots first and payment by hand
until Razorpay is ready. Prices and limits come from [PRICING_PLAN.md](PRICING_PLAN.md); this file is the order of work.
All money figures are estimates [E]; check each price when buying.

Status key: ⬜ not started · 🟨 started · ✅ done

## Build order by model (founder, 2026-10-25: Sonnet work first, then Opus, to save tokens)

The founder picks the model in the app before each session; one batch per session (or more if context allows).
Session settings (founder picks both before pasting the prompt): **A = Sonnet, Medium effort · B = Opus, High ·
C = Sonnet, Medium · D = Opus, High.** If a task inside a session turns out tricky, the session says so and the
founder may raise the effort for that part.
"CR" = Code review findings below, "Step" = section A. A batch only starts when the batch before it is merged.

**Batch A — Sonnet** (no Opus design needed)
| Task | Model / Effort |
|---|---|
| CR 3 live site needs real Claude · CR 5 no student text in logs · CR 10 purge oversized files | Sonnet / Low |
| CR 4 "#2 of 1" · CR 7 refresh job claim · CR 8 multi-correct partial marks | Sonnet / Medium |
| CR 6 harder to report fake AI answers · CR 9 hide practice-quiz answers · CR 11 "Mix" results | Sonnet / Medium |
| Step 2 overviews "Beta · Coming soon" | Haiku / Low (Sonnet fine) |
| Step 10 public home page · Step 11 legal pages + consent screen (needs founder's name, address, phone) | Sonnet / Medium |
| Step 12 check untested pages | Sonnet / Medium |
| Quality gate, PR, CI, merge | Haiku / Low (Sonnet fine) |

**Batch B — Opus** (money, security, design decisions)
| Task | Model / Effort |
|---|---|
| CR 1 students draining the AI budget · CR 2 stuck AI charges | Opus / High |
| Step 1 free pilot (read-only rules, seat caps, midnight switch, never mid-test) | Opus / High |
| Steps 3 + 6 design: price slabs, account count, billing period, "paid until", payments table, UPI flow, renewal and read-only rules — written as a short spec in this file before any code | Opus / High |

**Batch C — Sonnet** (builds from Batch B's spec)
| Task | Model / Effort |
|---|---|
| Step 3 + 4 price and limits in code · Step 5 Bill page · Step 7 UPI payment by hand · Step 8 renewal · Step 9 80% warning + top-ups | Sonnet / Medium |
| Quality gate, PR, CI, merge | Haiku / Low |

**Batch D — Opus** (going online, after the founder's accounts exist)
| Task | Model / Effort |
|---|---|
| One Opus review of all money code from Batch C before real payments | Opus / High |
| Step 16 deploy (cloud database, keys, wildcard domain, Google sign-in, email, backups) | Opus / High |
| Steps 17–19 real Claude test, first coaching, load test | Sonnet / Medium |

## A. Build (code, no money needed)

| # | Step | What it means | Model / Effort | Status |
|---|---|---|---|---|
| 1 | Free pilot | 7 days free, 10 students, up to 20 teachers/admins (founder can raise), $10 AI for the whole pilot (teachers share it). Founder types "How many students do you have?" and the end date when creating it. Banner "N days left". After day 7: AI off, app read-only, banner "Your pilot has ended". Founder can extend it. Data kept 30 days, then deleted by hand. | Sonnet / Medium | ⬜ (a first draft was undone on 2026-10-24 at the founder's request) |
| 2 | Audio + Video overview "Beta · Coming soon" | Real users still see both tiles, greyed out with a "Beta · Coming soon" badge, and cannot open or make them (`OVERVIEWS_BETA` off; the server also refuses). Fully usable locally for testing. | Haiku / Low | ✅ 2026-10-25 |
| 3 | Price per account | Every active account charged (students, teachers, admins; owner free; removed accounts not counted): first 300 at ₹200, 301–1,000 at ₹120, above 1,000 at ₹89, slabs like income tax; minimum 30 accounts (₹6,000); yearly = pay 10 get 12; +18% GST (PRICING_PLAN §2a). Only the platform admin edits prices. | Opus / High | ⬜ |
| 4 | Limits follow the count | AI budget = accounts × $0.60 + $31 (stop AI on), 15 doubts / 5 study tools a day per student, 30 doubts a day per teacher, storage 1 GB per 50 accounts — all set automatically. | Sonnet / Medium | ⬜ |
| 5 | Bill page | Account count (students + teachers), this month's price by slab, monthly vs yearly with "save ₹…", AI used %, next bill date, "Pay now". | Sonnet / Medium | ⬜ |
| 6 | Billing rules | Pay at the start of the month; billed on the highest count of the month; yearly covers the count on the day they pay, extras billed every 3 months; one pilot per coaching. | Opus / High | ⬜ |
| 7 | Payment by UPI (by hand) | Owner sees the amount, pays to the founder's UPI QR / "Pay with UPI" link, types the UTR. Founder gets an email + "Payments to check", matches it in the bank app, presses Approve (status `active`, limits set, "paid until", receipt) or Reject with a reason. | Sonnet / Medium | ⬜ (founder said yes, 2026-10-25) |
| 8 | Renewal | Reminder email + banner before "paid until" ends; read-only after a few days' grace if unpaid. | Sonnet / Medium | ⬜ |
| 9 | Budget warning + top-ups | Warn the owner at 80% of the AI budget; top-up pack ₹2,500 for $20 more AI (paid the same way as step 7). | Sonnet / Medium | ⬜ |
| 10 | Public home page | `examedgeai.in`: what ExamEdge does, prices, "Book a demo" / contact (`support@examedgeai.in`), links to the legal pages; one H1, title and description, robots.txt + sitemap. Razorpay and coachings look here first. | Sonnet / Medium | ✅ 2026-10-25 |
| 11 | Legal pages | Claude drafts Privacy, Terms (incl. "one account = one coaching"), Refund & Cancellation, Contact Us and Service delivery pages from a standard template, written for what ExamEdge really does (founder approves; lawyer reviews later). Founder supplies: business name, address, phone, grievance officer name + email. Refund rule (founder, 2026-10-25): **no refund for any payment** (monthly, yearly, top-ups); a coaching can cancel anytime and keeps access until the paid period ends; consent step for students if the lawyer asks for it (Q-01). Razorpay needs all three pages. | Sonnet / Low | ✅ 2026-10-25 (real details; founder approves text, lawyer later) |
| 12 | Check unverified pages | Click through in the new look: owner Bill page, test runner, results, theory checking, Reviews, Contest; a full Google sign-in and invitation acceptance (PROGRESS.md "Unverified"). | Sonnet / Medium | ⬜ |
| 13 | Quality gate | Full `npm run check`, PR, CI green, merge. | Haiku / Low | ⬜ |

Steps 4–9 depend on step 3: re-check step 3's design at high effort before building them.

## B. Go online (founder's accounts and money)

About **₹10,000–15,000 for the first 2 months**; keep ₹20,000 to be safe (Indian cards add GST + forex fees).

| # | Step | Who | Cost (2 months) | Status |
|---|---|---|---|---|
| 14 | Buy `examedgeai.in`; Zoho Mail free (`khushpal@`, `hello@`, `support@`); Google account on `khushpal@`; Udyam | Founder | ₹800–1,200 a year | 🟨 domain bought 2026-10-25 (GoDaddy, 1 year, ₹117 with GOINDIA; renews Oct 2027 at ₹899); Zoho, Google account, Udyam next |
| 15 | Accounts with `khushpal@examedgeai.in`: Vercel Pro (website), Railway Hobby (worker), Supabase (free, Pro the day a real pilot starts), Anthropic $20 credits with a monthly spend limit | Founder | ≈ ₹3,600 + ₹900 + ₹0–4,400 + ₹1,800 | ⬜ |
| 16 | Set up: cloud database + migrations, website, worker, `*.examedgeai.in` wildcard (Vercel nameservers), Google sign-in on the live address (publish consent screen), Resend domain (`noreply@`), secret keys, `AI_PROVIDER=anthropic` (never Gemini for real users), built-in notes search (Voyage later), demo login off, Sentry alerts (free), nightly backup + one test restore. Change docs from `examedge.in` to `examedgeai.in`. | Claude (Opus / High) | — | ⬜ |
| 17 | Real Claude test: every AI feature once with the real key (tutor, AI notes, AI test, study tools, scanned pages) — so far only fake and Gemini AI were used | Claude (Sonnet / Medium) | ≈ $1–2 of credits | ⬜ |
| 18 | Platform admin account with MFA, then a test run with one coaching | Founder + Claude (Sonnet / Medium) | — | ⬜ |
| 19 | Before any 1,000+ student coaching: load test (many students opening a test at once), Claude's per-minute limits for our account, rollback rehearsal | Claude (Sonnet / Medium) | — | ⬜ |

The founder's Mac does not need to stay on: Vercel, Supabase and Railway run the site all the time.

## C. Paperwork and decisions (founder)

| # | Item | When | Cost |
|---|---|---|---|
| 20 | Lawyer reviews Privacy, Terms and the consent screen; Data Processing Agreement for coachings (Q-01) | After 2–3 paying coachings, or sooner if a coaching asks (DPDP child rules phase in ≈ 2027 [U]) | ≈ ₹15,000–45,000 [U] |
| 21 | Business registration + GST via a CA, then Razorpay KYC (ask Razorpay if a sole owner with PAN + bank account is enough [U]) | Before Razorpay | ≈ ₹3,000–15,000 [U] |
| 22 | Ask 2–3 coachings what they pay today before fixing prices | Before the first paid plan | — |
| 23 | After the first pilot month: check real AI cost per student, adjust prices and budgets | After the first pilot | — |

Money received by UPI is business income: tell the CA. GST registration is needed above ₹20 lakh a year [U].
Never use a "no KYC" payment repo: every real Indian gateway needs KYC, and unknown payment code is a risk.

## D. Later

- Razorpay replaces the manual UPI step (same plans, same Approve result, automatic).
- NotebookLM-style Audio overview (two-host conversation, real voice, MP3 + player) and Video overview (animated
  scenes with drawings, timed to the voice) — tested locally as Beta first. Voice: Gemini TTS or Sarvam (founder decides).
- Voyage for better search inside notes (Q-08 data terms first).
- One device signed in per account at a time (stops shared logins).
- Lower AI cost: fewer doubts to the expensive model, reuse notes across students, batch mode (50% off) for teacher jobs.

## Founder answers still needed
None. UPI by hand = yes (2026-10-25). Step 1 is next; build it only when the founder says "build".

## Fixes found in the plan review (2026-10-25, to build with the step in brackets)
1. **GST only after registration [3, 5, 7]:** without a GST number we must not add 18% GST. Show "GST extra when
   applicable" and add GST only once the founder sets a GST number on the platform page.
2. **Real AI must be switched on [16]:** today a missing `AI_PROVIDER` silently means fake AI. On the live site the app
   must refuse to start unless `AI_PROVIDER=anthropic` (and never `gemini`).
3. **Same UTR twice [7]:** a transaction number can be used only once, and the amount must match the bill.
4. **Waiting for Approve [1, 7, 8]:** a coaching that has typed a UTR keeps full access until the founder approves or
   rejects, so a pilot ending on day 7 does not lock them out while the payment is checked.
5. **Read-only never mid-test [1, 8]:** pilot end and unpaid read-only start at midnight (IST), and a test already
   started can still be submitted; the owner is warned 3 days before.
6. **Budget follows growth [4]:** the AI budget is recalculated whenever the account count changes, not only on the
   1st, so a coaching adding 200 students mid-month does not run out of AI.
7. **Price changes [3]:** a coaching keeps its price until its next renewal when the founder changes prices.
8. **Refund rule [11]:** founder decided (2026-10-25): no refund for any payment (monthly, yearly, top-ups); access
   continues until the paid period ends.
9. **Second platform admin [18]:** only the founder can approve payments; if the founder's phone (MFA) is lost, nobody
   can. Give the founder's friend platform-admin access and save the authenticator backup codes.
10. **Data deletion reminder [1]:** the platform page lists ended pilots older than 30 days so their deletion is not
    forgotten.

## Code review findings (2026-10-25, fix before go-live unless marked later)
1. **Must:** a student can use up the whole coaching's AI budget by calling `ai_reserve` directly for `query_embed`
   (no daily limit) — fold the query embedding into the tutor's own reservation, or give it a per-student daily cap.
2. **Must:** reservations left `pending` (server stopped mid-call) never expire, so they keep eating the budget and are
   added to the Bill at worst-case cost — count `pending` only while younger than ~15 minutes, and settle older ones as error.
3. **Must:** a missing `AI_PROVIDER` on the live site silently means fake AI (same as plan-review fix 2).
4. **Must:** student Home shows "#2 of 1": the class size is counted through RLS, which shows a student only their own
   standings row — take `batch_size` from `student_progress` (or a small definer count).
5. **Should:** error logs can carry row data (PostgREST `details`/`hint`, e.g. "Failing row contains (…answer…)") —
   drop `details`/`hint` in `scrub`.
6. **Should:** a student can insert their own fake "AI" message into their chat and Report it to teachers — let
   `report_answer` accept only messages with a settled usage record of that student.
7. **Later:** ingest jobs longer than 30 minutes can run twice (double OCR cost) — refresh `claimed_at` while working.
8. **Later:** multi-correct partial marks give full marks when the key has 5+ correct options and 4 are chosen.
9. **Later:** published practice-quiz answers can be read through the API before trying (practice only, no rank).
10. **Later:** a file uploaded bigger than its declared size fails but its storage file is never purged.

Founder said "fix 1 to 10" on 2026-10-25, then "work for the next session": nothing is built yet. Approach worked out:
- 1: in `ai_reserve`, allow `query_embed` only while the student's `query_embed` count in the last 2 minutes is below
  their `tutor`/`tutor_premium` count in the same window (each doubt = one search, bounded by the daily limit).
- 2: in `ai_take` (under the institute lock) and in `purge_expired`, settle `pending` rows older than 1 hour as
  `error` with cost 0 (1 hour so a slow real call can still settle; `ai_finish` needs `pending`).
- 3: `assertLiveAi(env)` in `packages/core/src/demo.ts` (throws unless Supabase is local or `AI_PROVIDER=anthropic`),
  called from new `apps/web/instrumentation.ts` `register()` (nodejs runtime only) and at the top of
  `apps/worker/src/index.ts`; unit tests in `demo.test.ts`.
- 4: a small definer `batch_standing_count(batch)` (caller in the batch or staff) for the Home "of N".
- 5: add `details|hint` to `SENSITIVE_KEY` in `packages/core/src/log.ts`; test in `log.test.ts`.
- 6: `report_answer` only for messages whose `usage_record_id` is a settled tutor record of the same student, plus a
  unique index on `messages(usage_record_id)` (raises the bar; the answer text always passes through the user's
  session, so it cannot be made fully forgery-proof without a server secret).
- 7: refresh `claimed_at` every 5 minutes while `ingestVersion` works.
- 8: partial marks = `least(count * marks / 4, count * marks / number_of_correct_options)`.
- 9: needs the most work: institute quizzes read by students through a definer that strips answers (check every page
  that lists artifacts for students).
- 10: `purgeable()` also returns files of versions that failed with `too_large`.

(CR 3–11 built in Batch A, 2026-10-25; CR 1–2 are Batch B.)
11. **Founder decided "Mix" (2026-10-25, changes ADR-046), build next session with fixes 1–10:** after submitting, a
    student sees only their **total marks** at once; **right/wrong per question** (and correct answers, as today) only
    after the test closes. Why: on a long test window (e.g. 10 am–6 pm) an early finisher could pass on which answers
    were right. How: in `get_attempt_review`, before `closed` return per-question marks as null (keep the total), and
    the result page shows "Per-question results after the test closes"; record as ADR-057's neighbour in DECISIONS.md.

## Session 49 notes (founder Q&A, 2026-10-24/25)

- **Audio/Video overview (later, local Beta):** NotebookLM-style = Claude writes a two-host conversation → a real
  voice (Gemini TTS or Sarvam Bulbul) reads it → one MP3 stored once per chapter and language → player with seek,
  ±10 s, speed, download. Video = Claude writes scenes with SVG drawings that draw themselves, animated in the browser
  in time with the MP3 (no render server); a real MP4 via Remotion only later (licence [U]). Not real AI video models
  (wrong formulas, high cost). Cost [E]: ≈ ₹20 per audio, ≈ ₹25 per video, made once.
- **How `newtown.examedgeai.in` works:** owning `examedgeai.in` gives every name under it for free. One wildcard DNS
  record `*.examedgeai.in` → Vercel (needs Vercel nameservers [U]); Vercel adds https for each; the app reads
  `newtown` from the address and finds that institute. A new coaching = one row, no DNS change.
- **The Mac can be off:** Vercel, Supabase and Railway run the site; the Mac is only for building and testing.
- **Payment by UPI by hand (step 7):** owner picks a price → your UPI QR or "Pay with UPI" link with the amount →
  pays in GPay/PhonePe → types the 12-digit UTR → you get an email + "Payments to check" → you match it in the bank
  app → Approve (paid, limits set, "paid until" date, receipt) or Reject with a reason. Razorpay later automates it.
  Never use a "no KYC" payment repo: every real Indian gateway needs KYC.
- **Razorpay business type:** Individual if there is no registration yet; better: free Udyam registration
  (udyamregistration.gov.in, Aadhaar + PAN) → Sole Proprietorship. Razorpay checks the live website and its Privacy,
  Terms and Refund pages, so approval may wait for go-live. Category: education / SaaS subscription. Ask the CA about GST.
- **Business email:** Zoho Mail free plan (up to 5 addresses [U], web + phone app, opens in Chrome) — no Google
  Workspace needed. Addresses: `khushpal@`, `hello@`, `support@examedgeai.in`. Needs the domain first. Use it for
  Razorpay, Vercel, Supabase and Anthropic so the business owns them. App emails come from `noreply@examedgeai.in`
  through Resend (set up at deploy, works alongside Zoho).
- **"Check the real cost after the first pilot month":** prices rest on estimates (≈ 4 doubts a day); after a real
  pilot, read the real AI cost per account on the Bill page and raise or lower prices/budgets if it differs.
- **Udyam registration (free, udyamregistration.gov.in only; ignore paid look-alike sites):** owner's Aadhaar with its
  linked mobile (OTP), PAN, bank account + IFSC, business name and address, activity (software / education services;
  NIC code chosen on the form), start date, employees, investment and turnover (a new business can enter 0). GSTIN only
  if already registered. Certificate usually the same or next day [U].
- **Google account on `khushpal@examedgeai.in`:** yes, free, no Workspace: on Google sign-up choose "Use my current
  email address instead" and confirm with the code Zoho receives. Signs in to Chrome, Google Cloud (for Google sign-in
  setup) and YouTube; the mail itself stays in Zoho.
- **Buying `examedgeai.in`:** on a registrar that lets you change nameservers (GoDaddy, Namecheap, Hostinger, BigRock):
  search the name, add 1 year (or 2–3), pay ≈ ₹500–1,200; skip extras (hosting, email, website builder, SSL); turn on
  auto-renew and two-step login; check the renewal price, not only the first-year offer. Then Claude moves the
  nameservers to Vercel at deploy.
- **Legal documents (step 11; text from a lawyer or approved template, Claude builds the pages) [U: confirm with the lawyer]:**
  website pages — Privacy Policy (what data, why, sub-processors Anthropic/Supabase/Vercel/Railway/Resend/Google,
  data outside India, retention and deletion, essential cookies only, grievance officer contact), Terms of Service
  (subscription, pilot, prices, "one account = one coaching", acceptable use, AI answers can be wrong, the coaching owns
  rights to uploaded notes, suspension), Refund & Cancellation Policy, Contact Us (name, address, email, phone),
  Service delivery policy (online service, access on payment; Razorpay asks for a "shipping" policy). With each
  coaching — Data Processing Agreement (the coaching decides on students' data, ExamEdge processes it; DPDP Act 2023).
  For students — parental consent for under-18s (DPDP Act §9) shown in the app and recorded (`consent_records` table
  exists); no ads or tracking of children. Business papers (not pages): Udyam, PAN, bank account, GST later, invoices.
- **When the legal documents are needed (founder, 2026-10-25):** before go-live, ₹0 — Claude drafts Privacy Policy,
  Terms, Refund & Cancellation, Contact Us and Service delivery pages from a standard template (founder checks address,
  phone and refund rule; never copy another company's text) and builds a simple parent consent screen. After 2–3
  paying coachings (or when a coaching asks): lawyer reviews Privacy, Terms and consent ≈ ₹10,000–30,000 [U], and a
  Data Processing Agreement drafted once and reused ≈ ₹5,000–15,000 [U]. Do it as soon as money comes in: DPDP fines
  for children's data are large even though most rules apply from ≈ 2027 [U].
- **Razorpay: switch to the business bank account:** keep the same Razorpay account and email; Dashboard → Account &
  Settings → Bank account → change (checked by a ₹1 transfer or cancelled cheque, ≈ 2–5 working days [U]). The account
  must be in the founder's name or business name under the same PAN. Changing Individual → Sole Proprietorship (after
  Udyam) is a KYC change: ask Razorpay support to update this account (one PAN = one account), never open a new one.
- **Founder said "yes to all" (2026-10-25):** unpaid grace = **3 days**, then read-only; top-up pack = **₹2,500 for
  $20 more AI**; teachers/admins = **30 doubts a day**; pilot staff cap = **20** (founder can raise per coaching).
  Still open: legal page details (business name, address, phone, complaints contact) — needed in Batch A step 11;
  who the second platform admin is; when to book the lawyer; asking 2–3 coachings about price.
- **Business email steps (Zoho free):** buy `examedgeai.in` → zoho.com/mail "Forever Free" → add the domain → paste
  Zoho's TXT line into the registrar's DNS settings to verify → create `khushpal@`, `hello@`, `support@` → paste Zoho's
  MX, SPF and DKIM lines into DNS → open at mail.zoho.in or the Zoho Mail app. At deploy, when nameservers move to
  Vercel, these Zoho lines must be copied into Vercel's DNS or email stops.
- **DNS:** the domain's address book (name → where it goes). Found in the registrar account: GoDaddy "My Products →
  Domain → DNS / Manage DNS", Namecheap "Domain List → Manage → Advanced DNS", Hostinger "Domains → DNS / Nameservers".

