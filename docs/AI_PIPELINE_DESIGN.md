# ExamEdge AI — AI Pipeline Design

Status: **Draft for approval** · Last updated: 2026-10-14 · Labels: see [ARCHITECTURE.md](ARCHITECTURE.md) header.
Prices and sources: [COST_MODEL.md](COST_MODEL.md). NotebookLM is a product reference only — it offers no API we depend on.

## 1. Models and services

| Use | Choice | Model ID / product | Evidence |
|---|---|---|---|
| Tutor default | Claude Haiku 5.5, effort `low` | `claude-haiku-5-5` | [V] pricing $0.10/$0.50 per MTok (prompts ≤ 100K tokens), $0.50/$2.50 above |
| Tutor escalation, grading assist, summaries, dual-solve | Claude Sonnet 5.5 | `claude-sonnet-5-5` | [V] $2/$10 per MTok |
| Institute content authoring (AI test questions) | Claude Opus 5.5 | `claude-opus-5-5` | [V] $4/$20 per MTok; thinking cannot be disabled, effort default `medium` [V] |
| Bulk, non-urgent generation | Message Batches API | — | [V] 50 % discount |
| Citations | `search_result` content blocks with `citations.enabled` | GA, no beta header [V] | — |
| PDF / OCR fallback | Claude PDF input (page images + text) | Haiku 5.5 | [V] ~1,500–3,000 text tokens/page + image tokens |
| Embeddings | Voyage `voyage-4` (1024 dims, `input_type` query/document) | — | [V] $0.06/MTok, 32K context; multilingual positioning [V], Hindi quality **unverified** [U] |
| Rerank | Voyage `rerank-3-lite` (keep only if eval shows gain) | — | [V] $0.02/MTok |
| TTS (R2) | Sarvam Bulbul v3 | `bulbul:v3` | [V] 11 language codes incl. en-IN, hi-IN, bn, gu, kn, ml, mr, od, pa, ta, te; 2,500 chars/request; ₹30/10K chars (beta pricing); single speaker per request |
| Video (R3) | Remotion (React) + Manim CE (maths/physics) + ffmpeg | — | Remotion: company licence required for for-profit orgs with > 3 employees [V], price [U]. Manim: MIT [V] |
| Web search (UPSC current affairs, R3) | Anthropic web search tool | `web_search_20260209` | [V] $10 / 1,000 searches |

Model routing lives in one config file (`packages/core/ai/routing.ts`) so a model can be swapped without code changes elsewhere.
Refusals: check `stop_reason == "refusal"` on every response [V]; show a friendly message; Sonnet/Opus requests opt into server-side
fallbacks; Haiku has no server-side fallback [V] — the gateway retries once on Sonnet if quota allows.

## 2. AI gateway (the only path to providers)

```
call(feature, ctx{institute_id, user_id?, job_id?}, input)
  1. kill switch? feature enabled for institute plan?
  2. reserve the worst-case cost (ai_reserve / ai_reserve_job): kill switches, atomic counter + institute budget
     check (reject → AiBlocked → "limit reached"; provider never called) — ADR-025
  3. build prompt from versioned template (prompt_version), no PII
  4. assert all context passages belong to ctx.institute_id
  5. call provider (stream for chat), timeout, 1 retry on 429/5xx with backoff
  6. validate output (zod schema for structured kinds)
  7. settle the reservation once (tokens, cost_micro_usd from the routing.ts price table; error → counter refunded)
  8. return output + usage_record_id
```

## 3. Document ingestion

```
upload (signed URL) → confirm → enqueue ingest_document
worker (tenant transaction):
  validate: magic bytes = %PDF / allowed image/docx types [D], size ≤ quota, pages ≤ 300 [A]
  extract text layer per page (pdf.js-based lib [U: pick in Phase 4 spike])
  page quality check: chars/page, garbage ratio, missing formulas heuristic
  low-quality pages → Claude Haiku OCR in ≤ 20-page batches (keeps prompt < 100K tokens)
      output: Markdown + LaTeX per page, page numbers preserved
  chunk: by headings, 400–800 tokens, ~15 % overlap, never across chapters; keep page_start/page_end
  embed: voyage-4 input_type=document, batch requests
  write: insert chunks for this version → promote version → delete old version's chunks (one transaction)
  status: ready | failed(error_code)
```
- **Idempotent:** rerun deletes this version's chunks first. Singleton key = version id.
- **Partial failure:** nothing becomes visible until the promoting transaction commits; failed versions keep the old version live.
- **Update:** new upload = new version; old version stays live until the new one is ready.
- **Delete/withdraw:** withdraw = instant loss of student access (policy on `status`); delete = chunks deleted immediately, file purged after 30 days [A].
- **Reprocess:** bump `chunker_version`/`embedding_model` → `reindex` job per version; retrieval reads one model at a time per institute (cut-over flag).
- **Formats in MVP:** PDF and images (JPG/PNG via OCR). DOCX/PPTX → R2 (convert to PDF server-side) [D].

