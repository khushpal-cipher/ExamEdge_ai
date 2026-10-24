# Launch plan (founder, 2026-10-24, updated 2026-10-25)

Goal: put ExamEdge AI online at `examedgeai.in` as fast as possible, with free pilots first and payment by hand
until Razorpay is ready. Prices and limits come from [PRICING_PLAN.md](PRICING_PLAN.md); this file is the order of work.
All money figures are estimates [E]; check each price when buying.

Status key: ⬜ not started · 🟨 started · ✅ done

## A. Build (code, no money needed)

| # | Step | What it means | Model / Effort | Status |
|---|---|---|---|---|
| 1 | Free pilot | 14 days free, 10 students, owner + 3 teachers, $10 AI for the whole pilot. Ask "How many students do you have?" when it is created. After day 14: AI off, app read-only, banner "Your pilot has ended". Founder can extend it. Data kept 30 days, then deleted by hand. | Sonnet / Medium | ⬜ (a first draft was undone on 2026-10-24 at the founder's request) |
| 2 | Hide Audio + Video overview | Off for real users (`OVERVIEWS_BETA`), on locally for testing. Server also refuses them. | Haiku / Low | ⬜ |
| 3 | Price per account | Every account charged (students, teachers, admins; owner free): first 300 at ₹200, 301–1,000 at ₹120, above 1,000 at ₹89, slabs like income tax; minimum 30 accounts (₹6,000); yearly = pay 10 get 12; +18% GST (PRICING_PLAN §2a). Only the platform admin edits prices. | Opus / High | ⬜ |
| 4 | Limits follow the count | AI budget = accounts × $0.60 + $31 (stop AI on), 15 doubts / 5 study tools a day per student, 30 doubts a day per teacher, storage 1 GB per 50 accounts — all set automatically. | Sonnet / Medium | ⬜ |
| 5 | Bill page | Account count (students + teachers), this month's price by slab, monthly vs yearly with "save ₹…", AI used %, next bill date. | Sonnet / Medium | ⬜ |
| 6 | Billing rules | Pay at the start of the month; billed on the highest count of the month; yearly covers the count on the day they pay, extras billed every 3 months; one pilot per coaching. | Opus / High | ⬜ |
| 7 | Payment by UPI (by hand) | Owner picks a plan, pays to the founder's UPI QR, types the transaction number (UTR). Founder checks the bank app and presses Approve → status `active`, plan limits set, "paid until" date, simple receipt. | Sonnet / Medium | ⬜ |
| 8 | Renewal | Reminder before "paid until" ends; read-only after a few days' grace if unpaid. | Sonnet / Medium | ⬜ |
| 9 | Budget warning + top-ups | Warn the owner at 80% of the AI budget; top-up pack ₹2,500 for $20 more AI (paid the same way as step 7). | Sonnet / Medium | ⬜ |
| 10 | Legal pages | Privacy, Terms and Refund pages (text from a lawyer or a template the founder approves). Razorpay needs all three. | Sonnet / Low | ⬜ |
| 11 | Quality gate | Full `npm run check`, PR, CI green, merge. | Haiku / Low | ⬜ |

Steps 4–9 depend on step 3: re-check step 3's design at high effort before building them.

## B. Go online (founder's accounts and money)

About **₹10,000–15,000 for the first 2 months**; keep ₹20,000 to be safe (Indian cards add GST + forex fees).

| # | Step | Who | Cost (2 months) | Status |
|---|---|---|---|---|
| 12 | Buy `examedgeai.in` (registrar that allows changing nameservers) | Founder | ₹800–1,200 a year | ⬜ |
| 13 | Accounts: Vercel Pro (website), Railway Hobby (worker), Supabase (free, Pro the day a real pilot starts), Anthropic $20 credits | Founder | ≈ ₹3,600 + ₹900 + ₹0–4,400 + ₹1,800 | ⬜ |
| 14 | Set up: cloud database + migrations, website, worker, `*.examedgeai.in` wildcard (Vercel nameservers), Google sign-in on the live address (publish consent screen), Resend email domain, secret keys, Sentry alerts (free), nightly backup + one test restore. Change docs from `examedge.in` to `examedgeai.in`. | Claude (Opus / High) | — | ⬜ |
| 15 | Platform admin account with MFA, then a test run with one coaching | Founder + Claude (Sonnet / Medium) | — | ⬜ |
| 16 | Before any 1,000+ student coaching: load test (many students opening a test at once) and Claude's per-minute limits for our account | Claude (Sonnet / Medium) | — | ⬜ |

The founder's Mac does not need to stay on: Vercel, Supabase and Railway run the site all the time.

## C. Paperwork and decisions (founder)

| # | Item | When | Cost |
|---|---|---|---|
| 17 | Lawyer's opinion on children's data (Q-01) | Before real school students, pilots included | ≈ ₹10,000–30,000 [U] |
| 18 | Business registration + GST via a CA, then Razorpay KYC (ask Razorpay if a sole owner with PAN + bank account is enough [U]) | Before Razorpay | ≈ ₹3,000–15,000 [U] |
| 19 | Ask 2–3 coachings what they pay today before fixing prices | Before the first paid plan | — |
| 21 | After the first pilot month: check real AI cost per student, adjust prices and budgets | After the first pilot | — |

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
1. Yes / no to payment by UPI by hand (step 7).
