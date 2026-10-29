# ExamEdge AI — Cost Model

Status: **Draft for approval** · Last updated: 2026-10-14 · Labels: see [ARCHITECTURE.md](ARCHITECTURE.md) header.
All results are **estimates [E]** built on verified unit prices [V] and stated assumptions [A]. Re-run with real usage after the pilot.
Exchange rate assumption: **₹88 = $1** [A].

## 1. Verified unit prices (2026-10-14)

| Item | Price | Source |
|---|---|---|
| Claude Haiku 5.5 (prompt ≤ 100K tokens) | $0.10 in / $0.50 out per MTok; cache read $0.01 | [V] platform.claude.com/docs/en/about-claude/pricing |
| Claude Haiku 5.5 (prompt > 100K tokens) | $0.50 in / $2.50 out per MTok | [V] same |
| Claude Sonnet 5.5 | $2 in / $10 out per MTok; cache read $0.10 | [V] same |
| Claude Opus 5.5 | $4 in / $20 out per MTok; cache read $0.20 | [V] same |
| Batch API | 50 % off input and output | [V] same |
| Web search tool | $10 per 1,000 searches | [V] same |
| US-only inference (`inference_geo: "us"`) | 1.1× | [V] same — not needed; we use default global |
| Voyage `voyage-4` / `voyage-4-lite` | $0.06 / $0.02 per MTok; first 200M tokens free | [V] docs.voyageai.com/docs/pricing |
| Voyage `rerank-3-lite` | $0.02 per MTok | [V] same |
| Sarvam Bulbul v3 TTS | ₹30 per 10,000 characters (beta pricing) | [V] docs.sarvam.ai pricing |
| Supabase Pro | $25/month, includes $10 compute credit (1 Micro), 8 GB disk, 100 GB storage, 250 GB egress, 100K MAU | [V] supabase.com/pricing |
| Supabase overage | storage $0.0213/GB, egress $0.09/GB, disk $0.125/GB, MAU $0.00325 | [V] same |
| Supabase compute | Micro $10, Small $15, Medium $60 /month | [V] same |
| Supabase PITR | $100/month per 7 days retention | [V] same |
| Vercel Pro | $20 per developer seat/month, $20 usage credit, 1 TB fast data transfer; Hobby is non-commercial only | [V] vercel.com/pricing |
| Railway | Hobby $5 (incl. $5 usage), Pro $20 (incl. $20); ~$20/vCPU-month, ~$10/GB-RAM-month, egress $0.05/GB | [V] railway.com/pricing |
| Resend | Free 3,000/month, 100/day; Pro $20 for 50,000/month | [V] resend.com/pricing |
| Sentry | Free developer tier assumed sufficient for pilot | [U] |
| Razorpay transaction fees | not verified | [U] |
| Remotion company licence | required > 3 employees; price not verified | [V] requirement / [U] price |

## 2. Assumptions

| Symbol | Meaning | Value |
|---|---|---|
| a | share of enrolled students active in a month | 60 % [A] |
| M | tutor messages per active student per month | 120 (≈ 4/day) [A] |
| I_t, O_t | tutor tokens per message (input incl. passages + history; output incl. thinking) | 6,000 / 800 [A] |
| s | share of tutor messages escalated to Sonnet | 15 % [A] |
| G | student self-generations (practice quiz/flashcards) per active student per month | 20 at 4,000 in / 2,000 out on Haiku [A] |
| R | rerank tokens per tutor message | 16,000 (40 candidates × 400) [A] |
| D | pages uploaded per institute per month | 6,000 (200 PDFs × 30 pages) [A] |
| ocr | share of pages needing OCR | 50 % at 4,500 in / 700 out tokens per page on Haiku [A] |
| Q | AI-authored questions batches per institute per month | 100 Opus calls (10K in / 4K out) + 100 Sonnet dual-solves (3K in / 2K out) [A] |
| S | institute summaries per month | 200 Sonnet calls (20K in / 3K out) [A] |
| Retries/failures | add 5 % to variable AI cost | [A] |
| Prompt caching | **ignored** (conservative) | — |

## 3. Formulas

```
cost_per_call(model, in, out) = (in × price_in + out × price_out) / 1,000,000

tutor_msg      = (1 - s) × cost(Haiku, 6000, 800) + s × cost(Sonnet, 6000, 800)
               = 0.85 × $0.0010 + 0.15 × $0.0200 = $0.00385
rerank_msg     = 16,000 × $0.02 / 1e6 = $0.00032
per_active_student_month = M × (tutor_msg + rerank_msg) + G × cost(Haiku, 4000, 2000)
               = 120 × $0.00417 + 20 × $0.0014 = $0.500 + $0.028 = $0.53

per_institute_month (staff side)
  OCR          = 3,000 pages × cost(Haiku, 4500, 700) = 3,000 × $0.0008 = $2.40
  embeddings   = 6,000 × 700 tokens × $0.06 / 1e6  = $0.25 (inside free 200M tokens initially)
  questions    = 100 × cost(Opus, 10000, 4000) + 100 × cost(Sonnet, 3000, 2000) = $12.00 + $2.60
  summaries    = 200 × cost(Sonnet, 20000, 3000) = 200 × $0.07 = $14.00
  total        ≈ $31

variable_AI = 1.05 × (active_students × $0.53 + institutes × $31)
```

## 4. Scenarios (monthly)

