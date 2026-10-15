# How ExamEdge Works — Student and Teacher Walkthrough

Plain-language walkthrough of the planned website (Release 1 unless marked "later"). Nothing is built yet.

## The people
| Person | Who | Logs in at |
|---|---|---|
| **Platform owner** | You (ExamEdge) | `admin.examedge.ai` |
| **Institute owner / admin** | Coaching centre head or office staff | `theirname.examedge.ai` |
| **Teacher** | Faculty of that coaching centre | same address |
| **Student** | Enrolled student | same address |

---

## Part 1 — An institute joins

1. You create the institute in your admin area, for example "Sharma Classes" with the address `sharma.examedge.ai`, its logo, and its usage limits.
2. The owner gets an invitation email, logs in with Google, and is now the owner.
3. The owner sets up the institute:
   - **Batches**: "JEE 2027 Morning", "NEET 2027 Evening"
   - **Subjects** per batch: Physics, Chemistry, Maths, and **chapters** inside each subject
   - **Teachers**: invited by email and assigned to batches
   - **Students**: invited by email, one at a time or by uploading an Excel/CSV list, and placed into batches
4. Each person gets an email with a join link. They log in with Google, and **the Google email must match the invited email**. Otherwise they can't get in. A stranger who logs in with Google sees nothing.

---

## Part 2 — Teacher side

### A. Uploading notes
1. Open **Physics → Rotational Motion → Upload**. Choose the PDF or photos of notes and pick which batches can see it.
2. The file uploads, and the status shows **"Processing"** for a few minutes. In the background:
   - the text is read from the PDF; scanned or handwritten pages are read by Claude (OCR)
   - the notes are split into small paragraphs, keeping page numbers
   - Voyage gives each paragraph a "meaning code" so it can be found later
3. Status changes to **"Ready"**. The teacher previews it and clicks **Publish**.
4. Students in the chosen batches now see it under Physics, and the AI tutor can use it.
5. If something is wrong, the teacher clicks **Withdraw** and students lose access immediately. Uploading a new version replaces the old one.

### B. Letting the AI make study material
1. On a chapter, click **Generate → Summary / Flashcards / Mind map / Quiz**.
2. The AI writes a **draft** from that chapter's notes.
3. The teacher reads it, edits if needed, and clicks **Approve**. Only then do students see it.
4. A summary is made once and shared with every student. It isn't regenerated for each student, which saves cost.

### C. Creating a test
1. **Question bank**: the teacher types questions or asks the AI for "20 MCQs from Rotational Motion, medium level".
   - Question types: single-correct MCQ, multi-correct MCQ, numerical answer, and **theory (written) questions** where the student types the answer. One test can mix them, for example 10 MCQs and 5 theory questions.
   - For a theory question the teacher writes a model answer. It's only a guide for checking, never used to mark automatically.
   - Every AI-made question is **solved a second time by a different AI model**. If the two answers don't match, the question is flagged and the teacher must fix it.
2. **Build the test**: pick questions and set the marks, negative marking, duration (e.g. 60 minutes), start and end time, which batches take it, and when results are released.
3. Click **Schedule**. Students see "Upcoming test" on their home page.

### D. During and after the test
- The test opens at the start time. Each student's timer is controlled by the server, so changing the phone clock doesn't help.
- After the deadline, answers can't be saved.
- **MCQs and numerical questions are marked automatically**, including negative marks and numerical answers within an allowed range.
- **Theory answers are checked by the teacher.** The test shows "Waiting for checking". The teacher opens **Check answers**:
  - one theory question at a time, going through every student's answer
  - the screen shows the question, the teacher's model answer and the student's typed answer
  - the teacher types marks (half marks allowed) and an optional comment; student names can be hidden while checking for fairness
  - a progress bar shows "34 of 180 checked"
