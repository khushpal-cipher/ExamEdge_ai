# ExamEdge AI — Pricing Plan

Status: **Founder's working plan, not built** · Last updated: 2026-10-24 · All costs are **estimates [E]** from
[COST_MODEL.md](COST_MODEL.md) ($1 = ₹88). Check them against real usage after the first pilot month.

## 1. The idea in one line
Charge **per student**, give each coaching an **AI budget that grows with its students**, and keep that budget
**below what they pay**. Then every coaching is profitable, small or large.

## 2. What one student costs us
- About **₹50 a month** if every student uses the AI daily (about 4 doubts a day + a few study tools).
- Plus about **₹2,700 a month per coaching** for teachers' AI (notes, AI tests, reading scanned pages).
- Plus servers: about ₹2,000 for a small coaching, rising to ₹15,000+ for 4,000 students.

## 3. The plans (prices before 18% GST)

| Plan | Students | Monthly | Per student | Yearly (pay 10 months, get 12) |
|---|---|---|---|---|
| **Mini** | up to 150 | ₹19,999 | ₹133 | ₹1,99,990 |
| **Basic** | up to 300 | ₹34,999 | ₹117 | ₹3,49,990 |
| **Pro** | up to 600 | ₹59,999 | ₹100 | ₹5,99,990 |
| **Scale** | 1,000 and more | ₹89 per student (charged for at least 1,000) | ₹89 | ₹890 per student |

- Teachers are included free in every plan (their AI use is inside the budget).
- Scale above 5,000 students: ₹84 per student. **Never go below ₹79** (profit drops under 30%).
- Between 601 and 999 students: offer Scale at the 1,000 minimum, or Pro plus extra students at ₹95 each.

## 4. Profit even in the worst case (every student uses the AI fully)

| Plan | Price | Our cost (AI budget + servers + 2% payment fee) | Profit |
|---|---|---|---|
| Mini (150) | ₹19,999 | ≈ ₹13,000 | ≈ ₹7,000 (35%) |
| Basic (300) | ₹34,999 | ≈ ₹21,700 | ≈ ₹13,300 (38%) |
| Pro (600) | ₹59,999 | ≈ ₹39,100 | ≈ ₹20,900 (35%) |
| Scale (1,000) | ₹89,000 | ≈ ₹63,300 | ≈ ₹25,700 (29%) |
| Scale (4,000) | ₹3,56,000 | ≈ ₹2,36,000 | ≈ ₹1,20,000 (34%) |

The budget box stops AI spending at a fixed amount, so this is the lowest profit. Most students will not use their
full share, so real profit should be higher (about 45–60%).

## 5. What to type in each coaching's limits (platform admin → institute → Usage limits)

| Box | Mini | Basic | Pro | Scale |
|---|---|---|---|---|
| Monthly AI budget (USD) | 120 | 210 | 390 | students × 0.55 + 31 (4,000 students → 2,231) |
| Doubts per student per day | 15 | 15 | 15 | 15 |
| Generations per student per day | 5 | 5 | 5 | 5 |
| Max upload (MB) | 50 | 50 | 50 | 50 |
| Storage (GB) | 5 | 10 | 20 | 1 GB per 50 students (4,000 → 80) |
| Parallel background jobs | 2 | 2 | 3 | 4 (6 above 3,000 students) |
| Stop AI when the budget is used up | ✅ | ✅ | ✅ | ✅ |
| AI enabled | ✅ | ✅ | ✅ | ✅ |

Why these numbers:
- **15 doubts a day feels unlimited** (a normal student asks 3–5); it only stops one student from overusing.
- **The monthly budget protects our money.** It is about $0.60 per student plus $31 for teachers, which covers
  about 4 doubts per student per day on average, more than most will use.

## 6. When a coaching grows (for example 140 → 280 students)
1. The app counts the real student accounts; we never rely on the number the coaching tells us.
2. Allow **10% extra** (Mini up to 165, Basic 330, Pro 660). After that, ask them to move to the next plan.
3. **Monthly plan:** the new plan starts from the next bill.
4. **Yearly plan:** they pay only the difference for the months left.
   Example: Mini → Basic with 6 months left = (₹3,49,990 − ₹1,99,990) × 6/12 = **₹75,000**.
5. Never move a coaching down in the middle of a year; it can drop at the next renewal.
6. **Scale:** bill on the highest student count of the month. Yearly Scale prepays an estimate; settle the
   difference every 3 months.
7. When moving a coaching up, also raise its AI budget and storage to the new plan's numbers (section 5).

