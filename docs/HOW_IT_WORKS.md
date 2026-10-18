# How ExamEdge Works — Student and Teacher Walkthrough

Plain-language walkthrough of the website (Release 1 unless marked "later"). **Release 1.1** (founder change list,
2026-10-17, ADR-037–041) changed the structure: subjects live inside a batch, notes live in Subject → Topic →
Subtopic, teachers' AI is AI notes + AI test, students get a batch switcher and a Contest page, and the ExamEdge
library is gone.

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
   - **Subjects inside each batch**: while creating or editing "Class 10", the owner types its subjects (Science,
     Maths, Social Studies) right there. A subject belongs to one batch; next year's "Class 10" gets its own subjects.
   - **Topics and subtopics** inside each subject (teachers add them): Maths → Probability → Conditional probability,
     Bayes theorem
   - **Teachers**: invited by email and assigned to batches
   - **Students**: invited by email, one at a time or by uploading an Excel/CSV list, and placed into batches
4. Each person gets an email with a join link. They log in with Google, and **the Google email must match the invited email**. Otherwise they can't get in. A stranger who logs in with Google sees nothing.

---

## Part 2 — Teacher side

### A. Uploading notes
1. Open **Physics → Rotational Motion (topic) → Torque (subtopic) → Upload notes**. Notes always go into a subtopic,
   never onto the topic itself. Teachers only see subjects of the batches they teach.
2. The file uploads, and the status shows **"Processing"** for a few minutes. In the background:
   - the text is read from the PDF; scanned or handwritten pages are read by Claude (OCR)
   - the notes are split into small paragraphs, keeping page numbers
   - Voyage gives each paragraph a "meaning code" so it can be found later
3. Status changes to **"Ready"** and the notes are **published to the subject's batch by themselves** — a teacher's
   own notes need no check (founder, R1.2, ADR-044). Only AI notes wait for the teacher to publish them (B below).
4. Students of that batch now see it under the topic, grouped by subtopic, and Smart Study can use it.
5. If something is wrong, the teacher clicks **Withdraw** and students lose access immediately. Uploading a new version replaces the old one.

### B. AI notes (inside a subtopic)
1. In a subtopic, click **Write notes with AI** and explain the subtopic in your own words (typed).
2. The AI writes detailed notes from that explanation.
3. The notes open on their document page: the teacher reads them, edits them under **Edit notes** (each Save is a
   new version; students keep the previous one until the new one is processed), then clicks **Publish**. Students of the batch see them like
   uploaded notes (an in-app notes page with **Download as PDF**), and Smart Study can use them.
4. Teachers no longer have the AI tutor or Studio (summary, flashcards, mind map, quiz); those are for students.

### C. Creating a test
1. **Tests → New test** (R1.2, ADR-042): pick the **subject** (listed under its batch, so this also picks the batch),
   a title, the date and time it opens and closes, and the duration. This makes a draft test; its page offers two
   ways to fill it:
   - **With AI**: write what you want in the box, e.g. "10 MCQs + 5 theory questions on Networking and HTML, medium".
     The AI finds those topics in the subject and makes the questions from each topic's published notes (MCQ 4 marks,
     theory 5 marks by default). Send another request to add more.
   - **Manual**: type a question right there (MCQ: question, options A–D, tick the correct one; numerical: answer and
     allowed error; theory: the question, and a model answer only if the teacher wants one), with its topic, its marks
     for a correct answer and, for MCQ/numerical, negative marks for a wrong answer.
   Every question made here is also saved in the **Question bank** (list, edit, approve), and questions can still be
   added from the bank. Opening a question from the test and saving it brings the teacher back to the test.
   - Question types: single-correct MCQ, multi-correct MCQ, numerical answer, and **theory (written) questions** where the student types the answer. One test can mix them, for example 10 MCQs and 5 theory questions.
   - For a theory question the teacher writes a model answer. It's only a guide for checking, never used to mark automatically.
   - Every AI-made MCQ or numerical question is **solved a second time by a different AI model**. If the two answers don't match, the question is flagged and the teacher must fix it. AI theory questions come with a model answer; the teacher checks and saves each one.
2. **Build the test**: pick questions and set the marks, negative marking, duration (e.g. 60 minutes), start and end time, which batches take it, and when results are released.
3. Click **Schedule**. Students see "Upcoming test" on their home page.

### D. During and after the test
- The test opens at the start time. Each student's timer is controlled by the server, so changing the phone clock doesn't help.
- After the deadline, answers can't be saved.
- **MCQs and numerical questions are marked automatically**, including negative marks and numerical answers within an allowed range.
  Multiple-correct MCQs are marked like JEE Advanced (founder, ADR-045): all correct options = full marks (+4); only
  correct options but not all = +1 each (a quarter of the marks); any wrong option = the negative marks (e.g. −2).
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
4. **Topic strength:** accuracy per topic from tests and practice, so strong and weak topics are visible
5. **Question-type accuracy:** MCQ vs numerical vs theory, plus marks lost to negative marking (shows guessing)
6. **Self practice:** practice quizzes made, which topics, scores, how often
7. **Study activity:** days active per week, notes opened, flashcards reviewed, doubts asked per subject and topic (count and topic)
8. **Comparison with batch average** in each subject

Students see **the same page** for themselves under "My progress".