- Results can't be released until every theory answer is checked.
- The teacher clicks **Release results**. Each student's total = automatic MCQ marks + teacher's theory marks. Then:
  - the **test rank** is calculated (equal totals are broken by who finished faster)
  - the **overall rank** is updated (average percentage across all the institute's tests in that batch; a missed test counts as 0%)
  - students see their marks, correct answers, explanations and the teacher's comments
- If marks need changing later (wrong key or a re-check), the teacher edits them and both ranks recalculate automatically. Every change is recorded.
- Practice quizzes that students make for themselves **never** affect rank.

### E. Tracking students
**Batch view:** a list of all students with overall rank, average percentage, last test score, tests missed and last active date, sortable and exportable to Excel.

**Click a student's name → their full progress page:**
1. **Summary:** overall rank, average percentage, tests taken and missed, last active
2. **Institute tests:** every test with marks (MCQ part and theory part separately), test rank, batch average, highest score, time taken, and the teacher's comments on theory answers
3. **Trend:** graph of marks and rank over time (improving or falling)
4. **Chapter strength:** accuracy per chapter from tests and practice, so strong and weak chapters are visible
5. **Question-type accuracy:** MCQ vs numerical vs theory, plus marks lost to negative marking (shows guessing)
6. **Self practice:** practice quizzes made, which chapters, scores, how often
7. **Study activity:** days active per week, notes opened, flashcards reviewed, doubts asked per subject and chapter (count and topic)
8. **Comparison with batch average** in each subject

Students see **the same page** for themselves under "My progress".

What teachers **don't** see by default: the actual text of a student's private AI chats, or minute-by-minute activity. Most students are minors, so a lawyer must confirm how much tracking is allowed (India's DPDP law).

### F. Who sees what (staff)
- **Owner/admin:** everything in their institute.
- **Teacher:** all of the institute's notes, but student results only for **their own batches**.
- **Nobody** in one institute can ever see another institute's anything.

---

## Part 3 — Student side

### A. First login
Click the invitation email → **Continue with Google** → land on the institute's home page, with its logo.

### B. Home page
```
┌──────────────────────────────────────────────┐
│  Sharma Classes                    Riya ▾    │
├──────────────────────────────────────────────┤
│  Upcoming: Physics Test 3 · Sat 10:00 AM     │
│  Last test rank: 12 of 180                   │
│                                              │
│  [ Physics ]   [ Chemistry ]   [ Maths ]     │
└──────────────────────────────────────────────┘
```

### C. Inside a subject (NotebookLM-style, three panels)
```
┌───────────────┬───────────────────────────┬──────────────────┐
│ SOURCES       │ AI TUTOR (Physics only)   │ STUDIO           │
│ Your notes    │ You: Torque kya hota hai? │ Practice quiz    │
│ • Rotation.pdf│ AI: Torque is the turning │ Flashcards       │
│ • Laws.pdf    │ effect of a force...      │ Summary          │
│ ExamEdge      │ [From your notes, p.4]    │ Mind map         │
│ library       │ [ExamEdge library]        │ Audio (later)    │
│ • by chapter  │                           │ Video (later)    │
└───────────────┴───────────────────────────┴──────────────────┘
```
On a phone, the three panels become three tabs.

### D. Asking a doubt: what happens in about 2 seconds
1. The student types a question in the Physics tutor.
2. The system checks they are a real member of this institute and have AI usage left today.
3. **Voyage** finds the 5–8 most relevant paragraphs from the institute's Physics notes (only notes published to the student's batch) and from the ExamEdge library.
4. **Claude** reads those paragraphs and writes the answer.
5. Each part of the answer is labelled:
   - **"From your institute's notes, page 4"**, which can be clicked to open that page
   - **"From the ExamEdge library"**
   - **"General explanation"**, when it isn't in any notes
6. If the doubt is hard (a numerical or derivation), the student taps **"Solve step by step"** and a stronger AI model answers. There are a few of these per day.
7. If an answer looks wrong, the student taps **Report** and the teacher gets it for review.

The student never uploads anything. The AI already has the institute's notes and the library.

### E. Studio (self-practice)
- **Practice quiz**: pick a chapter, get 10 questions, see the score immediately. These quizzes don't affect rank; they count as practice.
- **Flashcards**, **summary**, **mind map**: made instantly from the chapter.
- Later: **audio lessons** in Hindi and other languages, and **animated video** explanations.

### F. Taking an institute test
1. Click **Start** when the test opens. The timer starts.
2. MCQs are clicked, numerical answers typed as numbers, and theory answers typed in a text box. Every answer saves automatically. If the internet drops, the student reconnects and continues within the same time limit.
3. Click **Submit**, or the test auto-submits at the deadline.
4. Results appear after the teacher has checked the theory answers and released them: marks per question, teacher comments, **test rank** and updated **overall rank**.

### G. My progress
The same full progress page teachers see (Part 2E): ranks, marks trend, chapter strengths, practice history. Suggested chapters to practise next come later.

### H. Limits
Each student has a daily AI limit (for example 40 doubts a day). When it's reached: "You've used today's AI limit. It resets tomorrow." This keeps costs safe.

---

## Part 4 — Your side (platform owner)
- Add new institutes, set their web address, logo and limits.
- See each institute's AI usage and cost.
- Write and review the **ExamEdge library** (Exam → Subject → Chapter → Topic). Content is AI-drafted, checked by a subject expert, then published to all institutes.
- Emergency switch to turn AI off if costs spike.
- You **can't** casually open an institute's private data. Support access needs a special, time-limited session that is recorded and shown to the institute owner.

---

## Part 5 — Behind the scenes (simple version)
- **Website:** one website serves every institute. The web address tells it which institute you're in.
- **Database (Supabase):** stores everything. Each row is stamped with its institute, and the database blocks non-members. This is the privacy wall.
- **Worker:** a background helper that reads PDFs, makes quizzes, grades tests and sends emails, so the website stays fast.
- **Claude:** writes answers, quizzes and summaries, and reads scanned notes.
- **Voyage:** finds the right paragraphs.
- **Usage meter:** every AI use is counted per institute and per student.

## What comes when
| Now (Release 1 pilot) | Later |
|---|---|
| Logins, batches, invitations · notes upload · AI tutor with sources · tests with MCQ, numerical and theory questions · teacher checking of theory answers · test rank + overall rank · student progress page · practice quizzes, flashcards, summaries, mind maps · library for one subject | AI-suggested marks to speed up theory checking · practice suggestions · audio lessons · online payment · slides, infographics, animated videos · more languages and exams |