## 4. Retrieval and answer generation (tutor)

1. **Identity & membership** — user JWT; institute from host; RLS enforces membership (never a prompt).
2. **Scope** — subject from the page (R1.1: the topic, ADR-038). The ExamEdge library was removed in R1.1 (ADR-037).
3. **Retrieve institute material** — `match_chunks(query_embedding, query_text, subject_id, k=30)`:
   readable published documents for the student's batches → exact cosine top-30 + keyword (OR of the question's content words, English stop words dropped — `private.keyword_query`, ADR-027) top-30 → reciprocal rank fusion.
4. **Rerank** — top-8 [R]. Keep rerank only if eval recall@8 improves ≥ 5 points.
5. **Generate** — system prompt (versioned) states: answer for exam level X; prefer institute material for "what was taught";
   label each paragraph; say when material is missing; flag disagreements. Passages sent as `search_result` blocks:
   `source = "inst:{document_id}#p{page}"`, `title = "Your notes: {title}, p.{n}"` (prompt `tutor-v3`).
6. **Citations** — Claude returns citations on text blocks [V]. Paragraphs with institute citations → "From your institute's notes";
   **uncited text → "General explanation"** (deterministic, not model-claimed).
7. **Missing evidence** — no passage above a relevance threshold → answer marked "General explanation — not found in your institute's material".
8. **Contradictions** — model is asked to state conflicts explicitly; the answer shows both sources; message flagged into a teacher review queue. Detection is model-judged and **not guaranteed** (residual risk).
9. **Escalation** — Sonnet 5.5 when the student taps "Solve step by step" or a heuristic detects a numerical/derivation question, within the premium quota.
10. **Prompt size cap** — history trimmed to last 6 turns + passages ≤ ~8K tokens [R].

**When institute notes are missing/outdated/incorrect:** missing → general (labelled). Outdated/incorrect → student "report" button → teacher queue;
teacher can withdraw or replace the document.

**Evaluation (must exist before students use the tutor):**
- Golden set per pilot subject: 100 questions (80 from institute notes, 20 out-of-scope) with expected source pages.
- Metrics: retrieval recall@8, citation support rate (LLM judge + 20 % human sample), answer correctness (human-graded sample of 30),
  label accuracy, refusal rate, p50/p95 latency, cost per answer.
- Runs on every change to prompts, models, chunker, or retrieval; results committed under `evals/results/`.
- Pass bar for Phase 6 gate: see IMPLEMENTATION_ROADMAP Phase 6.

## 5. Feature matrix

Latency figures are **[E]** until measured. "Reuse" = can a result be cached and served to others. "Approval" = teacher approval before students see it.