What teachers **don't** see by default: the actual text of a student's private AI chats, or minute-by-minute activity. Most students are minors, so a lawyer must confirm how much tracking is allowed (India's DPDP law).

### F. Who sees what (staff)
- **Owner/admin:** everything in their institute.
- **Teacher:** all of the institute's notes, but student results only for **their own batches**.
- **Reviews** (sidebar, owner/admin only): what students wrote about the coaching, newest first, with the student's name and batch, or "Anonymous" and the batch if the student hid their name. Owner/admin can **reply** to each (and change or remove the reply). Teachers never see reviews. (ADR-047)
- **Nobody** in one institute can ever see another institute's anything.

---

## Part 3 — Student side

### A. First login
Click the invitation email → **Continue with Google** → land on the institute's home page, with its logo.

**Batch switcher** (like a semester dropdown): a student who was in "Class 9 2025" and is now in "Class 10 2026"
picks "Class 9 2025" and sees **their own time** there — notes, tests, results, progress and Smart Study — exactly
like the current batch, but no new tests can be taken. They never see what this year's Class 9 students get (that
is a different batch). Default = the current batch. Picking a batch in the dropdown switches at once and opens that batch's Home
(R1.2, ADR-043). The owner moves students up with **Move students to another
batch** on the batch page; the old batch stays in their history.

**Menu:** Home · **Contest** · My progress. Contest lists every test the institute held for the selected batch:
upcoming, live (Start), finished (waiting for results) and results (marks, rank). Practice quizzes are not there.

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

### C. Inside a subject → topic
A subject lists its topics. Clicking a topic opens the **topic page** with two tabs:
```
┌──────────────────────────────────────────────────────────────┐
│ Probability                      [ Subtopics ] [ Smart Study ]│
├──────────────────────────────────────────────────────────────┤
│ Conditional probability                                      │
│   • Class notes.pdf   • AI notes: Conditional probability    │
│ Bayes theorem                                                │
│   • Bayes worksheet.pdf                                      │
└──────────────────────────────────────────────────────────────┘
```
- **Subtopics:** every subtopic with all its notes (uploaded and AI notes).
- **Smart Study:** the AI for the whole topic — AI tutor, summary, flashcards, mind map and practice quiz. It picks
  the relevant subtopics itself from all the topic's notes (no subtopic picker).

### D. Asking a doubt: what happens in about 2 seconds
1. The student types a question in Smart Study on a topic (e.g. Probability).
2. The system checks they are a real member of this institute and have AI usage left today.
3. **Voyage** finds the 5–8 most relevant paragraphs from that topic's notes (only notes published to the student's batch).
4. **Claude** reads those paragraphs and writes the answer.
5. Each part of the answer is labelled:
   - **"From your institute's notes, page 4"**, which can be clicked to open that page
   - **"General explanation"**, when it isn't in any notes
6. If the doubt is hard (a numerical or derivation), the student taps **"Solve step by step"** and a stronger AI model answers. There are a few of these per day.
7. If an answer looks wrong, the student taps **Report** and the teacher gets it for review.

The student never uploads anything. The AI already has the institute's notes.

### E. Smart Study tools (self-practice, inside a topic)
The tools are tiles with icons, like NotebookLM's Studio: tap **Summary**, **Flashcards**, **Mind map** or **Practice
quiz** to make it. Below the tiles: what the student already made for this topic and what the teachers shared, to open
again (R1.2, ADR-043).
- **Practice quiz**: made from the topic's notes, 10 questions, see the score immediately. These quizzes don't affect rank; they count as practice.
- **Flashcards**, **summary**, **mind map**: made instantly from the topic's notes.
- Later: **audio lessons** in Hindi and other languages, and **animated video** explanations.

### F. Taking an institute test
1. Click **Start** when the test opens. The timer starts.
2. MCQs are clicked, numerical answers typed as numbers, and theory answers typed in a text box. Every answer saves automatically. If the internet drops, the student reconnects and continues within the same time limit.
3. Click **Submit**, or the test auto-submits at the deadline.
4. Right after submitting, the student sees their own marks so far and which questions they got right or wrong (with the marks for each). Theory answers show the student's own answer and, once a teacher has checked it, its marks. Correct answers appear once the test's closing time passes (not earlier, so nobody can pass them to classmates still writing). (ADR-046)
5. After the teacher releases results: final marks, teacher comments, model answers, **test rank** and updated **overall rank**.

### G. My progress
The same full progress page teachers see (Part 2E): ranks, marks trend, topic strengths, practice history. Suggested topics to practise next come later.

### H. Review
**Review** in the sidebar: the student writes what they like and what should be better (up to 2000 characters) and can tick **Hide my name**. Only the institute's owner and admins read it, never teachers. With the name hidden, the owner and admins see "Anonymous" and cannot find out who wrote it. Below the form, **Your reviews** lists all of the student's reviews (hidden-name ones marked "name hidden") with the institute's reply. (ADR-047)

### I. Limits
Each student has a daily AI limit (for example 40 doubts a day). When it's reached: "You've used today's AI limit. It resets tomorrow." This keeps costs safe.

---

## Part 4 — Your side (platform owner)
- Add new institutes, set their web address, logo and limits.
- See each institute's AI use this month in the "All institutes" table: tokens and real cost. Set one rate,
  "₹ per US$": each institute's owner and admins see a **Bill** page with only "This month's AI charge: ₹X" (AI cost ×
  rate). Later (formula not decided yet): a commission per institute on top.
- There is **no ExamEdge library** (removed in R1.1): ExamEdge shares no content with institutes.
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
| Logins, batches, invitations · notes upload · AI tutor with sources · tests with MCQ, numerical and theory questions · teacher checking of theory answers · test rank + overall rank · student progress page · practice quizzes, flashcards, summaries, mind maps · AI notes and AI tests for teachers · batch history · Contest page | AI-suggested marks to speed up theory checking · practice suggestions · audio lessons · online payment · slides, infographics, animated videos · more languages and exams |