| | A: 3 × 500 | B: 10 × 1,000 | C: 100 × 1,000 |
|---|---|---|---|
| Enrolled / active students | 1,500 / 900 | 10,000 / 6,000 | 100,000 / 60,000 |
| Student AI (× $0.53) | $477 | $3,180 | $31,800 |
| Institute AI (× $31) | $93 | $310 | $3,100 |
| +5 % retries | $29 | $175 | $1,745 |
| **Variable AI** | **$599** | **$3,665** | **$36,645** |
| Supabase (Pro + compute + staging) [E] | $40 (Small prod + Micro staging) | $100 (Medium prod) | $1,000+ (larger compute, replicas, PITR) [U: Large/XL prices not verified] |
| Vercel [E] | $20 | $50 | $300 |
| Worker (Railway) [E] | $20 | $60 | $400 |
| Email (Resend) | $20 | $20 | $35+ |
| Backups/monitoring/domain [E] | $5 | $30 | $150 |
| **Fixed/infra** | **~$105** | **~$260** | **~$1,900** |
| **Total** | **~$705 (≈ ₹62K)** | **~$3,925 (≈ ₹3.45L)** | **~$38,500 (≈ ₹33.9L)** |
| **Per enrolled student** | **≈ ₹41** | **≈ ₹35** | **≈ ₹34** |

### Sensitivity (what moves the number)
- **Sonnet share s** is the biggest lever: s = 5 % → tutor_msg = $0.00195 (≈ −50 % tutor cost); s = 30 % → $0.0067 (+75 %).
- **Messages M:** linear. Heavy users (300 msgs) cost ~2.5× the average → per-student daily caps matter.
- **Input size I_t:** passages dominate; trimming to 4,000 tokens cuts Haiku input cost by a third.
- **Prompt caching:** system prompt + library passages reused across students could cut input cost further; measure in Phase 6.
- Haiku's price **jumps 5×** above 100K-token prompts [V] → hard cap on prompt size in the gateway.

## 5. Release-2/3 features

| Feature | Unit cost | Notes |
|---|---|---|
| Audio overview (5 min ≈ 5,000 chars) | ≈ ₹15 TTS + ≈ $0.06 script (Sonnet, 15K in / 2.5K out) ≈ **₹20** [E] | Generated once per institute × chapter × language |
| Video (5 min) — generation | ≈ ₹15 TTS + ≈ $0.10 script + render (2 vCPU × 10 min ≈ $0.02 on Railway rates) ≈ **₹25** [E] | Cheap to make |
| Video — **delivery** | 50 MB per 1080p view × $0.09/GB Supabase egress = **₹0.40 per view** [E] | 60,000 students × 10 views/month = 30 TB ≈ $2,700/month → **video bandwidth becomes the first expensive item**; use 720p (~15 MB) and a zero-egress CDN/object store [U] |
| Web search (UPSC) | $0.01 per search + tokens | Enable only for current-affairs subjects |

## 6. What becomes expensive first
1. Tutor escalations to Sonnet (s) and very heavy users.
2. Video bandwidth (R3).
3. Opus authoring if it is ever exposed to students → **never** let students trigger Opus.
4. Supabase compute as concurrent users grow (scenario C).

## 7. Cost controls (implemented in Phases 5–6)
- Institute monthly AI budget (micro-USD) with alerts at 50/80/100 % and optional hard stop.
- Per-student daily limits: tutor messages (default 40), premium messages (default 5), generations (default 10) [A].
- Per-feature enable flags per plan; per-institute job concurrency (default 2).
- Provider-side spend limits per environment; platform daily spend alert from `usage_records`.
- Batch API for all non-urgent institute/library generation (−50 %).
- Reuse institute-scope artifacts by input hash; never regenerate the same summary twice.

## 8. Pricing hypothesis (must be validated with institutes — not assumed)
- Per enrolled student per month, billed to the institute: **₹99** list, pilot at ₹49 [A]. At scenario B cost (≈ ₹35) → ~65 % gross margin at ₹99.
- Fair-use quotas included; audio/video as add-on packs in R2/R3.
- Validation: ask the 3 pilot institutes what they pay today per student for software/test series; test ₹49/₹99/₹149 in conversations before building billing.

## 9. Sources
- Anthropic pricing: https://platform.claude.com/docs/en/about-claude/pricing (fetched 2026-10-14)
- Voyage pricing/models: https://docs.voyageai.com/docs/pricing , https://docs.voyageai.com/docs/embeddings
- Sarvam pricing / TTS API: https://docs.sarvam.ai/api-reference-docs/pricing , https://docs.sarvam.ai/api-reference-docs/text-to-speech/convert
- Supabase pricing/backups/RLS/SMTP: https://supabase.com/pricing , https://supabase.com/docs/guides/platform/backups , https://supabase.com/docs/guides/database/postgres/row-level-security , https://supabase.com/docs/guides/auth/auth-smtp
- Vercel: https://vercel.com/pricing , https://vercel.com/docs/functions/limitations
- Railway: https://railway.com/pricing · Resend: https://resend.com/pricing
- Remotion licence: https://github.com/remotion-dev/remotion/blob/main/LICENSE.md · Manim: https://www.manim.community/
- pgvector filtering: https://github.com/pgvector/pgvector · Razorpay webhooks: https://razorpay.com/docs/webhooks/validate-test/

> Note: ADR-060 moved the worker from Railway to Render. Worker prices in this file are still Railway's and need re-checking against Render [U].