| Feature | Inputs | Pipeline | Model/service | Output | Validation | Storage | Latency | Cost driver | Failure/retry | Reuse | Approval | Release |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| AI tutor (grounded answers) | question, subject, history | §4 | Haiku → Sonnet | streamed Markdown + citations | citations map to readable sources; labels deterministic | messages | first token 1–3 s | input tokens × volume; Sonnet share | 1 retry; partial stream marked incomplete | No (personal) | No | R1 |
| Summary / study guide | chapter docs | map-reduce over chunks | Sonnet (batch for institute) | JSON sections + citations | schema; every section cites ≥ 1 source | generated_artifacts | 20–60 s async | doc length | job retry ×3 | Yes per institute+input_hash | Yes (institute scope); student scope no | R1 |
| MCQ single/multi | chapter scope, count, difficulty | generate → dual-solve → flag | Opus generate, Sonnet blind solve | questions + keys JSON | schema (4 options, unique, key count rules); dual-solve agreement; KaTeX parse | questions/question_keys | 30–90 s async | Opus output tokens | retry; disagreements → teacher | Yes (question bank) | **Yes for tests** | R1 |
| Numerical | same | generate → dual-solve compare within tolerance + unit check | Opus + Sonnet | value, unit, tolerance | numeric agreement; unit present; tolerance > 0 | same | 30–90 s | same | same | Yes | **Yes** | R1 |
| Written (theory) answer grading | question, teacher's model answer, student answer | **R1: teacher checks manually, no AI**; R2: optional AI-suggested marks | none (R1) / Sonnet (R2) | marks + comment | 0 ≤ marks ≤ max; release blocked until all marked | attempt_answers | teacher time | none in R1 | — | No | **Teacher decides marks** | R1 manual, R2 AI help |
| Flashcards | chapter/doc | extract key facts with citations | Haiku | cards JSON | schema; each card cites a chunk that exists | generated_artifacts | 10–20 s | small | retry | Yes | Institute scope yes | R1 |
| Practice quiz (student) | chapter, weak topics | generate from passages | Haiku | quiz JSON + keys (keys stored server-side) | schema; KaTeX | generated_artifacts + practice_attempts | 10–30 s | small × volume | retry | Partly (dedupe same input) | No (labelled "AI practice, unverified") | R1 |
| Mind map | chapter | outline extraction | Haiku | tree JSON (depth ≤ 4, ≤ 60 nodes) | schema + limits | generated_artifacts | 10–20 s | small | retry | Yes | Institute scope yes | R1 |
| Table / report | scope + template | structured extraction | Sonnet | JSON table / Markdown report | schema; citations | generated_artifacts | 20–60 s | moderate | retry | Yes | Institute scope yes | R2 |
| Slide deck | chapter | outline → slide JSON → HTML render → PDF/PPTX | Sonnet + headless Chromium + pptxgenjs [U] | PDF/PPTX | schema; render check | storage | 1–3 min | render compute | retry render | Yes | Yes | R3 |
| Infographic | topic | template fill → SVG/HTML → PNG | Sonnet + Chromium | PNG/SVG | text exact; fonts for Indic scripts | storage | 30–90 s | render | retry | Yes | Yes | R3 |
| Audio overview | chapter, language | 2-host script → per-line TTS → concat | Sonnet + Sarvam Bulbul v3 + ffmpeg | MP3 | script schema; per-chunk ≤ 2,500 chars [V]; duration sanity | storage | 2–5 min | TTS chars | per-line retry | **Yes, per institute+language** | Yes (institute), library reviewed | R2 |
| Animated video | chapter/topic, language | scene script → TTS → timing → Remotion/Manim render → MP4 | Sonnet + Sarvam + Remotion/Manim | MP4 + captions | scene schema; LaTeX compile; audio/visual sync; human review of first N | storage + CDN | 5–20 min async | bandwidth (egress) more than generation | per-scene retry | **Yes** | **Yes** | R3 |
| Recommendations | topic accuracy stats | rules first (weakest 3 chapters) → optional LLM phrasing | rules + Haiku | list of next actions | deterministic core | topic_mastery | < 1 s | negligible | — | No | No | R2 |
| Test generation | blueprint (chapters × counts × difficulty) | select from approved bank; fill gaps via MCQ pipeline | Opus for gaps | test draft | blueprint satisfied; all keys verified | tests | 1–3 min | gaps only | — | — | **Yes** | R1 |
| Test grading | answers + keys | deterministic | none | scores, ranks | unit tests; regrade tool | attempts | seconds | none | job retry | — | Release time set by teacher | R1 |
| Learning analytics | attempts, practice, events | SQL aggregates | none | dashboards | aggregate-only for staff | views (security_invoker) | < 1 s | DB | — | — | — | R1 (basic), R2 (full) |

**Not assumed correct because it fits a schema:** every AI-authored question used in an institute test needs teacher approval;
dual-solve disagreement blocks approval until the teacher resolves it.

## 6. Subject-specific validation

- **Formulas:** all LaTeX compiled with KaTeX on the server before saving; failures → regenerate once → else flag.
- **Numerical answers:** two independent solutions (Opus author, Sonnet blind solver) must agree within tolerance; units must match a unit whitelist per chapter [R].
- **Marking schemes:** marks/negatives validated against the test's marking config; sum of marks displayed to teacher before scheduling.
- **Scientific diagrams (R3):** generated only from code (Manim/SVG), never from image models, so labels and values are exact; reviewer checks first renders.
- **Chemistry/biology hazards:** some questions may trigger provider safety refusals; handled as refusal UX, not errors.

## 7. Audio and video (R2/R3) — decision summary

Code-driven rendering (Remotion/Manim) is chosen over generative video models: formulas and labels are exact, renders are
reproducible from the scene JSON, and per-video generation cost is low; generative video models cannot be relied on for
correct text/equations. **Main cost risk is video bandwidth, not generation** (COST_MODEL §5). Remotion licence cost must be
confirmed before R3 (Q-09). Sarvam is single-speaker per request [V] → a two-host overview alternates speakers per line and
concatenates with ffmpeg. Font packs (Noto for all Indic scripts) are installed in the render container.
