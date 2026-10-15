# ExamEdge AI — Original Brief (what the founder asked for)

Saved: 2026-10-14. This is the founder's own requirements, collected from the planning conversation and organised so anyone
can read them. Wording is cleaned up but nothing is added. Where the plan changed or questioned something, that is noted at the end.

Source images (kept in `docs/assets/`):
- `original-architecture-sketch.jpg` — the hand-drawn structure. **The top of the photo has unrelated personal notes; crop it before sharing.**
- `notebooklm-studio-reference.png` — screenshot of NotebookLM's Studio panel, used as a feature reference.

---

## 1. The idea in one line
An AI learning platform for coaching institutes, like NotebookLM, but personalised for each coaching institute and its students.

## 2. The structure (from the hand-drawn sketch)

```
                    Main server (parent)
                           │
     ┌──────────┬──────────┼──────────┬──────────┐
 Coaching 1  Coaching 2  Coaching 3  Coaching 4  Coaching 5      ← child
     │          │          │          │          │
 S1 S2 S3…   S1 S2 S3…   S1 S2 S3…   S1 S2 S3…   S1 S2 S3…      ← sub-child (students)
```
- One main server connected to many coaching institutes.
- Each coaching institute has its own separate environment and its own students.
- One institute's data must never leak to, or interfere with, another institute.

## 3. What the coaching institute's portal must do
1. Upload notes, PDFs, documents and other study material, so they appear inside each student's portal under the right subject.
2. Create quizzes and tests: MCQs, written answers ("answer the question") and other question types.
3. Manage content for its students from its own dashboard.
4. Track each student's activity on their personal AI portal: are they making quizzes for themselves, how much did they score —
   "basically track the whole thing that the students are doing".
5. A **rank system**: students are ranked on the basis of the quizzes/tests **conducted by the coaching institute**.

## 4. What the student portal must look like
1. Students log in with **Google**.
2. Home page shows **all their subjects**.
3. Inside each subject: everything the institute uploaded for that subject **plus** a NotebookLM-like layout with an **AI chatbot for that specific subject**.
4. Personalised AI learning features: animated videos, quizzes, summaries and everything else NotebookLM can do.

## 5. The key difference from NotebookLM
In NotebookLM you must upload notes or sources before you can use it. **ExamEdge should not work like that.**
The AI should already know everything related to the topic automatically, without the student uploading anything.

## 6. Studio features wanted (from the NotebookLM screenshot)
- **Audio overview** in Indian languages: Hindi, Bengali, Gujarati, Kannada, Malayalam, Marathi, Punjabi, Tamil, Telugu.
- **Video overview** (animated educational videos).
- Slide deck · Mind map · Reports · Flashcards · Quiz · Infographic · Data table.

## 7. Questions the founder wanted answered
- The best architecture for this, explained simply.
- How to prevent data leakage or interference between coaching institutes.
- What technologies and services are needed.
- How to build the complete system step by step.
- Which APIs and API keys are needed, how many, and how to manage them securely.
- How the main server, the institutes and the student portals communicate and work together.
- Which AI to use for each feature, especially animated video generation.

## 8. The planning brief (summary of the founder's detailed instructions)
The founder then asked for a production-grade master plan, written like a principal engineer would, with these rules:
- **Investigate first:** inspect the real project folder; preserve existing work; never print secrets.
- **Challenge the 4-level design:** compare shared database, separate databases for some institutes, fully dedicated
  infrastructure, and a hybrid; recommend the best for a solo founder; explain "logical environment" vs "separate server".
- **Cover:** authentication, tenant resolution, database / file / vector-search isolation, background jobs, AI calls,
  audio/video rendering, caching, rate limits, billing and metering, logging, migrations, backups, disaster recovery, enterprise customers.
- **Verify technology choices** against official docs and current pricing; never invent model names, prices or capabilities;
  label facts, recommendations, estimates and assumptions separately.
- **Design the data model first:** every table with purpose, keys, indexes, deletion rules, ownership and access.
- **Threat-model security:** students reading other students' or other institutes' data, teachers reaching other batches,
  forged institute IDs, cache and vector-search leaks, signed file links, background jobs under the wrong institute,
  prompt injection in uploaded documents, leaked API keys, AI cost abuse, fake payment webhooks, answer-key leaks,
  admin abuse, backups and deletion, supply-chain attacks. Google login must **not** automatically give access to an institute.
- **Two knowledge layers:** a shared ExamEdge library (Exam → Subject → Chapter → Topic, e.g. JEE → Physics → Rotational
  Motion → Torque) and each institute's private content, which is never copied into the shared library.
- **Feature-by-feature pipeline** for tutor, summaries, every question type, flashcards, mind maps, tables, slides,
  infographics, audio, video, recommendations, test generation and grading, analytics.
- **Costs** for 3 institutes × 500 students, 10 × 1,000 and 100 × 1,000, with formulas and verified prices.
- **Privacy and law** for minors and Indian users (DPDP), flagged for professional review.
- **A dependency-ordered roadmap** with acceptance criteria and a strict quality gate for every phase.
- **Planning documents** in the repository, a skeptical self-review, and a clear go/no-go. No application code until approved.

---

## 9. Where the plan differs from or questions the brief
| Brief | Plan's position | Why |
|---|---|---|
| "Separate environment" for each institute | Logical separation in one shared system, with a path to a separate database for big customers later | Same privacy guarantee enforced by the database, far lower cost for a solo founder (DECISIONS ADR-001) |
| Track "the whole thing" students do | Track learning activity, but teachers see summaries rather than students' private AI chats by default; legal check required | Most students are minors; India's DPDP rules restrict tracking children (RISKS Q-01, Q-03) |
| AI "knows everything automatically" | Yes, via a reviewed ExamEdge library plus the AI's general knowledge, clearly labelled, with the institute's own notes shown first | Avoids wrong or unverifiable answers |
| Everything NotebookLM can do, including video | Built in stages: tutor, quizzes, tests and ranks first; audio next; slides, infographics and video last | Video is the costliest and least proven feature |
| Animated videos | Code-drawn animation (Remotion/Manim) with narration, not AI video generators | Formulas and labels must be exactly right |
