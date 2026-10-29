# ExamEdge AI — The Plan, Explained Simply

For anyone: friends, advisors, possible partners. No technical background needed.
The detailed technical plan is in `docs/PROJECT_MASTER_PLAN.md` and the files it links to.
Status: idea and plan ready (October 2026). Nothing is built yet.

---

## The idea in one line
A private AI study platform that coaching institutes give to their students. Each institute gets its own branded portal
where teachers upload notes and run tests, and every student gets an AI tutor for each subject.

## The problem
- Coaching students have doubts all day, but teachers can't answer everyone at once.
- Notes, PDFs and tests are scattered across WhatsApp groups, printouts and different apps.
- Tools like NotebookLM are powerful, but every student must upload their own material first, and the institute has no
  control over it and no view of how students are doing.

## The solution
ExamEdge has three levels:

```
                 ExamEdge (the main platform)
                           │
   ┌───────────────┬───────┴───────┬───────────────┐
 Institute A     Institute B     Institute C      …more
 (own portal)    (own portal)    (own portal)
   │                │                │
 its students     its students     its students
```

**1. ExamEdge (us).** We run the platform, add new institutes, keep the AI running and maintain a shared,
expert-checked study library (for example JEE → Physics → Rotational Motion → Torque).

**2. Each coaching institute** gets its own web address (like `yourinstitute.examedge.ai`) with its own logo. Teachers can:
- upload notes and PDFs, which appear under the right subject for the right batch of students
- create tests mixing MCQs, numerical and theory questions; MCQs are marked automatically and teachers check theory answers themselves
- see two ranks: a rank for each test and an overall rank across all the institute's tests
- click any student's name to see their full progress: marks, ranks, weak chapters, practice and activity
- let the AI draft quizzes, summaries and flashcards, then check and approve them before students see them

**3. Each student** logs in with Google and sees their subjects. Inside each subject:
- all the notes the institute uploaded
- an **AI tutor for that subject** to ask doubts any time
- a Studio to make their own practice quizzes, flashcards, summaries and mind maps (later: audio lessons in Hindi and
  other Indian languages, and animated video explanations)
- their test results, rank and progress

## What makes it different from NotebookLM
- **No uploading needed by the student.** The AI already knows the syllabus topics through our shared library and its
  general knowledge.
- **The institute's own notes come first.** When the AI answers, it shows where the answer came from:
  "From your institute's notes, page 4", "From the ExamEdge library" or "General explanation".
- **Built for coaching:** batches, scheduled tests, ranks, teacher approval and progress tracking, which NotebookLM doesn't have.

## How each institute's data stays private
- All institutes share one system, but every piece of data is stamped with its institute, and the database itself blocks
  anyone who isn't a member of that institute. A mistake in a web page cannot show the data.
- Logging in with Google proves who you are, but you only get into an institute after the institute invites you.
- Test answers are stored separately and students can never see them before results are released.
- Automatic tests try to break into another institute's data before every update. If any test succeeds, the update is blocked.

## Which tools it uses (and why)

| Need | Tool | Why |
|---|---|---|
| Website for institutes and students | Next.js, hosted on Vercel | One app serves all three levels |
| Database, Google login, file storage | Supabase (servers in Mumbai) | One service with the privacy rules built in |
| Background work (reading PDFs, making quizzes) | A small worker server on Render | Long jobs don't slow down the website |
| AI that answers and creates content | Claude (Anthropic): a fast, cheap model for most doubts, a stronger model for hard problems, the strongest model for writing tests and library content | Good quality, can point to its sources, clear prices |
| Search inside notes | Voyage AI | Finds the right paragraph for each question |
| Indian-language voices (later) | Sarvam AI | Natural voices in 11 Indian languages |
| Animated videos (later) | Remotion and Manim (code-drawn animation) | Formulas and diagrams come out exactly right, unlike AI video generators |
| Payments (later) | Razorpay | UPI AutoPay, cards, mandates |

## What it costs to run (estimates)

| Size | Monthly running cost | Cost per student per month |
|---|---|---|
| 3 institutes × 500 students | about ₹62,000 | about ₹41 |
| 10 institutes × 1,000 students | about ₹3.45 lakh | about ₹35 |
| 100 institutes × 1,000 students | about ₹34 lakh | about ₹34 |

These assume 60% of students are active and each asks about 4 AI doubts a day. Most of the cost is AI usage.
Every institute gets usage limits so costs can't run away.

**Price idea (not yet tested with real institutes):** around ₹99 per student per month, with a lower pilot price.
That would leave roughly 65% margin. Talking to coaching institutes comes first.

## The plan, step by step

**Release 1 — Pilot with 2–3 coaching institutes**
1. Set up the project and automatic quality and security checks.
2. Logins, institutes, batches, invitations and data privacy, fully tested.
3. Institute and student portals.
4. Note and PDF uploads, including scanned notes.
5. Usage limits and cost tracking.
6. AI tutor with sources.
7. Tests (MCQ, numerical, theory), automatic MCQ marking, teacher checking of theory answers, test rank and overall rank, student progress page.
8. Shared ExamEdge library for one exam and subject (for example JEE Physics).
9. Practice quizzes, flashcards, summaries and mind maps.
10. Security, backups and a legal check, then launch to the pilot institutes.

**Release 2 — after pilot feedback:** AI-suggested marks to speed up theory checking, practice suggestions, audio lessons
in Hindi and English, online payments.

**Release 3:** slides, infographics, animated videos, more languages and exams, and separate private servers for very large institutes.

## What still needs to be figured out
- **Legal:** most students are under 18. India's data protection law (DPDP) has special rules for children's data and for
  tracking them. A lawyer must confirm what's allowed before real student data goes in.
- **Do institutes want it, and at what price?** This needs conversations with coaching centres.
- **Which exam and subject to start with** (JEE, NEET, boards or UPSC).
- **Should teachers be able to read students' AI chats,** or only see summaries? (Default for now: summaries only.)
- **Quality of Hindi and other Indian-language answers** needs testing.

## Next steps
1. Talk to coaching centres and find 2–3 pilot partners.
2. Get a short legal opinion on student data.
3. Start building Release 1.

## Words used in this document
- **Portal:** the website a user logs into.
- **Batch:** a group of students studying together (for example "JEE 2027 Morning").
- **AI tutor:** a chatbot that answers study doubts.
- **Pilot:** a first trial with a few real institutes before a wider launch.
- **Library:** ExamEdge's own expert-checked study content, shared with every institute.