## 7. Staying profitable with 1,000+ students
- **Per-student price, never one flat price.** More students = more money, matching the higher AI cost.
- **Budget grows with students** but always stays below what they pay.
- **Small discounts only**, floor ₹79 per student.
- **Ask big coachings to pay yearly in advance.** No risk of unpaid bills.
- **We can lower our own cost later** without changing prices: fewer doubts sent to the expensive model, reuse
  (cache) notes across students, cheaper batch mode for teachers' AI jobs.

## 8. If the budget runs out before month-end
The AI stops for that coaching until the 1st. To avoid angry students:
- warn the owner at **80%** of the budget
- sell **top-up packs**, for example **₹2,500 for $20 more AI** (about 25% profit)
- or move them to the next plan.

## 9. Not decided or not built yet
- Prices are a suggestion: ask 2–3 coachings what they pay today for apps or test series before fixing them.
- Not built: plan limits per student count, the 80% warning, top-up packs, automatic upgrades and payments
  (payment gateway). Today the limits are typed by hand on the platform admin page.
- Before 1,000+ student coachings go live: load test (many students opening a test at once) and the AI
  provider's per-minute limits for our account.

## 10. Free pilot (founder's idea, 2026-10-24, not built)
- **Who:** a new coaching starts with status `pilot` (the column already exists: `pilot|active|suspended|offboarding`).
- **Free for 14 days**, **10 students** (invite limit), the owner plus up to 3 teachers.
- **Same AI as the paid plans** (cheap Claude Haiku for most features), not the free Gemini key: Gemini's free tier
  uses the content to improve Google's products (ADR-051 forbids real student data on it), its shared rate limits
  break when several pilots run together, and a weaker pilot AI would not sell the real product.
- **Pilot AI budget: $10** with "Stop AI when the budget is used up" on. Expected use: about $3–5 per pilot [E].
- **How many students they have:** asked once when the pilot is created ("How many students do you have?", typed by
  you or by the owner). That number picks the suggested plan (section 3). After they pay, the app counts real
  student accounts and the 10% rule (section 6) applies, so a wrong guess corrects itself.
- **Day 14:** AI switches off and the app becomes read-only with a banner "Your pilot has ended. Choose a plan to
  continue." Data is kept for 30 days. You can extend a pilot by hand.
- **Paying:** the owner sees "Choose a plan" on the Bill page during and after the pilot, picks monthly or yearly
  and pays (Razorpay). On success the status becomes `active`, the plan's limits fill in, the 10-student cap is lifted.
  You can still switch a coaching to `active` by hand (for example cash or bank transfer).
- **Build order (only on the founder's word):** 1) pilot rules (10-student cap, end date, read-only after 14 days,
  $10 budget); 2) Bill page with plan, student count, monthly / yearly price, "Choose a plan"; 3) Razorpay in
  **test mode** (fake cards, no money, no KYC needed to build); 4) go live after Razorpay KYC and the legal pages.
- **Still needed before real students:** the legal opinion on minors' data (Q-01) applies to pilots too.

## 11. Money needed to go live [E] ($1 = ₹88; check each price when buying)

**Every month (small start, a few coachings):**

| Item | Cost a month |
|---|---|
| Vercel Pro (website) | $20 ≈ ₹1,800 |
| Supabase Pro + Small compute (database, logins, files; Mumbai) | $40 ≈ ₹3,500 |
| Railway (background worker) | $5–20 ≈ ₹450–1,800 |
| Resend (emails; free up to 3,000 a month) | $0–20 ≈ ₹0–1,800 |
| Claude API (pilots + first paying coachings; capped by each budget) | prepaid, see below |
| **Total servers** | **≈ $65–100 ≈ ₹6,000–9,000** |

**One-time / upfront:**

| Item | Cost |
|---|---|
| Domain `examedge.in` (yearly) | ≈ ₹800–1,200 |
| Claude API credits to start (covers ~5 pilots + buffer) | $50–100 ≈ ₹4,500–9,000 |
| Lawyer's opinion on minors' data (Q-01) | ≈ ₹10,000–30,000 [U] |
| Business registration + GST via a CA (needed for Razorpay KYC and invoices) | ≈ ₹3,000–15,000 [U] (proprietorship cheaper, Pvt Ltd more) |
| Razorpay | ₹0 setup; about 2% per payment [U] |

**Suggested amount to keep ready: about ₹60,000–80,000** = first 3 months of servers (≈ ₹25,000) + API credits
(≈ ₹9,000) + domain + legal and registration (≈ ₹25,000–45,000). The first paying coaching (Mini ₹19,999 a month)
covers the monthly server bill on its own.
