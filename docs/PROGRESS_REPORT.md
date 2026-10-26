# Week 1: ExamEdge AI Progress Report

**Reporting period:** 16 October 2026 to 19 October 2026 (4 days of work, dates from the git history)
**Project:** ExamEdge AI, a multi-institute AI learning platform for coaching institutes
**Current stage:** Pilot features built and tested in demo mode. Live launch is waiting on the legal opinion and the production setup.

## 1. Summary

In four days, about 29 pull requests (#11 to #39) were built, tested and merged into `main`. Each change was tested before merging. The work covered the platform admin, teacher tools, student tools, AI features and daily operations.

The build was done with AI-assisted coding in small steps. Each step was tested before the next one started.

## 2. Work completed

**Platform admin**
- Delete an institute created by mistake, with a confirmation step
- Send a new owner invitation when an institute has no owner
- Institute list refreshes without a page reload
- Invitations by email, and Google sign-in

**Teachers and staff**
- Subjects live inside batches
- Subject, then topic, then subtopic structure, with "Smart Study" per topic
- Teacher notes publish themselves to the batch once they are read
- Batch history
- Contest page for students, and a batch switcher
- AI usage page shown as a bill in rupees per institute
- Exam-lock (CBT) mode for tests: full screen, warnings, then automatic submit
- AI questions open in a dropdown and can be approved on the test page
- Student reviews, readable only by the owner and admins

**Students**
- Result shown right after submitting a test
- Smart Study tiles for each topic
- "Making your…" progress message on every AI button
- Students can make a study tool again until the AI limit is reached
- Beta labels on audio and video overviews

**AI and content**
- AI-made bank questions, with a second solve to check the answer
- Formulas displayed correctly (KaTeX), with a check for broken formulas
- Negative marks on typed questions, plus an optional model answer
- Test-only Gemini provider, for trying AI without paid keys
- Scanned pages and photos are read with OCR

**Operations and safety**
- Daily clean-up of unreachable files
- Tests for tenant isolation (each institute's data stays separate)
- Security checks: no secrets in code, and no secrets in the browser bundle

**Design**
- New layout and colours, applied across the app

## 3. Testing and quality

| Check | Result | Where it ran |
|---|---|---|
| Unit tests | 189 passing | Local, 19 Oct |
| Database tests (pgTAP) | 1,459 passing | Local, 19 Oct |
| Browser end-to-end tests | Passing before each merge | CI (not run on the local machine) |
| Format, lint, type checks, production build | Passing | Local, 19 Oct |

## 4. Checked by the founder

- Student Smart Study tiles, "Making your…" progress and Beta labels were checked in the browser on 19 Oct.

## 5. Not done yet

- Legal opinion on the data of minors (required before real student data)
- Confirmation of data terms from the embeddings provider (required before real institute documents are sent)
- Production setup: Supabase, Vercel and Railway accounts, domain, and live settings
- Backup restore test, load test and rollback test
- Testing with real institutes and real users

## 6. Next steps

1. Get the legal opinion and the data terms confirmed.
2. Buy the domain and set up the production accounts.
3. Run the restore test, load test and rollback test.
4. Start a pilot with one institute and a small group of students, then review the first week's AI cost.
