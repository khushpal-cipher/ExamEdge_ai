# ExamEdge AI — Progress

Last updated: 2026-10-25 (session 53: Batch B built — CR 1–2 + free pilot, PR #43 open, CI pending; billing spec waiting for the founder)

## Current phase
**Phase 1 MERGED** into `main` (PR #1, merge commit `913ec7f`, CI green: check + secrets, 2026-10-15).
**Phase 2 MERGED** into `main` (PR #2, merge commit `c106364`, CI green: unit 12, pgTAP 334, E2E 6, 2026-10-15).
**Phase 3 MERGED** into `main` (PR #3, squash commit `0417717`, CI green: check + secrets, run 38702576710, 2026-10-15).
**Phase 7 MERGED** into `main` (PR #4, squash commit `2a5f25e`, CI green: check + secrets, run 38711008739, 2026-10-15).
**Phase 4 MERGED** into `main` (PR #5, squash commit `cbfb62e`, CI green: check + secrets, run 38795802409, 2026-10-16).
**Phase 5 MERGED** into `main` (PR #6, squash commit `b1f0795`, CI green: check + secrets, run 38805190604, 2026-10-16).
**Phase 6 MERGED** into `main` (PR #7, squash commit `7863900`, CI green: check + secrets, run 38841699259 — unit 104, pgTAP 1064, integration 21, E2E 22/22 against the production build, 2026-10-16).
**Phase 8 MERGED** into `main` (PR #8, squash commit `bce1046`, CI green: check + secrets, run 38848935766 — unit 111, pgTAP 1107, integration 21, E2E 24/24 against the production build, 2026-10-16).
**Phase 9 MERGED** into `main` (PR #9, squash commit `67ed4ac`, CI green: check + secrets, run 38869056404 — pgTAP 1220, E2E 26/26 against the production build incl. T-SEC-05, 2026-10-16).
**New UI (ADR-056) MERGED** into `main` (PR #41, squash commit `f1b9d3f`, CI green: check + secrets, run 40065062694, 2026-10-24).
**Phase 10 (local parts) MERGED** into `main` (PR #10, squash commit `dc7600f`, CI green: check + secrets, run 38877776627 — unit 132, pgTAP 1243, integration 23, E2E 26/26 against the production build incl. T-SEC-05, 2026-10-16).
**R1 OCR MERGED** into `main` (PR #11, squash commit `69d3fc6`, CI green: E2E 26/26, run 38880693017, 2026-10-16).
**R1 file purge MERGED** into `main` (PR #12, squash commit `6f343a0`, CI green: run 38896124282 — unit 135, pgTAP 1256, integration 26, E2E 26/26 against the production build, 2026-10-16).
**R1 AI bank questions MERGED** into `main` (PR #13, squash commit `b6f2ded`, CI green: run 38936700856 — pgTAP 1276, E2E 27/27 against the production build, 2026-10-16).
**R1.1 step 1 MERGED** (PR #19, squash `f6e4841`, CI green, 2026-10-17): ADR-037–041 + spec docs.
**R1.1 step 2 MERGED** (PR #20, squash `17459e5`, CI green check + secrets, 2026-10-17): ExamEdge library removed.
**R1.1 steps 3+4 MERGED** (PR #21, squash `22ac7f3`, CI green run 39052604720 on `98546f6`: unit 147, pgTAP 1298, integration 26, E2E 26/26, 2026-10-17).
**R1.1 step 5 MERGED** (PR #22, squash `0cc9a2e`, CI green run 39088703249: check + secrets, 2026-10-18): AI notes + AI test (ADR-039).
**R1.1 step 6 MERGED** (PR #23, squash `061dadf`, CI green run 39091413903: check incl. E2E + secrets, 2026-10-18): Contest page + batch switcher (ADR-040).
**R1.1 step 7 MERGED** (PR #24, squash `4f3f78a`, CI green run 39091772704: check incl. E2E + secrets, 2026-10-18): platform "All institutes" shows AI tokens + cost this month per institute (ADR-041 part 1).
**R1.1 step 8 MERGED** (PR #25, squash `f0b1ec5`, CI green run 39107064953: check incl. pgTAP + E2E + secrets, 2026-10-18). **R1.1 is DONE** (all 8 steps); only ADR-041 part 2 (charges/bill) waits for the founder.
**R1.2 steps 1–3 MERGED** (PR #26, squash `ed98a0c`, CI run 39116328717 green, 2026-10-18).
**R1.2 item 1 MERGED** (PR #27, squash `6956c98`, CI run 39118383486 green on `6397d00`: unit 164, pgTAP 1347, integration 28, E2E 29/29 against the production build, secrets, 2026-10-18). **R1.2 is DONE**; only ADR-041 part 2 (charges/bill) waits for the founder.
**Founder follow-ups MERGED** (session 36, 2026-10-18): PR #28 (`ac20bed`, CI green run 39119531263) — draft test page
shows "Add questions" (AI box + Type a question) first, hint on the New test form; PR #29 (`3261716`, CI green run
39120779329) — a teacher's uploaded notes publish themselves to the subject's batch once read, AI notes still wait
(ADR-044, migration 24 applied locally, pgTAP 1352). `main` = `3261716`.
**Session 37 work MERGED** (session 38, founder said "merge both"): PR #30 (`4e27872`, CI run 39138871672 green) —
negative marks + optional model answer + JEE Advanced multi-correct (ADR-045); PR #31 (`8499b5e`, CI run 39140952256
green, after merging `main` into `r12-bill` because force-push is not allowed) — ₹ Bill (ADR-041 part 2). `main` = `8499b5e`.
**Session 38 work MERGED** (session 39, founder said "merge #32 and #33"): PR #32 (`16b7547`) instant result
(ADR-046); then `main` merged into `r12-reviews` (`e2a01b4`; PROGRESS kept from `r12-reviews`, DECISIONS kept both ADRs;
pgTAP Files=25 Tests=1435 PASS, typecheck PASS), CI run 39147981293 green, PR #33 (`03afbca`) reviews + replies
(ADR-047). `main` = `03afbca`.
**Sessions 41–43 (open, NOT merged):** PR #35 `r13-ui` UI redesign + polish + refine (ADR-049) and Smart Study without notes, audio/video overviews, tutor general answers (ADR-050); head `37d9f5f` + handoff commit, **CI green** (run 39202529367 on `37d9f5f`, check incl. E2E + secrets). Founder has NOT said "merge" (see Next exact action (session 44)).
**Session 39 (merged in 40):** PR #34 CBT tests (ADR-048), branch `r12-cbt`. First CI run 39153129147 failed
only on the new E2E locator (fixed in `b61f991`, CI re-running at handoff). Founder has not said "merge" for #34.
**Release 1 local build is complete** (Phases 1–9 + Phase 10 local parts + AC7.5 AI bank questions). Phase 10 cloud parts are BLOCKED on founder approval (see Blocked).
GitHub remote: `origin` = https://github.com/khushpal-cipher/ExamEdge_ai (**PUBLIC**, founder's explicit choice on 2026-10-15). Founder asked to connect and push; push phase branches and `main` after each green phase. Never commit secrets (repo is public). Deployments and other cloud accounts still need founder approval.

## Completed (with evidence)
| Date | Item | Evidence |
|---|---|---|
| 2026-10-23 | PR #40 merged (founder: "push #40") | CI green on `95abc4a` (check incl. E2E + secrets), `gh pr merge 40 --squash` → main `707294d`. Founder's friend will suggest the UI next; `r16-fun-ui` / `r16-violet` / `r16-saffron` stay local, unmerged. |
| 2026-10-23 | Session 47b: founder liked the gamified Home but said the bright look felt AI-made; sent a Squarespace space template as the look they like. LOCAL branch `r16-fun-ui` | "Play theme" CSS block replaced by a "Space theme" block (end of `globals.css`): dark starfield page (CSS gradients), neon lime `#d4ff6b`, Anton uppercase titles, Space Mono uppercase labels/nav/buttons, Space Grotesk text, pill buttons (lime fill / lime outline), hairline cards, lime goal ring, scrolling ticker on Home (`aria-hidden`, stops with reduced motion). Contrast by script: muted `#9db0c2` ≥ 7.1 on all dark surfaces, lime ≥ 12.4. Evidence (2026-10-23): lint + forbidden, typecheck PASS; `npm test` 195/195; `npm run build` PASS; headless Chromium on the production build (`next start`, :3002): student Home 1280 + 375 (scrollWidth = viewport), subject page, teacher Dashboard + Question bank; 0 page errors. The other chat's `next dev` on :3000 shows a 500 for the new Google fonts (Turbopack "Can't resolve @vercel/turbopack-next/internal/font/google/font") until it is restarted; the build is fine. NOT pushed; E2E/axe not run. Undo: `git checkout d5b4eac` (bright version) or `git checkout r15-next` (old). |
| 2026-10-23 | Session 47: playful student Home, LOCAL branch `r16-fun-ui` only (founder: "not boring, play with psychology, commit locally so I can go back") | `lib/streak.ts` (streak/week/XP/level from existing activity: own doubts, study tools, test attempts; IST days; no DB change) + `streak.test.ts` 6 tests; Home: greeting by time of day, streak/XP/level pills, daily goal ring (3 actions) + last-7-days strip + one big button, empty rank band hidden, subject tiles coloured with emoji; "Play theme" CSS block at the end of `globals.css` (Nunito font, chunky 3D buttons, flat outlined cards). Evidence (2026-10-23): lint + forbidden, typecheck PASS; `npm test` 195/195; headless Chromium on `next dev` :3000 (newtown, student1) 1280 + 375: scrollWidth = viewport, 0 page errors. NOT pushed, NOT merged; E2E/axe not run. Undo: `git checkout r15-next`. |
| 2026-10-19 | Tutor answers from general knowledge when no notes match (founder, ADR-050) | `tutor-v4` prompt (full general answer, labelled), Claude request notes "no passages matched", demo provider answers in the same shape; unit test for the old "not found" reply replaced by the new rule (founder changed it). Evidence: `npx vitest run packages/core/src/ai` 102/102; format, lint, typecheck PASS; `npm test` 178/178; `npm run test:int` 28/28; build + check-bundle ok. Browser (founder's `next dev`, student1, probability, 375 px): "Your institute's notes do not cover this yet…" + general paragraph, both labelled "General explanation", 0 page errors; test chat **deleted**. |
| 2026-10-19 | Smart Study without notes + audio/video overviews (founder, ADR-050), `r13-ui` commit `6132d60` | Founder: study tools must work without teacher notes; add Audio + Video overview with the free browser voice now, paid voice later. Migration `20261114000033_overviews.sql` applied with `supabase migration up` (no reset). Unit test "no sources → nothing reserved" replaced (rule changed by the founder) by general-mode tests for all 6 kinds + "with sources a part without a citation is still rejected". Evidence (2026-10-19): format, lint + forbidden, typecheck PASS; `npm test` 178/178; `npm run test:int` 28/28; `npx supabase test db` Files=26 Tests=1459 PASS (110_studio +3); `npm run build` + check-bundle ok. Headless Chromium on founder's `next dev` :3000 (newtown, student1, maths · probability = 0 notes, 375 + 1280): Summary / Audio / Video overview → `ok=generated`, then `ok=reused`; "General explanation" badge shown; Play → "Part 1 of 3" + Pause/Stop; scrollWidth = viewport; 0 page errors. Spoken audio itself not heard (headless) — **unverified: listen in Chrome/Safari**. 3 test artifacts **deleted**. E2E → CI. |
| 2026-10-19 | Session 43 on `r13-ui` (PR #35) | `a98d60c` page pass: own 404 page (`app/not-found.tsx`, portal re-export; status stays 404), result-page options as rows, styled file picker. `dcf3383` CI fix: run 39197920047 failed 4 E2E on axe `color-contrast` because the page `rise` animation faded text in → movement only, no assertion changed. `740a016` founder UI refine (ADR-049 refine): raised surfaces, button depth, glow, entry grid, staff phone menu, Google G button, practice/doubt lists as tables (E2E `studio.spec.ts` now checks the table row, same facts), page titles. Evidence (2026-10-19, on `740a016`): format, lint + forbidden, typecheck PASS; `npm test` 163/163; `npm run build` + check-bundle ok. Headless Chromium on the founder's `next dev` :3000 (newtown): student2, teacher.jee, teacher.neet at 375/768/1280, scrollWidth = viewport everywhere, 0 page errors; staff menu at 375/768: opens (links visible), closes on navigation and Escape. Owner view checked with a temporary owner `tmp.owner@newtown.test` (all 3 batches, 4 staff, 2 students, New batch form) → **deleted** (0 tmp users). E2E not run locally (:3000 is the founder's dev) → CI. |
| 2026-10-19 | UI redesign steps 3–6 (session 41), branch `r13-ui` | Founder: "update the buttons and the links". Links: semibold blue, no underline (underline on hover and inside running text/notes); secondary buttons = mint fill + blue text, no grey box; primary solid blue. Progress-page bars reuse `.meter` (inline colour styles gone; remaining inline styles are layout only). Checked headless at 1280 light: student Contest, My progress, Review; staff batch page, People, Question bank, student progress, released test, topic. lint + forbidden, typecheck, unit 163, build + bundle PASS; E2E → CI. |
| 2026-10-19 | UI redesign with the founder's palette (ADR-049 update, session 41), branch `r13-ui` | Founder supplied palette `#3368A0/#66A3BF/#C8DFDB/#F2EFE7` + a full redesign brief, then said "keep this type of UI" on the Home screenshot. `globals.css` rewritten (tokens for colour/type/space/radius, dark mode, flat sections, pressable tiles, underlined tabs, runner `.runbar/.meter/.option/.runnav`, entry `.center` split, forms max 600 px, checkbox labels in one row, reduced motion); `layout.tsx` fonts Plus Jakarta Sans + Source Serif 4; markup: entry pages (`page.tsx`, `invite/[token]`), Home section order, runner classes (no logic), batch label `<span>`, brand colour only on the logo (`(portal)/layout.tsx`). Contrast by node script (all text ≥ 4.5, field borders ≥ 3). format, lint + forbidden, typecheck PASS; vitest 191/191; build + bundle PASS; E2E not run locally (:3000 held by founder's dev) → CI; E2E class locators `.stat`, `.side` kept. Headless Chromium on founder's `next dev` :3000 (newtown; student2 and teacher.jee): sign-in, Home, runner (temporary copy of "jhj", **deleted**, tests 10 = before), Dashboard, Tests at 375/768/1280 light + dark, scrollWidth = viewport, 0 page errors. |
| 2026-10-19 | UI redesign steps 1+2 (ADR-049, session 41), branch `r13-ui` | `globals.css` only: indigo + saffron tokens, dark mode (`prefers-color-scheme`), Poppins 700 headings (h1 clamp 26–34 px), light sidebar with indigo active pill, 16 px cards, pressable 44 px buttons/tiles/answer options (3 px bottom edge, `color-mix` so an institute brand colour also works), chosen MCQ option highlighted via `:has(input:checked)`, `--focus` ring (indigo light / saffron dark), `.stack` no longer stretches empty boxes. No markup, logic or selector change. Contrast by script (node, WCAG formula): all text pairs ≥ 4.5 in light + dark; field borders 3.26–4.67; saffron alone fails 3:1 on the light page → used as focus ring only in dark. brilliant.org studied in the built-in browser (its CSS did not load in the pane; layout cues from structure). format, lint + forbidden, typecheck, build + bundle PASS; unit/pgTAP/int/E2E not rerun (CSS only) → step 7 + CI. Headless Chromium (Playwright) on the founder's `next dev` :3000, newtown, student2, light/dark × 375/1280: Home and a test page scrollWidth = viewport, 0 page errors; runner shown with a temporary copy of "jhj" (SQL, opened now) → started, option B chosen → **deleted** (tests 10 = before, 0 attempts left). Screenshots show newtown's own brand colour replacing indigo (Phase 3 branding) → asked the founder. |
| 2026-10-19 | Test page fixes (founder, session 40), branch `r12-cbt` | (1) Bug: "Submit test" used `confirm()`; Chrome leaves full screen for that popup, and leaves during it were ignored → after Cancel the test ran outside full screen with no warning. Now the question is asked on the page ("Submit now" / "Keep working"), the `asking` ref is gone. (2) One question per page with Previous / Next ("Question n of N"), all tests. (3) CBT: copy, cut and paste are blocked and each try is a warning (same 3-warning count). Files: `tests/[id]/runner.tsx`; E2E `assessments.spec.ts` (Next/Previous, Submit now), `cbt.spec.ts` (Keep working keeps full screen; 3rd warning = paste → `auto_submitted`; the reload-as-warning step was replaced, it was hand-checked in session 39); ADR-048 updated. format, lint + forbidden, typecheck PASS; unit 163/163; build + bundle PASS. Headless Chromium on the founder's `next dev` :3000 (newtown, teacher.jee → temporary 2-question CBT test in jee 2027 maths, student1, 375 px): Q1 only shown, Previous disabled; Next → Q2, Next disabled; Previous → Q1 answer kept; Submit test → on-page question → Keep working → still full screen, no warning; blur → Warning 1 of 3; paste blocked → Warning 2 of 3; Submit now → Submitted; scrollWidth 375; 0 page errors. Temporary test + 2 questions **deleted** (0 left). int/pgTAP not rerun (no DB or server-code change). E2E → CI. |
| 2026-10-18 | CBT tests (founder, ADR-048), branch `r12-cbt` | Founder chose: tab/app switch counts too; students told to use Chrome (others refused); teacher sees warnings on results. Migration `20261113000032_cbt.sql` (`tests.cbt`, `test_attempts.cbt_warnings`, definer `cbt_warning`, `guard_test` freezes `cbt` once open) applied with `supabase migration up`. pgTAP new `260_cbt.sql` + allowlist: `npx supabase test db` Files=26 Tests=1456 PASS. format, lint + forbidden, typecheck PASS; unit 163/163; int 28/28; build + bundle PASS. E2E new `cbt.spec.ts` → CI (demo seed). Browser (`web-prod-3001` on :3002, newtown): temporary CBT test for class 10 (SQL); student2 sees the CBT note + "Start test in full screen"; the in-app pane refuses full screen → questions stay covered (fail-safe). Headless Chromium script on the same build at 375 px (scrollWidth 375, no page errors): Enter → full screen; leave full screen → "Warning 1 of 3" (DB 1); blur → "Warning 2 of 3" + "One more warning…"; reload → `auto_submitted`, 3, answer `["a"]` kept, notice shown (bug found + fixed: `CBT_WARNINGS` imported from a client module into a server page was a proxy → moved to `lib/assess.ts`). teacher.jee: CBT tick box on New test. Temporary test, question, attempt **deleted** (0 left). |
| 2026-10-18 | Student sees own result right after submit (founder, ADR-046), branch `r12-instant-result` | Founder chose: marks + right/wrong at once, correct answers at closing time (key-sharing risk), theory = own answer + marks once checked, rank after release. Migration `20261109000028_instant_result.sql` (`private.get_attempt_review`) applied with `supabase migration up`. pgTAP `060` +6 (after submit: live marks, no keys; still writing / another student's attempt refused; after close: −negative, blank 0, keys, no model answer, no rank; checked-before-release written marks + comment): `npx supabase test db` Files=24 Tests=1378 PASS. format, lint + forbidden, typecheck PASS; unit 163/163; int 28/28; build + bundle PASS. E2E `assessments.spec.ts` (Marks so far 12 / 16, After release, Not checked yet, 3× key-after-close note; after close 3× Correct answer, no Model answer) → CI (:3000 held by the founder's `next dev`). Browser (founder's `next dev` :3000, newtown, student2): temporary copy of "jhj" with a submitted attempt → "-1 / 4", "After release", "Correct answer: shown after the test closes"; after moving its close time → "Correct answer: A", 375 px scrollWidth 375; released "jhj" unchanged (rank 1). Temporary test **deleted** (tests 5, attempts 1, answers 1 = before). PR #32; CI first failed on `getByText('Not checked yet')` (also in the notice) → `exact: true`, run 39147007384 green on `8c20c74`. |
| 2026-10-18 | Student reviews, read only by owner/admin (founder, ADR-047), branch `r12-reviews` (from `main` `8499b5e`; independent of PR #32) | Founder: Review tab for students, Reviews tab for owner/admin only, student may hide their name (then no `user_id` stored), text only. Migration `20261110000029_reviews.sql` applied with `psql -1 -f` + a `supabase_migrations.schema_migrations` row (`supabase migration up` refused: migration 28 is applied locally but not on this branch). pgTAP new `250_reviews.sql` + fixture row in `test_helpers.sql` (reloaded with `psql -f`): `npx supabase test db` Files=25 Tests=1412 PASS (isolation matrix incl. reviews). format, lint + forbidden, typecheck PASS; unit 163/163; int 28/28; build + bundle PASS. E2E new `reviews.spec.ts` → CI. Browser (founder's `next dev` :3000, newtown): student2 sees "Review" in the sidebar, sent an anonymous review → flash, stored with `user_id` null + batch neet 2027, 375 px scrollWidth 375; teacher.jee: no Reviews link, `/reviews` 404. Temporary review **deleted**; the founder's own two "hello!" reviews kept. Owner page not clicked (founder's Google sign-in) → E2E. |
| 2026-10-18 | Owner/admin reply to reviews (founder, same PR #33) | Migration `20261111000030_review_replies.sql` (`reply`, `replied_at`, `replied_by` stamped by trigger `stamp_reply`; U(`reply`) owner/admin; student reads own named rows) applied with `psql -1 -f` + history row. pgTAP `250` now 26 tests (owner replies incl. anonymous, cannot edit body or forge `replied_by`, empty reply rejected, remove clears stamps, student reads reply, teacher/student cannot reply): Files=25 Tests=1423 PASS. typecheck, lint, format, unit 163, build + bundle PASS. E2E `reviews.spec.ts` extended (owner replies → student sees it; hidden review not in the student's list) → CI. Browser: student2 page lists "Your reviews" with the founder's own live reply "asdhk" (founder tested the owner reply form on :3000; DB stamped `replied_by`/`replied_at`). Temporary "TMP named review" **deleted**. |
| 2026-10-18 | Anonymous reviewers see the reply too (founder, same PR #33) | Migration `20261112000031_review_authors.sql`: `private.review_authors` (no API grant) filled by definer trigger `record_author` from the session, backfilled for named reviews; definer `my_reviews(inst)` (allowlist +2); policy `reviews_own_read` dropped. Applied with `psql -1 -f` + history row (backfill run by hand after). pgTAP `250` (my_reviews returns own incl. anonymous with replies, others' none, owner cannot read `private.review_authors`, anonymous row has no `user_id`): Files=25 Tests=1429 PASS. typecheck, lint, format, unit 163, int 28, build + bundle PASS. E2E `reviews.spec.ts` (owner replies to the hidden one, student sees "name hidden" + reply) → CI. Browser (student2): "TMP hidden review" + DB reply shown; founder's own "whats up"→"done" (anonymous) and "hello!"→"asdhk" (named, needed the backfill — found in this check) shown. CI: first run failed on `getByLabel('Your review')` (the student's review cards are also labelled) → `exact: true`; run 39147004736 green. Temporary review **deleted**. Founder's first anonymous "hello!" (before migration 31) has no stored author, so its reply cannot reach the student. |
| 2026-10-18 | Owner/admin "AI usage" → **Bill** in ₹ (founder, ADR-041 part 2 first step), branch `r12-bill` (stacked on `r12-typed-marks`) | Founder chose: platform admin sets "₹ per US$"; commission later. Migration `20261108000027_bill.sql` (`settings.inr_per_usd`, `set_inr_per_usd` aal2 + audit, `inr_per_usd()`, `institute_bill(inst)`), applied with `supabase migration up` (+ the `public.inr_per_usd()` wrapper run by hand with `psql`, same SQL as the file). Local: format, lint, typecheck PASS; unit 163/163 (budget-level helper + its test removed with the old page); pgTAP Files=24 Tests=1372 PASS (new `240_bill.sql`, allowlist +2); int 28/28; build + bundle PASS. E2E `usage.spec.ts` (owner Bill ₹ only, no tokens/$) + `portals.spec.ts` (platform saves the rate) → CI. Browser (`web-prod-3001`, teacher.jee): no Bill link, `/usage` 404. Owner page and platform form **not clicked in the browser** (founder's Google/MFA sign-in) → E2E in CI. |
| 2026-10-18 | Multiple-correct MCQs marked like JEE Advanced (founder chose it over split-by-count, ADR-045), on `r12-typed-marks` / PR #30 | Migration `20261107000026_multi_partial_marks.sql` (`grade_objective`: all right = full, only right but not all = marks/4 each, any wrong = −negative, blank 0); pgTAP `060` old "subset = no partial marks" assertion replaced by 7 new-rule cases (founder changed the rule); 1361 PASS. Form hint under the options. PR #30 CI first failed on 2 E2E selectors (new label also matched "Correct answer"; documents test picked a soft-deleted/NEET note — that one also failed on `main` since ADR-044): fixed in `005337c`. |
| 2026-10-18 | Type a question: negative marks + optional model answer (founder, session 37), branch `r12-typed-marks` | Migration `20261106000025_typed_negative_marks.sql` (`add_test_questions` reads `negative_marks`) applied with `supabase migration up`; form: "Marks for a correct answer" + "Negative marks for a wrong answer" (not for theory), model answer optional; check + review pages hide an empty model answer. Local: format, lint + forbidden, typecheck PASS; unit 164/164; `npx supabase test db` Files=23 Tests=1355 PASS (3 new in `220`); `npm run test:int` 28/28; `npm run build` + bundle scan PASS. E2E `assessments.spec.ts` updated (MCQ −1 shown in the table, theory added with no model answer) → CI (:3000 held by another `next dev`). Browser (`web-prod-3001`, newtown, teacher.jee "Amit Verma"): temporary draft test on maths · jee 2027 → typed MCQ with negative 1 → stored `marks 4, negative_marks 1`; theory with blank model answer → stored `{"model_answer": ""}`, no negative field shown; 375 px scrollWidth 375. Temporary test + 2 questions **deleted** (tests 2, questions 3 = before). |
| 2026-10-18 | Teacher-uploaded notes publish themselves (ADR-044, founder), branch `r12-notes-autopublish` | Migration `20261105000024_notes_autopublish.sql` applied locally (`supabase migration up`); `confirmUpload` adds the subject's batch as audience. Local: format, lint, typecheck, unit 164, pgTAP Files=23 Tests=1352 PASS (new `230`), int 28, build + bundle PASS; E2E `documents.spec.ts` updated (→ CI). Browser (`next dev` :3000 + worker, newtown, teacher.jee): uploaded a 1-page PDF to probability → after processing `published`, audience jee 2027; then soft-deleted like the app (chunks removed). PR #28 (draft page: Add questions at the top) merged `ac20bed`. Founder's earlier "sql" notes (class 10 · logic) stay "Not published" (uploaded before this change) — publish by hand on its notes page. |
| 2026-10-18 | Draft test page: "Add questions" (AI box + Type a question) moved to the top, hint on New test form (founder could not find them) | Founder screenshot: boxes are on the page after Create test, below Settings, and the :3000 `next dev` was stale (restarted via preview `web`). Local: format, lint, typecheck, unit PASS; browser (newtown, teacher.jee, `next dev`): headings Add questions → Settings → Questions; check test deleted (tests 0). PR + CI below. |
| 2026-10-18 | R1.2 merged (PR #26 `ed98a0c`, PR #27 `6956c98`) | Founder approved merging #26 in chat; `r12-new-test` rebased onto `main`, force-pushed; PR #27 CI run 39118383486 green (check incl. E2E 29/29 + secrets); `gh pr merge 27 --squash` → `6956c98`. |
| 2026-10-18 | R1.2 item 1 web part (ADR-042), branch `r12-new-test` — NOT merged | Local: format, lint + forbidden, typecheck PASS; unit 164/164; `npm run test:db` Files=22 Tests=1347 PASS; `npm run test:int` 28/28; `npm run build` + bundle scan PASS. E2E → CI. Browser (production build `next start -p 3001`, newtown, teacher.jee, 375 px): topic page → only "Subtopics" tab (student: Subtopics + Smart Study); Tests → New test (maths · jee 2027) → draft page; AI request "2 MCQs + 1 theory on probability, medium" → `?error=no_sources` (no published notes, nothing added); "Type a question" (written) → `ok=question_added`, listed in Questions; Schedule → `ok=scheduled`; bank has no New question form; scrollWidth 375 after the label fix (was 721). Temporary test + question **deleted** (tests 0, questions 3 = before). |
| 2026-10-18 | R1.2 steps 1–3 (PR #26, branch `r12-ui`, CI green, NOT merged) | ADR-042 (new test page) + ADR-043 (switcher, tiles), HOW_IT_WORKS / DATABASE_DESIGN / AI_PIPELINE updated (`66a877f`). One-click batch switcher (`batch-switcher.tsx`, noscript Show), `chooseBatch` → `redirect('/home')`; Smart Study tiles (one form, a submit button per tool, icons in `--accent`) + "Made by you" / "From your teachers" below (`c56c686`). E2E updated: `contests.spec.ts` (switch → /home, no Show button), `studio.spec.ts` (tile click). Local: format, lint, typecheck, unit 154, pgTAP 1334, int 28, build + bundle PASS. Browser (`next dev` :3000 via preview `web-attach`, newtown, student1, 375 px, scrollWidth 375): subject page → pick "neet 2027 (past)" → /home of neet 2027; tiles render; Summary tile → `?error=no_sources` on probability (no notes, nothing created). Temporary row (student1 past member of neet 2027) added and **removed** (count back to 1). CI run 39116328717: check (incl. E2E) + secrets **pass**. |
| 2026-10-18 | R1.1 step 8 merged (PR #25) | Past-batch test page shows the reason instead of "Start test" (+E2E in `contests.spec.ts`); teacher question bank lists only subjects of their batches; "Topic" / "Topic strength" wording; singular "1 topic"/"1 subtopic"; `launch.json` `web-attach`. Local: format, lint, typecheck, unit 154, int 28, build + bundle ok; pgTAP 1334 on `c5df7cd`. CI run 39107064953 green (incl. pgTAP + E2E); `gh pr merge 25 --squash` → `f0b1ec5`. |
| 2026-10-18 | R1.1 step 7 merged (PR #24) | `public.platform_usage()` + "AI this month" column on `/platform`; pgTAP 1334 PASS, unit 154, int 28, build PASS locally; CI run 39091772704 green (incl. E2E); `gh pr merge 24 --squash` → `4f3f78a`. |
| 2026-10-18 | R1.1 step 6 merged (PR #23) | E2E locator fixes (`exact: true` region name; table link instead of chart `<title>`), commit `2d41986`; CI run 39091413903 green; `gh pr merge 23 --squash` → `061dadf`. |
| 2026-10-18 | R1.1 step 5 merged (PR #22) | Second CI run 39088703249 on `e439730` green (check incl. E2E against the production build, secrets); `gh pr merge 22 --squash` → `0cc9a2e`. |
| 2026-10-17 | R1.1 steps 3+4 merged (PR #21) | The 6 E2E failures had one cause: `e2e/helpers.ts` `demoTopic` ordered batches by `created_at`, but the seed creates all batches in one transaction (equal `created_at`), so it sometimes picked NEET's empty Physics copy (teacher1/student05 not members → 404, no notes → `no_sources`). Fix: pick the subject by batch name (`JEE 2027 Morning`), commit `98546f6`; no assertion changed. CI run 39052604720 green (E2E 26/26); squash-merged `22ac7f3`. |
| 2026-10-17 | R1.1 steps 3+4 app part (ADR-038, ADR-040), branch `r11-structure` commit `debaaae` — NOT merged | Migration `20261031000019_topic_scope.sql` (`conversations.chapter_id`, `match_chunks(..., topic)`, invoker `move_students`), applied with `supabase migration up`; new pgTAP `180_topic_scope.sql`. Web: batch create form takes subjects (comma-separated) + "Add subject" and "Move students to another batch" on the batch page; Subjects = per batch (teachers: own batches); subject page = topic list (+ reported answers); new `/topics/<id>` with tabs Subtopics (notes per subtopic, "Upload notes" inside each subtopic) and Smart Study (topic tutor + study tools); audience pickers read the subject's batch; question bank labels "Physics · JEE 2027 Morning". Seed, worker int fixtures, E2E specs (portals, documents, tutor, studio, question-gen, assessments) updated. Local: format, lint + forbidden, typecheck PASS; unit 147/147; `npm run test:db` Files=18 Tests=1298 PASS; `npm run test:int` 26/26; `npm run build` + bundle scan PASS. **E2E NOT run locally** (founder DB, no demo seed) → CI. Browser (production build `next start -p 3001`, newtown, 375 px): student Riya home → maths → probability topic, both tabs, scrollWidth 375; teacher.jee Subjects shows only jee 2027, added + deleted a temporary subtopic, Upload form opens inside it; teacher.neet → maths subject 404 (founder finding A3 fixed); no server errors. Owner pages not clicked in the browser (founder's Google account) — covered by E2E `portals.spec.ts` in CI. |
| 2026-10-17 | R1.1 step 3 DB part (ADR-038, ADR-040), branch `r11-structure` commit `58de935` — NOT merged | Migration `20261030000018_structure.sql`: `subjects.batch_id not null` (composite FK, unique per batch; a subject linked to several batches copied once per extra batch with its topics; migration stops if content was published to several batches of one subject or an unlinked subject has content), `batch_subjects` dropped, `has_subject` = in the subject's batch (current or past), new `subtopics` (RLS like chapters), `documents.chapter_id` + `subtopic_id` `not null` (3-column FKs, "General" topic/subtopic backfill, no-action FKs so a topic/subtopic with notes cannot be deleted), AFTER-insert trigger `guard_audience_batch` (document/artifact audience = subject's batch, `audience_not_subject_batch`), `batch_members.left_at` (owner/admin update policy), `compute_standings` ignores tests opened after leaving, `start_attempt` refuses `not_current_member` (resume still works). Dry run in a rolled-back transaction, then `supabase migration up` on the founder DB (newtown `physics` → one per batch). Fixtures `supabase/test_helpers.sql` (reloaded with `psql -f`) + `070` updated, new `170_structure.sql` (24 tests). `npm run test:db` → Files=17 Tests=1285 PASS. Found + fixed: a BEFORE trigger answered 23514 before RLS in the isolation matrix → AFTER trigger. |
| 2026-10-17 | R1.1 step 2: ExamEdge library removed (ADR-037) | Migration `20261029000017_remove_library.sql` (tables, `match_library_chunks`, `publish_library_item`, platform metering dropped; `usage_records.institute_id` not null again — deleted the 24 fake `library_embed` rows, cost 0). Tutor `tutor-v3`, notes only. Local: lint, typecheck, unit 147/147, pgTAP Files=16 Tests=1260 PASS, integration 26/26, build + bundle scan PASS; E2E not run locally (no demo seed in founder DB) → CI run 39035496214 check + secrets green; PR #20 merged `17459e5`. |
| 2026-10-17 | R1.1 step 1: ADR-037…041, HOW_IT_WORKS, DATABASE_DESIGN, master plan, AI_PIPELINE, ARCHITECTURE | PR #19 CI green, merged `f6e4841`. |
| 2026-10-17 | Platform: send a new owner invitation (ADR-036) + clearer address-length hint | `reinvite_owner` RPC (aal2, refused once an owner joined, revokes old owner links). `supabase migration up` (no reset) then `npx supabase test db` → Files=17 Tests=1303 PASS (new `160_reinvite_owner.sql`); `npx playwright test e2e/portals.spec.ts -g "platform admin needs MFA"` passed (against the running `next dev`); format, lint, typecheck PASS; unit 154/154. Address minimum stays 3 (founder). CI green (run 39019308579: check + secrets, incl. build and full E2E against the production build); PR #18 squash-merged (`5fc5051`). |
| 2026-10-17 | Google sign-in + invitation emails (ADR-035) | Founder created Google Cloud OAuth client + Resend key (gitignored root `.env`, `apps/web/.env.local`). Unit 154/154 (`apps/web/lib/email.test.ts`); E2E portals + isolation 12/12 against a local production build; headless click reached accounts.google.com with the real client id. CI failed twice on the new Google E2E (Playwright cannot intercept a redirect target, so CI hit real Google with the placeholder client) → test now stops at Supabase `/auth/v1/authorize` and reads its Location; CI 2/2 green on `3c605e7`; PR #17 merged (`0006d1c`). **Unverified:** a full real Google sign-in and a delivered email (founder to try). Resend sends only to the account owner until a domain is verified; Google consent screen in Testing (test users only). |
| 2026-10-17 | Platform: delete an institute created by mistake (ADR-033) | `delete_institute` RPC (aal2, typed address, refused with any membership). `supabase migration up` then `npm run test:db` → Files=16 Tests=1288 PASS (new `150_delete_institute.sql`); platform E2E (refused for Demo + wrong confirmation, deletes its test institute) passed; format, lint, typecheck PASS; CI 2/2; PR #15 merged (`65ce7de`). |
| 2026-10-17 | Local demo sign-in creates unknown accounts (ADR-034) | `signInDemo` signs up on `invalid_credentials` (still localhost-only via `demoLoginAllowed`). E2E `isolation.spec.ts` invitation test without pre-created account: failed without the change, passed with it; unit 151/151; format, lint, typecheck PASS; CI 2/2; PR #16 merged. |
| 2026-10-17 | Fix: new institute shows in platform list without reload | Founder found it while testing locally. `createInstitute` now calls `refresh()`; platform E2E checks the list before its reload: `npx playwright test e2e/portals.spec.ts -g "platform admin needs MFA"` failed without the fix (line 204), passed with it. format, lint, typecheck PASS locally; CI 2/2 green; PR #14 merged (`0a4f3ae`). |
| 2026-10-14 | Repository investigation | `examedge_ai/` was empty. It sits inside the `startup` git repo (remote `khushpal-cipher/startup_idea`, private), whose `.gitignore` ignores everything except `vulnops-validation/` → files here are **not tracked**. No CLAUDE.md, manifests or env files existed. Tools present: node 24.11, npm 11.6, bun 1.4, python 3.14, uv 0.12, psql 16, gh 2.100, git 2.54; **missing:** docker, supabase CLI, vercel CLI, pnpm, ffmpeg, manim. macOS 27, arm64. |
| 2026-10-14 | Provider verification | Prices/limits checked on official pages (see docs/COST_MODEL.md §1, §9). Unverified items marked [U]. |
| 2026-10-14 | Planning docs created | `docs/*.md` (11 files), `PROGRESS.md`, `CLAUDE.md` |
| 2026-10-14 | Self-review | 21 issues found and resolved in docs (docs/DECISIONS.md review log) |
| 2026-10-14 | Brief + shareable summary | `docs/ORIGINAL_BRIEF.md`, `docs/PLAN_EXPLAINED_SIMPLY.md`, `docs/share/examedge-plan.html` (published privately at https://claude.ai/artifact/YNm1NLbCweGBQhvBMRW7Qd), source images in `docs/assets/` |
| 2026-10-15 | Founder decisions | Theory answers checked manually by teachers; two ranks (test rank, overall rank by average percentage); student progress page; build Release 1 in demo mode with fake AI (no keys yet). Recorded in ADR-016, Q-05, HOW_IT_WORKS.md |
| 2026-10-15 | Build prompt | `docs/NEXT_SESSION_PROMPT.md` |
| 2026-10-15 | Docker + tools installed | Docker Desktop 4.95.0 (engine 29.8.2) via `brew install --cask docker-desktop`; Supabase CLI 2.121.0 + gitleaks 8.30.1 via `brew install supabase/tap/supabase gitleaks` |
| 2026-10-15 | Phase 1 partial: git init, workspaces, local Supabase | `git init -b main`, branch `phase-1-foundations`; npm workspaces installed (versions below); `supabase start` OK; `supabase test db` → `000_smoke.sql .. ok`, Files=1, Tests=4, PASS |
| 2026-10-14 | Consistency check | All relative links resolve; every ADR, Q, test (T-*) and gate (G1–G8) ID referenced is defined; no secret-like strings in files |
| 2026-10-16 | Phase 8 local gate | After `supabase db reset && npm run seed:demo`: `npm run check` → format, lint + forbidden, typecheck PASS; unit 111/111; pgTAP Files=11 Tests=1107 PASS; integration 21/21; build (+bundle scan) PASS; E2E 22/24 → mapping test race fixed (wait for sign-out), rerun `npm run test:e2e` 23/24: only `portals.spec.ts:142` T-SEC-05, because Playwright reused another session's `next dev` on :3000 (`reuseExistingServer`). Production build checked by hand: `next start -p 3100`, `demo.localhost:3100/` and `/library/<id>` → `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`. Full E2E against the production build runs in CI on the PR. |
| 2026-10-16 | Phase 5 local gate green | After `supabase db reset && npm run seed:demo`: `npm run check` exit 0 — format, lint + forbidden, typecheck, unit 46/46, pgTAP Files=9 Tests=959 PASS, integration 20/20, build (+bundle scan), E2E 18/18 (commit `aa5dcce`). `npm run audit` → ok. AC5.1: `scripts/check-forbidden.ts` rule `provider-sdk-outside-gateway` passes and `grep -rnE "@anthropic-ai/sdk|voyageai|openai" apps packages scripts` finds only the rule itself and its test. AC5.3: `apps/worker/src/usage.int.test.ts` — 100 parallel `rpc('ai_reserve')` with a student token and limit 40 → exactly 40 ok / 60 `quota`, counter = 40; 100 parallel worker reservations of 30 µ$ with 1,000 µ$ left → exactly 33 ok, 990 reserved. AC5.4: pgTAP `080_usage.sql` (global, institute and suspended switches) + integration test (aal2 platform admin flips `set_ai_enabled` through PostgREST → next worker reservation `ai_disabled` → back on). Browser check (dev server): owner@demo.test `/usage` desktop + 375 px; teacher/student `/usage` 404 (E2E); platform admin global switch off/on with audit rows. Two real bugs found and fixed: (1) `set_ai_enabled` failed with SQLSTATE 21000 because Supabase's `safeupdate` refuses an UPDATE without WHERE in PostgREST sessions (pgTAP cannot load it) → `where id` + API-path test that failed before the fix; (2) staff pages were 667 px wide at 375 px (non-wrapping nav widened the `1fr` grid column) → `minmax(0, 1fr)`, nav scrolls. ADR-025. |
| 2026-10-16 | Phase 4 local gate green | After `supabase db reset && npm run seed:demo`: `npm run check` exit 0 — format, lint + forbidden, typecheck, unit 32/32, pgTAP Files=8 Tests=850 PASS, integration 16/16, build (+bundle scan), E2E 16/16 (commit `ca4b542`). `npm run audit` → ok. Two test fixes found by the gate (no assertion weakened): pgTAP `070` storage fixture inserted objects the seed had already uploaded (duplicate key after seeding) → skips existing objects; platform E2E picked the logo while the "Save limits" redirect was still in flight (re-render emptied the required file input, no POST in the trace) → waits for the POST, reloads, checks the saved value. ADR-024 added; DATABASE_DESIGN §4.3 updated (uploading status, claimed_at, path check, service_accounts). |
| 2026-10-15 | Phase 7 local gate green | After `supabase db reset && npm run seed:demo`: `npm run check` exit 0 — format, lint + forbidden, typecheck, unit 21/21, pgTAP Files=7 Tests=693 PASS, build (+bundle scan), E2E 14/14 incl. `e2e/assessments.spec.ts` (commit `40fc4fc`). `npm run audit` → ok. Browser check (session 7, dev server): teacher1 checked all 22 written answers of "Chemistry Test 3" with names hidden and released (ranks with time tie-break, equal score+time share a rank); student01 started "Physics Practice Test" at 375 px (scrollWidth 375, autosave "Saved"), review + My progress at 375 px; owner JEE rank list, sort links, CSV `private, no-store`; owner@rival.test → 404 for Demo test/check/export, batch export and a real Demo student id. |
| 2026-10-15 | Phase 3 local gate green | After `supabase db reset && npm run seed:demo`: `npm run check` exit 0 — format, lint + forbidden, typecheck, unit 18/18, pgTAP Files=6 Tests=394 PASS, build, E2E 12/12 (commit `9ecd143`). `npm run audit` → ok. Then aal check switched to `getClaims()` (ADR-022): typecheck, format, lint, build, platform E2E 1/1 pass. Fixes: `done()` redirect used `?` twice on `/people?tab=invitations` (flash lost, real bug); E2E waits for client navigation and refills the form React resets. Browser check (session 6): owner dashboard; student01 home + Physics workspace at 375 px, scrollWidth 375; owner@rival.test → Demo subject id 404; admin.localhost sign-in; demo.localhost/platform 404. |

## In progress
### R1.2 item 1 — new test page (ADR-042) — session 36: MERGED (PR #27, `6956c98`)
- `5067caf` DB (migration 23, **applied to the founder's local DB**), `64bc029` core `planTest`, `d9533bf` WIP web part
  (sessions 35), then session 36: topic page Smart Study tab restored for students (staff: Subtopics only); Tests →
  New test = required "Subject (and its batch)" select grouped by batch (replaces the batch checkboxes); question bank
  "New question" form removed (bank = list / edit / approve / delete, empty state points to Tests); "Add from the bank"
  hint links the bank; `globals.css` `label { grid-template-columns: minmax(0, 1fr) }` (a long bank option widened the
  test page to 721 px at 375 px — found in the browser check). ADR-042 marked Built.
- E2E rewritten (no assertion weakened): `question-gen.spec.ts` (Tests → New test with subject → "Add questions with
  AI" "10 MCQs + 2 theory on Rotational Motion, medium" → `ok=ai_questions_added`; usage now 4 = plan + MCQ write +
  blind solve + theory write; student `add_test_questions` → 42501), `assessments.spec.ts` (the 4 question types typed
  on the test page via "Type a question", then checked in the bank), `studio.spec.ts` (teacher topic page: Subtopics
  tab only, no AI test / Smart Study). **E2E NOT run locally** (founder DB, no demo seed; :3000 held by another `next
  dev`) → CI.
- **Unverified:** the full AI path with real questions in the browser (founder DB has no published notes → the AI
  request correctly ended at `?error=no_sources`); covered by E2E `question-gen` in CI.
Migration 23 is now on `main` too (local DB and `main` agree again). The `next dev` on :3000 (started 14:05, before
these files) served a stale build: the "Add questions with AI" form rendered without its server action (plain GET).
Restart it (`npm run dev`) before using it; the production build (`web-prod-3001`) is correct.

## Blocked
| Item | Blocked on |
|---|---|
| Embedding real institute documents (Phase 4) | Q-08 Voyage data-use terms |
| Pilot launch (Phase 10) | Q-01 legal opinion on minors' data (G8, AC10.4) |
| Phase 10 cloud parts | Founder approval for accounts: production Supabase/Vercel/Railway, domain + wildcard TLS, prod Google OAuth, Sentry + spend alerts, independent backup storage; then the real restore drill (G7, AC10.2), k6 load test (AC10.3, AC7.4), rollback rehearsal (AC10.5) |
| Invitation emails to anyone but the founder | A domain + Resend domain verification, then `EMAIL_FROM` (Resend test sender only reaches the account owner) — ADR-035 |
| Google sign-in for everyone | Google consent screen is in Testing (only listed test users); publish it, and add the production callback URL when Supabase cloud exists |
| Real AI | Anthropic key (tutor, Studio, OCR and AI bank questions ready); Voyage client not written (Q-08) — RUNBOOKS §5 |

## Failed checks
- (Fixed, session 30) **PR #21 CI run 39051599920 (commit `6dc2e67`): E2E 6 failed** — cause and fix in Completed
  (`demoTopic` batch order); green on run 39052604720. Kept for history:
  - `e2e/tutor.spec.ts:32` and `:113`, `e2e/studio.spec.ts:42` and `:88`: `getByRole('tab', { name: 'Smart Study' })`
    never appears on `/topics/<id>`.
  - `e2e/documents.spec.ts:32`: `getByRole('tabpanel', { name: 'Subtopics' }).getByText('Upload notes')` never appears.
  - `e2e/question-gen.spec.ts:18`: bank "Make questions with AI" → no redirect to `ok=questions_made`.
  Shared suspicion (unverified): the topic page does not render for these users in CI — check what
  `/topics/<id>` returns there (404 from `opensBatch` / teacher batch filter, or the `demoTopic` helper picking a topic
  of another batch's copy of the subject after the per-batch split in `scripts/seed-demo.ts`), and why
  `generateQuestions` fails (chapter lookup with `subject_id` may now miss). Reproduce locally only with the founder's
  yes (needs `npm run seed:demo` in a fresh DB — the local DB has the founder's data). CI uploads no Playwright
  traces (only `gitleaks-results.sarif`), so read the code paths first; full log: `gh run view 39051599920 --log-failed`.
- Note: locally, `e2e/portals.spec.ts:142` (T-SEC-05) fails if Playwright reuses a `next dev` already running on
  :3000 (dev sends `Cache-Control: no-store` without `private`). Before `npm run check`, make sure port 3000 is free
  (`lsof -nP -iTCP:3000 -sTCP:LISTEN`); if another session's dev server holds it, rely on CI for E2E and say so.

## Unresolved decisions
See docs/RISKS_AND_OPEN_QUESTIONS.md §1 (Q-05 resolved). Plan approved for building on 2026-10-15; Q-01 (legal) and Q-08 (Voyage terms) still open.

## Next exact action (session 54)
**State (2026-10-25, end of session 53, Opus, branch `r18-batch-b`, pushed, PR #43 open into main, CI running at handoff):**
Batch B code is built; nothing of it is merged yet.
- `2ada634` pilot DB green. Fixed the 2 pgTAP failures: `guard_read_only` is now SECURITY DEFINER (the `worker` role has no
  access to schema `auth`, so `auth.uid()` in an invoker trigger broke every worker write — a real bug, not only the
  test); `guard_seats` checks only when a row takes a seat it did not hold (a teacher made admin at the cap was refused);
  allowlist += `read_only`, `guard_read_only`, `seats_full`, `guard_seats`. New `supabase/tests/270_pilot.sql` (37 tests:
  create_institute defaults + past end refused, trigger coverage on every tenant table, last pilot day not read-only,
  read-only after: reads ok, in-progress attempt answer + submit ok, new attempt / teacher / owner / invite refused, AI
  `ai_disabled`, worker and platform admin still write, extension re-opens; pilot budget counts last month; seat caps:
  invites incl. pending, accept refused, removed student frees a seat, re-activation needs a seat, owner not counted).
  Local migration 40 re-applied by hand (`create or replace` of the two functions; file and DB agree).
- `f299e23` web: `lib/pilot.ts` (+ unit test), portal banner, `read_only` / `seats_full` messages (flash, people invite
  list, invite page), platform create form (students, last pilot day prefilled today + 7), institute page (pilot end,
  expected students, seat caps), list column "Pilot ends", "Ended pilots older than 30 days — delete by hand".
  E2E `portals.spec.ts`: create form fills students, checks the pilot row in the DB; budget text now $10.00 (pilots get $10).
- Docs commit: ADR-058, DATABASE_DESIGN, HOW_IT_WORKS Part 4, RUNBOOKS §4, LAUNCH_PLAN step 1 ✅ + CR 1–2 note.
Evidence (2026-10-25): `npx supabase test db` Files=27 Tests=1516 PASS; `npm test` 203/203; `npm run test:int` 28/28;
format, lint + forbidden, typecheck PASS; `npm run build` + check-bundle ok. **E2E not run locally** (founder DB, no demo
seed) → CI on PR #43. Browser (dev :3000, founder signed in as newtown Owner): newtown `pilot_end` set to today + 2 →
"Free pilot: 3 days left…" in red; set to yesterday → ended banner, "Create batch" refused with the `read_only` message,
no row written, 375 px scrollWidth 375, one H1; `pilot_end` then set back to null (founder data unchanged).
**Unverified:** platform admin pages in the browser (needs the founder's authenticator; E2E covers them in CI).
Known limits (ADR-058): banner mirrors the SQL rule in `lib/pilot.ts`; platform institute page says "AI spent this month"
for a pilot whose budget is its whole life.
Next exact action:
1. `mcp__ccd_pr__get_status` / `gh pr checks 43`: if CI is red, fix on `r18-batch-b`, push; when green, merge (squash).
2. Billing spec (LAUNCH_PLAN "Billing spec — steps 3 + 6"): ask the founder for "ok" on the 4 questions if not answered.
3. Then stop: Batch C (Sonnet, Medium) builds steps 3–9 from the spec, including plan-review fix 4 in `private.read_only`.

## Next exact action (session 53) — history
**State (2026-10-25, end of session 52, Opus, branch `r18-batch-b`, pushed, NO PR yet):** Batch B about half built.
Done:
- **CR 1–2 (commit `8617d24`, green):** migration `20261118000039_ai_budget_fixes.sql`, applied locally. CR 1: `query_embed`
  now has its own daily counter `searches` (limit = student doubts + step-by-step doubts a day) and is refused to staff.
  (The session-49 "pair with tutor calls" idea was dropped: a student can settle their own reservation as `error`, which
  refunds the counter, so any pairing can be looped; a counter is exact.) CR 2: `ai_take` (under the institute lock) and
  `purge_expired` settle `pending` rows older than 1 hour as `error`, cost 0; partial index `usage_records_pending`.
  pgTAP `080_usage` (+7, and two `generate_series` cross-join tests that only ran the RPC once were made lateral),
  `120` expects the new `stale_reservations` key. Evidence (2026-10-25): `npx supabase test db` Files=26 Tests=1479 PASS.
- **Billing spec (steps 3 + 6)** written in `docs/LAUNCH_PLAN.md` "Billing spec — steps 3 + 6" with 4 questions for the
  founder (defaults in brackets). **Founder has NOT answered yet: no money code until they say ok.**
- **Step 1 pilot — WIP, NOT green:** migration `20261118000040_pilot.sql` is **applied to the local DB** (committed as
  WIP in the handoff commit). It adds `institutes.pilot_end` + `expected_students`, `institute_quotas.max_students` /
  `max_staff`, `private.read_only(inst)` (pilot: from midnight IST after `pilot_end`), trigger `guard_read_only` on every
  public table with `institute_id` except usage_records / usage_counters / audit_events (members cannot write; worker and
  platform admins can; an in-progress attempt can still be answered/submitted), seat caps (`seats_full`,
  `guard_seats` on memberships, check in `create_invitation` counting pending invites), `create_institute(..., students,
  ends)` (defaults today + 7; sets caps 10/20, $10 budget, hard stop), `ai_take` = no AI while read-only + a pilot's
  budget window is its whole life. Existing institutes (pilot_end null) are unchanged.
  pgTAP with it: **2 failures** — `010_policy_coverage` test 7 (add `read_only`, `seats_full`, `guard_seats` to the
  definer allowlist) and `070_documents` test 22 ("an alpha chunk cannot point at a bravo document (composite FK)": the
  new BEFORE trigger now runs first — check which error it raises and make the trigger not mask the FK; never weaken the test).
Next exact action:
1. Fix the 2 pgTAP failures; new `supabase/tests/270_pilot.sql`: read-only after `pilot_end` (writes refused with
   `read_only`, reads fine, in-progress attempt answer + submit allowed, new attempt refused, worker/platform admin allowed,
   AI `ai_disabled`), seat caps (11th student invite and membership refused, owner not counted), pilot budget over a month
   boundary, `create_institute` defaults, and a coverage check that every public table with `institute_id` (except the 3)
   has the `guard_read_only` trigger.
2. Web: platform create form (students + end date, prefilled today + 7) → `createInstitute` passes `students`, `ends`;
   institute page edits `pilot_end`, `expected_students`, `max_students`, `max_staff`; platform list column "Pilot ends"
   + section "Ended pilots older than 30 days — delete by hand" (plan-review fix 10, RUNBOOKS line); portal layout banner
   (owner/admin "Pilot: N days left", warning in the last 3 days; everyone "Your pilot has ended…" when read-only);
   `read_only` in `form.ts` NAMED + `flash.tsx`; `seats_full` / `read_only` in people `INVITE_ERRORS` (by message).
   Read `node_modules/next/AGENTS.md` first. Update E2E `portals.spec.ts` for the new create form.
3. Docs: ADR-058 (pilot), DATABASE_DESIGN, HOW_IT_WORKS, LAUNCH_PLAN step 1 + CR 1–2 status.
4. Ask the founder for "ok" on the billing spec questions (they may have answered in chat).
5. `npm run check`, browser check (platform + a pilot institute at 375 px), PR into main, CI green, merge. Stop (Batch C = Sonnet).

## Next exact action (session 52) — history
**State (2026-10-25, end of session 51):** LAUNCH_PLAN **Batch A is MERGED** (PR #42, squash `631aebf`, CI green run 40185000036).
Local DB: migrations 36–38 applied; founder renamed institute `newtown` to display name "Allen" (slug unchanged). Founder is
signed in as Owner in the app's browser pane. Not verified: real Google sign-in, real invitation email (founder's inbox).
Next: **Batch B (Opus, High effort)** from a branch `r18-batch-b` (already created from `main`, holds this handoff):
1. CR 1 students draining the AI budget via `ai_reserve` `query_embed`; CR 2 stuck `pending` reservations (approach in
   LAUNCH_PLAN "Code review findings"). pgTAP for both.
2. Step 1 free pilot (7 days, 10 students, staff cap 20, $10 AI, read-only after, never mid-test).
3. Steps 3 + 6 design: write the short spec for price slabs, account count, billing period, "paid until", payments table, UPI
   flow, renewal and read-only rules IN `docs/LAUNCH_PLAN.md` before any code (ADR-057, PRICING_PLAN §2a); founder reviews it.
Include the "Fixes found in the plan review" items for each step. Quality gate, PR, CI green, merge, then stop (Batch C = Sonnet).
If the session is not running Opus, stop and tell the founder.

## Next exact action (session 51) — history

**Session 51 (2026-10-25, Sonnet): Batch A MERGED — PR #42, squash `631aebf`, CI green (check incl. E2E + secrets, run 40185000036). Next: Batch B (Opus, High): CR 1–2, LaunchPlan steps 1, 3, 6 design.** legal details filled in (`business.ts`), docs updated (ADR-046 Mix amendment, LAUNCH_PLAN statuses), PR #42 opened; E2E tutor fixture fixed (settled usage record), retro UI polish (tab padding, round send button, tile labels, badge spacing). Step 12 owner click-through (founder signed in as Owner, `next start` :3005): Bill, Tests + results rank list, theory check page, Reviews, People, Batches, Subjects, Question bank load with 0 page errors, 1 H1 each; scrollWidth = 375 at phone width on check, results, Bill, Reviews, People, student page, Batches. Mix checked (headless student1, temporary test, closing time moved by hand in a transaction, then all rows deleted): before close "4 / 4" + "per question after the test closes", no key; after close "4 / 4" per question + "Correct answer: B". Not clicked: Google sign-in itself, invitation acceptance. Local `institutes.name` 'newtown' renamed 'Allen' by hand (slug unchanged).
**State (2026-10-25, end of session 50, Sonnet, branch `r17-next`, NOT pushed, NOT merged, no PR yet):** LAUNCH_PLAN
Batch A is about 70% built. Commits on `r17-next` after `3d267f9`: live-site AI guard + log scrub; migrations 36–38 with
code-review fixes 4, 6, 8, 9, 10, 11; worker claim refresh (7); overviews "Beta · Coming soon"; public home page, legal
pages, robots, sitemap. Local DB has migrations 36, 37, 38 applied (`supabase migration up`, no reset).
Built (see `git log --oneline 3d267f9..HEAD`):
- CR 3 `assertLiveAi` (`packages/core/src/demo.ts`, called from `apps/web/instrumentation.ts` and `apps/worker/src/index.ts`).
- CR 5 `details|hint` scrubbed in `packages/core/src/log.ts`.
- CR 4 `batch_standing_count` rpc used by student Home. CR 6 `report_answer` needs a settled tutor usage record + unique
  index on `messages(usage_record_id)`. CR 8 `least(...)` in `grade_objective`. CR 11 "Mix": `get_attempt_review` now returns
  `revealed`, `pending`, `score`; per-question marks null until the test closes (`student-test.tsx`, E2E `assessments.spec.ts`
  updated). CR 7 `setInterval` claim refresh in `apps/worker/src/ingest.ts`. CR 10 `private.purgeable` ignores failed
  `too_large` versions. CR 9 `content` column closed to API users; read via `artifact_content(a)` (studio page, studio actions).
- Step 2 `overviewsEnabled` (on locally or `OVERVIEWS_BETA=true`); tiles disabled with "Beta · Coming soon"; server refuses.
- Step 10 home page `Landing` in `apps/web/app/page.tsx` (root host only), `robots.ts`, `sitemap.ts`, `lib/business.ts`.
- Step 11 five legal pages at `/legal/<doc>` (`apps/web/app/legal/docs.ts`) with PLACEHOLDERS in `apps/web/lib/business.ts`
  (`[business name]`, `[registered address]`, `[phone number]`, `[grievance officer name]`).
Evidence (2026-10-25, before the last two commits): `npx supabase test db` Files=26 Tests=1471 PASS; `npm test` 198/198;
`npm run test:int` 28/28; lint + forbidden, typecheck, format PASS; `npm run build -w @examedge/web` PASS (after the
home page). **Unverified:** home page and legal pages not looked at in the browser; E2E not run (needs `npm run check`;
:3000 may be held by another `next dev`); `OVERVIEWS_BETA` tile look; `docs` not updated (ADR for Mix/ADR-046 change,
LAUNCH_PLAN statuses, HOW_IT_WORKS result page text).
Next exact action:
1. Get from the founder: business name, registered address, phone, grievance officer name (founder may name themselves;
   email stays support@examedgeai.in). Put them in `apps/web/lib/business.ts`.
2. Look at `/` and `/legal/privacy` at 1280 and 375 px in the browser (root host `localhost`, e.g. preview `web-prod-3005`
   after rebuild); check one H1, title/description lengths.
3. LAUNCH_PLAN step 12: click through owner Bill page, test runner, results (new Mix text), theory checking, Reviews, Contest.
4. Docs: add the "Mix" change to DECISIONS.md (next to ADR-046), mark CR 3–11 and steps 2, 10, 11 done in LAUNCH_PLAN,
   update HOW_IT_WORKS result text.
5. `npm run check` full gate, push `r17-next`, open PR into main, CI green, merge. Then stop: Batch B (Opus) is next.

## Next exact action (session 49) — history
**State (2026-10-24, end of session 48):** **PR #41 MERGED** (squash `f1b9d3f` on main, CI green: check + secrets, run
40065062694 — E2E incl. axe passed after fix `997ae8b`: lighter `--good-soft #f0f8f3` / `--warn-soft #fdf5e8` /
`--bad-soft #fcf1ef` so the brighter status text stays ≥ 4.6:1, and `role="img"` on the Home level bar). Founder: "UI is
final for now." Checked-out branch: `r17-next` (from main, holds only this handoff). `r16-fun-ui`, `r16-violet`,
`r16-saffron` stay local, superseded; `r16-mono` is merged.
What #41 contains:
- Staff (owner/admin/teacher): black-and-white "mono" look — compact top bar replaces the sidebar (portal
  `layout.tsx`: `<header className="side">`, name · role + Sign out on the right), Inter text, IBM Plex Mono labels and
  numbers, white boxed sections with small uppercase mono titles, full screen width (founder: "remove blank space on
  sides"; platform page width cap removed too).
- Students: same layout as a retro desktop window (`.shell[data-look='retro']`): striped title bar with the institute
  name, 2 px black borders, grey offset shadows, Silkscreen bitmap headings/labels/buttons, section `h2` = window title
  bar. Student Home rebuilt to the mock: greeting + "N tests coming up" + batch badge, 4-number band (streak, XP, level
  bar, overall rank "of N" from a `batch_standings` count), "Today's goal" window (0/3 + pixel hearts), Upcoming tests,
  My progress (#rank + %), letter subject tiles. Removed from Home: 7-day strip, ticker, at-a-glance hero, results
  list (`week()` in `lib/streak.ts` stays, unit-tested).
- Founder follow-ups done: status pills = coloured text + dot only, slightly brighter (`--good #15803d`, `--warn-ink
  #9a6206`, `--bad #c2362a`, Draft `#66666d`, all AA ≥ 5:1); padding inside every badge; Bill page numbers and the
  progress Summary (one band per batch, batch name above when >1) use the ruled `.stats` band; stat labels wrap.
- Fonts in `app/layout.tsx`: Inter, IBM_Plex_Mono, Silkscreen, Source_Serif_4 (Anton / Space_* removed). All theme CSS
  is the "Mono theme" + "Retro" block at the END of `globals.css` (the Space theme block was replaced).
- Evidence (2026-10-23/24, `r16-mono` up to `42a557c`): `npm run format:check` ok, `npm run lint` ok, `npm run
  typecheck` ok, `npm test` 195/195 passed, `npm run build -w @examedge/web` ok; browser check on `next start`
  (launch config `web-prod-3005`) at 1280/1600 and 375 px: student Home, My progress, teacher Dashboard / Tests /
  People / Question bank / Subjects / student page, no page-level horizontal scroll at 375.
- E2E + axe: PASSED in CI run 40065062694. **Unverified:** owner Bill page in the new look (no `.test` owner login;
  founder signs in with Google) — ask the founder to look. Test runner, results, sign-in, check page, Reviews, Contest
  in the new look not clicked through. E2E `usage.spec.ts` expects the tokens figure text `/^[\d,]+ tokens$/` — kept
  (`1,234 <small>tokens</small>`).
- Pricing (no code): founder's working plan saved in `docs/PRICING_PLAN.md` (`041cd8b`): Mini ≤150 ₹19,999, Basic
  ≤300 ₹34,999, Pro ≤600 ₹59,999, Scale 1,000+ ₹89/student (floor ₹79), yearly = pay 10 get 12, budget = students ×
  $0.55–0.60 + $31, 15 doubts / 5 generations a day. Founder: "don't build anything for now, I will handle this."
- Session 48 Q&A (no code): founder's free-pilot idea and launch money saved in `docs/PRICING_PLAN.md` §10–11
  (`acd8569`): pilot = status `pilot`, 14 days, 10 students, same Claude AI (not free Gemini: ADR-051 data rule),
  $10 budget, read-only after day 14, student count asked at pilot start; then Bill page "Choose a plan" + Razorpay
  in test mode. First 2 months with no clients ≈ ₹10–15k (domain, Vercel Pro, Supabase free→Pro, Railway Hobby,
  $20 Claude credits); only paid AI key = Anthropic (Haiku / Sonnet / Opus); voice for audio/video stays the free
  browser voice (Sarvam later, founder's decision). Founder: nothing to build yet.
- Session 49 (2026-10-24/25, docs only, no code): founder's launch order saved in `docs/LAUNCH_PLAN.md`; pricing v2 =
  price per account in slabs, teachers charged too (ADR-057, `docs/PRICING_PLAN.md` §2a). Pilot changed to 7 days,
  10 students, unlimited teachers/admins. All session Q&A saved in LAUNCH_PLAN "Session 49 notes". Audio/video overviews stay
  local Beta (hidden from real users, LAUNCH_PLAN step 2). Payment by UPI checked by hand until Razorpay (step 7,
  founder's yes pending). A first pilot-rules migration was written, applied locally, then fully undone at the
  founder's request (local institutes back to `pilot`, migration row removed). Nothing to build until the founder says go.
  2026-10-25: founder said yes to UPI payment by hand and that step 1 (pilot) is next, but "don't build it now".
  Plan review fixes 1–10 are in LAUNCH_PLAN "Fixes found in the plan review".
  Same day: full code review (server code + all migrations read; pages' layout not reviewed): findings 1–10 in
  LAUNCH_PLAN "Code review findings", with the fix approach. Founder: "fix 1 to 10", then "work for the next
  session" — NOTHING built; the few started edits were reverted. Next exact action (session 50, founder runs it on SONNET, Medium effort): build LAUNCH_PLAN "Build order by model" BATCH A only
  (CR 3–11, steps 2, 10, 11, 12; CR 1–2 are Opus, Batch B) on `r17-next` — ask the founder at the start for the
  legal page details (business name, address, phone, complaints contact); other decisions are saved in LAUNCH_PLAN
  ("yes to all" 2026-10-25: 3-day grace, top-up ₹2,500 = $20, staff 30 doubts/day, pilot staff cap 20) (pgTAP for 1, 2, 4, 6, 8, 10; unit for 3, 5), quality gate, PR; then ask the founder
  before starting LAUNCH_PLAN step 1.
1. Ask the founder what to build next. Open ideas (founder's word needed): plans table + Bill page showing plan,
   student count, monthly / yearly price (design explained in session 48, nothing built; prices in
   docs/PRICING_PLAN.md — founder said "I will handle this"); Dashboard number cards as the `.stats` band; go-live
   accounts (Phase 10 cloud, needs founder approval and money).
2. New work goes on `r17-next` (or a new branch from main); push it and open a PR when green.
- Demo logins (localhost, "Demo user email", no password): students `student1@newtown.test` (Riya Sharma),
  `student2@newtown.test` (Aman Singh, has results), `priya.sharma@`, `rohan.mehta@`, `sneha.patel@`,
  `vikram.singh@newtown.test`; teachers `teacher.jee@newtown.test`, `teacher.neet@newtown.test`; owner = founder's Google.
- Dev servers: another chat's `next dev` holds :3000 for this folder (a second `next dev` refuses to start); this
  session used `npm run build -w @examedge/web` + preview `web-prod-3005` (`next start -p 3005`). The old :3002
  `next start` may serve stale/unstyled pages after rebuilds.

## Next exact action (session 48) — history
**State (2026-10-23, end of session 47):** PR #40 MERGED (main = `707294d`, CI green). Nothing failing on main.
**Checked-out branch: `r16-fun-ui` — LOCAL ONLY, never pushed (founder: "commit locally so if I don't like it I can use
the current version"). Do NOT push or merge any `r16-*` branch until the founder says so.**
- `r16-fun-ui` (head = this handoff commit; based on `95abc4a` = old r15-next, so it does NOT contain main's squash
  `707294d`, same content): gamified student Home (`lib/streak.ts` streak/week/XP/level from own doubts, study tools,
  test attempts, IST days, no DB change; daily goal ring of 3 actions; last-7-days strip; one big Start button; HUD
  pills; scrolling ticker; subject tiles with emoji) + "Space theme" CSS block at the END of `globals.css` (dark
  starfield, one accent token `--lime: #d4ff6b`, Anton titles, Space Mono labels, Space Grotesk text; fonts in
  `app/layout.tsx`). Delete that CSS block to return to the old workbook look.
- `r16-violet` (`--lime: #b79cff`) and `r16-saffron` (`--lime: #ffb547`, streak coral `#ff7a90`): one-line accent trials.
  Claude recommended lime (violet = Byju's purple; saffron clashes with warn/streak). Founder has NOT chosen.
- Older looks: `d5b4eac` = bright "Play" version (Nunito, chunky light buttons); `r15-next` / main = old workbook UI.
- **Founder: "my friend didn't like the UI, he will be suggesting the UI."** Wait for the friend's suggestions
  (screenshots/references, which screen and why). Build them on a NEW local branch from `r16-fun-ui` (keep the
  streak/XP/goal logic, it is look-independent), show screenshots (student Home 1280 + 375) before restyling more.
- Not done / unverified on `r16-*`: E2E + axe (CI only, branch not pushed), test runner page, results page, sign-in
  page, owner pages and teacher check page in the new theme; Playwright `toHaveText` on capitalised subject tiles
  should still pass (CSS `text-transform` does not change textContent) — confirm in CI before any merge.
- Before any `r16-*` PR: rebase/merge onto main (`707294d`), run the full gate (`npm run check`), then PR.
- Dev servers: the other chat's `next dev` on :3000 returns 500 for the new Google fonts (Turbopack "Can't resolve
  @vercel/turbopack-next/internal/font/google/font") until restarted; `npm run build` is fine. This session checked
  pages on `next start` (launch config `web-prod-3001`, got :3002) — rebuild AND restart it after CSS changes
  (a rebuild under a running `next start` serves unstyled pages).
- Demo sign-in for the founder (localhost only): `student1@newtown.test` (Riya Sharma) or `student2@newtown.test` in
  the "Demo user email" box, no password.
- Open topics from session 46 still stand (friend as platform admin, go-live accounts need the founder's go-ahead).

## Next exact action (session 47) — history
**State (2026-10-20, end of session 46):** main = `de1d810`. **PR #40** (`r15-next` → main, https://github.com/khushpal-cipher/ExamEdge_ai/pull/40)
is OPEN, CI green (2 checks), mergeable, Auto-fix on, waiting for the founder's "merge". It holds: ADR-055 (owner/admin Bill
page shows AI tokens + requests per feature, ₹ stays, dollars hidden), the step-by-step limit removed from the platform
limits form (`student_daily_premium_messages` column and API `premium` flag stay), and PROGRESS / prompt notes. Nothing
failing, nothing half-built. Untracked and NOT to be committed: `docs/PROGRESS_REPORT.md` / `.html` (founder's report to
their sir), `.freebuff/` (not ours).
**Founder's go-live questions (session 46, no code):** hosting = Vercel (Pro, or its 14-day free Pro trial; Hobby is
non-commercial), DB/auth/files = Supabase Pro (Mumbai), worker = Railway; Cloudflare is optional (domain/DNS only; hosting
the Next.js app there is untested and would need an ADR). Domain `examedge.in` not bought yet. Cost for ONE institute of
~150 students: about ₹12–15k a month (AI ~$85 typical, capped by the budget; infra ~$55–70). Break-even about ₹100 per
student; suggested pilot price ₹99–149 per student, charged in advance. Suggested limits per institute: budget ≈
students × $0.35 + $35 (+20%) → $100 for 150; doubts 10/day, generations 5/day. Still blocking launch: Q-01 legal opinion,
Q-08 Voyage terms, production accounts (need the founder's go-ahead), restore drill, load test, rollback test. None of
the production accounts exist yet.
0. If the founder says "merge #40": `gh pr merge 40 --squash` (CI is green), then `git switch main && git pull`.
1. `git switch main && git pull`, then a new branch (e.g. `r16-next`) for new work; `docker info`; `supabase status`
   (never `db:reset` without asking: it holds the founder's test institutes newtown / vedam / asjdfl). Local DB has
   migrations up to 35 (`studio_repeat`, applied with `supabase migration up`).
2. Local dev: `npm run dev` reads `apps/web/.env.local` with `AI_PROVIDER=gemini` + `GEMINI_API_KEY` (never print it;
   test institutes only, ADR-051). Worker: `WORKER_DATABASE_URL=postgresql://worker:worker_local_only@127.0.0.1:54322/postgres
   npm run dev:worker` (notes processing / OCR). Both die with the session; restart them if the founder tests AI.
3. VERIFIED by the founder in the browser (2026-10-19, session 46): student Smart Study tiles, Beta badges, repeat make. (Old note: check in the browser when convenient, browser pane must be VISIBLE or pages freeze while
   a form is pending): as a student (e.g. Aman Singh, newtown): Smart Study tiles show "Making your practice quiz…" while
   generating, Beta badges on Audio/Video overview, a second click on the same tile makes a new quiz (lists show times).
4. Ask the founder what to build next. Open topics: (a) friend `aaradhychinche@gmail.com` as platform admin — he signs
   in once at http://admin.localhost:3000 (Google), then `insert into private.platform_admins (user_id, granted_by)
   select id, 'founder' from auth.users where email = 'aaradhychinche@gmail.com'`; he scans the MFA QR with HIS phone;
   remote access needs a deployment (Phase 10, founder approval). (b) Teacher theory-checking page changes, if any.
   (c) Needs founder decision/money: paid voice (Sarvam), real MP4 video, Voyage embeddings (Q-08), deployment.
   (d) Optional: retry AI generation once when a formula is broken (now flag only, ADR-054).
5. Local `npm run test:e2e` stays BLOCKED (no `demo` / `rival` institutes locally; seeding needs `db:reset`); CI runs
   e2e on a fresh database. Unit 189 and pgTAP 1459 pass locally.

## Session 46 (2026-10-20) — tokens on the Bill page (ADR-055), branch `r15-next`
- Founder asked for the AI tokens an institute used to show on the owner/admin Bill page. Built: `/usage` now shows
  "AI used this month" (tokens + requests) and a table "Where the AI was used" (requests, tokens per feature); ₹ charge
  and AI on/off stay; dollars still hidden. Changes ADR-041 part 2 (ADR-055). Reuses `usage_summary`, no migration.
  `e2e/usage.spec.ts` now expects the tokens card and no `$` (was: no tokens).
- Evidence (2026-10-20): `npm run format:check`, `npm run lint` (check-forbidden ok), `npm run typecheck` ok; `npm test`
  189 passed. NOT run: `npm run build` (another session's `next dev` on :3000 uses `apps/web/.next`), `test:e2e` (needs
  seeded demo; CI), browser check (newtown's only owner is the founder's real account; open http://newtown.localhost:3000/usage
  as that owner to look).
- Also this session: go-live checklist and cost/pricing talk (no code); `docs/PROGRESS_REPORT.md` / `.html` (founder's
  report to their sir, untracked, not committed).

## Session 45b (2026-10-19) — AI progress, formula check, Beta, repeat study tools (ADR-054), branch `r15-next`
- **MERGED** (founder's yes, 2026-10-19): PR #39 squash-merged into main as `de1d810`; CI green (check 5m11s incl. e2e, secrets).
- Founder asked: (1) flag AI questions whose formula cannot be drawn; (2) a NotebookLM-style "making it" state on every
  AI feature; (3) Beta on audio/video overview; (4) students make a study tool again until the AI limit.
- Built: `lib/markdown.ts` `brokenMath` / `questionTexts`; `addAiQuestions` flags on save (`ai_questions_formula`),
  badge "formula broken, fix before use", Approve hidden + `approveQuestion` refuses (`formula_broken`);
  `app/(portal)/making.tsx` on the 6 study tiles, Add questions with AI, Write notes with AI (buttons disabled while
  pending); `BETA_KINDS` badges; migration 35 `studio_repeat` drops the per-student unique index, `studio/actions.ts`
  reuses only for staff, student lists show the time each was made. pgTAP 110 + e2e studio.spec updated (ADR-054).
- Evidence (2026-10-19): `supabase migration up` applied 35 locally (no reset); `npm run test:db` 1459 PASS; `npm test`
  189 passed; format, lint (check-forbidden ok), typecheck ok; `npm run build` + check-bundle ok. Browser (teacher,
  newtown topic page, POST blocked so no AI spend): "Making your notes…" with spinner, button disabled.
- Unverified locally: student tiles + Beta badges in the browser (needs a student login), e2e BLOCKED locally (CI).

## Session 45 (2026-10-19) — KaTeX formulas (ADR-053), branch `r15-next`
- **MERGED** (founder's yes, 2026-10-19): PR #38 squash-merged into main as `5cb5327`; CI green (check 5m48s incl. e2e, secrets).
- Founder saw AI quiz text like `$20\text{ N}$` and said "install it". `katex@0.19.0` added to `apps/web` (dev tool
  rule: free, MIT, logged in DECISIONS ADR-053). `lib/markdown.ts` typesets `$…$` / `$$…$$` (`trust: false`,
  `throwOnError: false`); new `MathText` (inline) and `clip` (labels that never cut a formula). Stems, options, model
  answers and explanations now go through it in: student test runner + result review, Studio quiz + artifact page,
  question preview dropdown + bank list, teacher check page. `katex.min.css` imported in `app/layout.tsx`.
  `scripts/check-forbidden.ts` exempts only `apps/web/lib/markdown.ts` from the `dangerouslySetInnerHTML` ban.
- Evidence (2026-10-19): `npm run format:check` ok; `npm run lint` ok (check-forbidden ok); `npm run typecheck` ok;
  `npm test` 188 passed (T-SEC-19 / T-AI-09 now check every tag + attribute, allow-list outside KaTeX output);
  `npm run build` ok + check-bundle ok. Browser (newtown, NEET Physics Quiz 1 test page): 165 `.katex` nodes, 0
  `.katex-error`, KaTeX_Main font loaded, options show "24 N", collapsed titles contain no raw `$`.
- BLOCKED locally: `npm run test:e2e` (as before, needs `db:reset`); CI runs it. pgTAP untouched (no SQL change).
- Not done: formulas are not compiled on save (AI_PIPELINE "Formulas" check still open); `<option>` labels in "Add from
  the bank" stay plain text (native select cannot show math).

## Next exact action (session 46) — history
**State (2026-10-19, session 45):** main = `5cb5327` (PR #38 KaTeX formulas, ADR-053, merged). Before that main = `be6e77c` (PRs #35 UI redesign + ADR-050, #36 Gemini test provider +
tutor chat box, #37 AI question dropdown + Approve, all MERGED with founder's yes, CI green). Branch `r15-next`
(`47cea0b` + this handoff) holds only PROGRESS / prompt notes; no PR opened for it (docs only: merge it with the next code
PR or open a tiny PR). Nothing failing, nothing half-built.
1. `git switch main && git pull`; `docker info`; `supabase status` (never `db:reset` without asking: it holds the founder's
   test institutes newtown / vedam / asjdfl). Local DB has migrations up to 34 (`gemini`).
2. Local dev: `npm run dev` reads `apps/web/.env.local` which now has `AI_PROVIDER=gemini` + `GEMINI_API_KEY` (never print
   it; test institutes only, ADR-051). Worker: `WORKER_DATABASE_URL=postgresql://worker:worker_local_only@127.0.0.1:54322/postgres
   npm run dev:worker` (needed for notes processing / OCR). Delete the `AI_PROVIDER` line to go back to demo AI. Both
   processes die with the session; restart them if the founder tests AI features.
3. Ask the founder what to build next; likely topics they raised: (a) their friend `aaradhychinche@gmail.com` as platform
   admin — he signs in once at http://admin.localhost:3000 (Google) on the founder's Mac so his account exists, then
   `insert into private.platform_admins (user_id, granted_by) select id, 'founder' from auth.users where email =
   'aaradhychinche@gmail.com'`; he scans the MFA QR with HIS phone (never the founder's). Account did not exist on
   2026-10-19. Remote access for him needs a deployment (Phase 10, founder approval needed for accounts/hosting).
   (b) the teacher theory-checking page: it already lists every student's answer per question (Q1–Q5 tabs, model answer,
   marks + comment, hide names) — founder saw it with 5 students; ask if they want changes (e.g. all answers of one
   student, bulk marks). (c) Not built, needs founder decision/money: paid voice (Sarvam), real MP4 video, Voyage
   embeddings (Q-08), deployment (Phase 10).
4. Local `npm run test:e2e` stays BLOCKED (no `demo` / `rival` institutes locally; seeding needs `db:reset`); CI runs e2e
   on a fresh database. Unit 185 and pgTAP 1459 pass locally.

## Session 44d (2026-10-19) — theory checking demo, local data only (no code, nothing committed)
- Founder asked how a teacher checks theory answers with 5+ students. The existing page
  `/tests/[id]/check` already does it, so no code was written. For the demo, 4 students were added with a one-off script
  (kept outside the repo): priya.sharma, rohan.mehta, sneha.patel, vikram.singh `@newtown.test` (demo login, in neet 2027,
  joined 3 days ago) with attempts on "NEET Physics Quiz 1": MCQs auto-marked (scores 36 / 32 / 16 / 12 of 65), 5 theory
  answers each of varying quality, left unmarked. Aman Singh's 5 theory answers are placeholders already marked 0, so the
  page shows "5 of 25 checked" and Release / Recalculate stays disabled until the founder marks the other 20.
- Browser check (teacher.neet, 1280 px): Q1 tab shows the question, model answer and all 5 students' answers with marks box,
  comment box and Save each.
- Other founder answers this session: why "ccc" is not on Aman's class 10 Contest (he was moved to class 9 → class 10 is a
  past batch); how to make a batch past (Batches → batch → Move students, owner/admin only).

## Session 44c (2026-10-19) — local test data on newtown (no code)
- neet 2027 · physics: topics "Laws of Motion" and "Work, Energy and Power", each with Gemini-written notes from a
  teacher explanation (AI notes, ADR-039), published to neet 2027 (worker chunked them: 30 and 33 chunks).
- Test "NEET Physics Quiz 1" (id `df59ffa8-bf10-40ca-87d0-b2aa5517fc68`): 10 MCQ + 5 theory made with AI (Gemini),
  CBT on, opens 19 Oct 15:00, closes 20 Oct 22:00 IST, 60 min; all 15 approved via the new dropdown (8 answers-match,
  2 answers-differ checked by hand — keys right: 6√2 m/s², 6mg — and 5 theory → teacher_verified); scheduled; shows on
  student2 (Aman Singh) Contest → Upcoming. One duplicate notes draft made by a double submit was deleted.
- Founder Q: "ccc" not visible to Aman in class 10 — by design: he was moved to class 9 at 10:19 IST (class 10 became a
  past batch); "ccc" opened 14:02, after he left.

## Session 44b result (2026-10-19) — branch `r14-approve`
- `questions/question-preview.tsx` (new): `<details>` per test question; `staff-test.tsx` uses it and now also reads
  options, explanation and `question_keys(key, second_solve)` (staff only, RLS). `approveQuestion` sets
  `teacher_verified` when the form says `checked` (sent only by the dropdown for differ / not-checked drafts).
  `e2e/question-gen.spec.ts` approves via the dropdown (the flagged MCQ too).
- **Evidence:** `npm run format:check`, `lint`, `typecheck` clean; `npm test` 185 passed; `npm run test:db` Files=26
  Tests=1459 PASS (rolled back, no reset). Browser: newtown test "hb" as teacher.jee, dropdown opens with options,
  correct answer marked, explanation, Edit, at 1280 px. Approve on a draft not clicked locally (newtown has no AI drafts);
  the e2e covers it in CI.

## Next exact action (session 45) — history
**State:** PR #35 MERGED into main 2026-10-19 (founder said yes), squash commit `3482e3e`. Branch `r13-gemini` has main
merged in (`9757440`) and its PR into main is open (Gemini + chat box). Local DB has migration 34 (`gemini`) applied with
`supabase migration up` (no reset).
1. Check the `r13-gemini` PR's CI (`gh pr checks`), fix until green, then ask the founder before merging.
2. Try Gemini in the app: founder adds `AI_PROVIDER=gemini` to `apps/web/.env.local` and restarts `npm run dev` (and
   `npm run dev:worker` for OCR / uploads); then click tutor, the 6 Smart Study tools, AI notes, AI questions and a test
   plan on newtown and record results. Only local test institutes (ADR-051 data rule).
3. Local e2e is BLOCKED: the local DB has no `demo` / `rival` institutes (seed needs `npm run db:reset` first, which
   would wipe newtown/vedam/asjdfl, so ask before). CI runs e2e on a fresh DB.

## Session 44 result (2026-10-19) — branch `r13-gemini`
- **Gemini test-only provider (ADR-051), `9373f03`:** `packages/core/src/ai/gemini.ts` (REST + fetch, no new
  dependency) for tutor, 6 studio kinds, OCR, questions (writer 3.8-flash, blind solver 3.5-flash-lite), AI notes and
  test plan; `routing.ts` models `gemini-3.8-flash` / `gemini-3.5-flash-lite` provider `google` at cost 0; migration
  `20261115000034_gemini.sql` (usage_records provider check + 'google'); forbidden-pattern rule now also covers
  `generativelanguage.googleapis.com`; `.env.example` + `GEMINI_API_KEY`. Facts checked on ai.google.dev 2026-10-19:
  models list, pricing (these three are free; free-tier content is used to improve Google products), models.get
  output limit 65,536. Free-tier rate limits only visible in AI Studio [U].
- **Live check with the founder's key (2026-10-19, direct provider calls, not through the app UI):** tutor (cited [0]
  → "notes" label), summary, flashcards, mind map, quiz, audio overview, video overview (general mode, all passed
  `validateArtifact`), test plan (`checkPlan` ok), question writer (DRAFT_SCHEMA ok), AI notes, OCR of a test PNG — all
  OK. Found and fixed: Gemini rejects some schemas with `maxItems` (400) → stripped before sending; 3.8-flash
  returned 503 once → one retry.
- **Tutor chat box (founder):** composer sticks 16px above the bottom of the screen, Enter sends, round send-arrow
  button (aria-label "Send"); "Ask" and "Solve step by step" buttons removed (founder: same output; students can ask
  for steps in words; `/api/tutor` keeps `premium` defaulting to false); page scrolls to the newest message.
  Checked in the browser on newtown at 1280 and 375 px.
- **Evidence:** `npm test` 185 passed (incl. 7 new `gemini.test.ts`); `npm run typecheck`, `npm run lint`
  (check-forbidden ok), `npm run format:check` clean; `npm run secrets` git history clean (dir hits only in ignored
  `.env*` and `.next/`). `npm run test:db` and local `test:e2e` NOT run (e2e BLOCKED, see above).

## Next exact action (session 44) — history
**State:** branch `r13-ui`, PR #35 open (https://github.com/khushpal-cipher/ExamEdge_ai/pull/35), Auto-fix on, CI green
on `37d9f5f` (run 39202529367). Founder has NOT said "merge". Local DB has migration 33 (`overviews`) applied.
1. `git checkout r13-ui && git pull`; `docker info`; `supabase status`; `gh pr checks 35` (the handoff commit runs CI
   again; fix any failure without weakening a test).
2. Ask the founder: "merge #35?" (UI redesign + ADR-050). Merge only on their yes (`gh pr merge 35 --squash`), then
   record the merge commit here.
3. Founder's next topic (session 43 talk): a **free Gemini API key for testing only**. When the founder says the key is
   in `apps/web/.env.local` as `GEMINI_API_KEY` (never in chat, repo is public): add a DECISIONS entry (Gemini =
   test-only provider, free tier may train on inputs → only local test institutes, never real student data; paid
   Claude stays the production plan), verify Gemini's current free-tier models/limits/SDK on Google's official docs
   (mark [U] until checked; use `source-driven-development`), then add `AI_PROVIDER=gemini` behind the gateway in
   `packages/core/src/ai` (the only place allowed to import an AI SDK; `scripts/check-forbidden.ts` rule
   `provider-sdk-outside-gateway` must be updated for the new SDK) for tutor, studio (6 kinds), notes, questions/plan,
   OCR; meter it like Claude (cost 0 on free tier); unit tests with a recorded reply (no key in CI); then click every
   AI feature on newtown with the key and record results.
4. Not built (founder decides later, needs money/approval): paid voice (Sarvam Bulbul v3, ₹30 / 10k chars [V]),
   real MP4 video (slides + voice joined with ffmpeg; Claude-drawn diagrams instead of an image AI), Voyage
   embeddings (Q-08). Founder said browser voice is "okay okay" and will move to a paid voice.

## Session 43 result (2026-10-19) — all on `r13-ui` / PR #35
- `a98d60c` page pass: own 404 page, result-page options as rows, styled file picker.
- `dcf3383` CI fix: page `rise` animation faded text → axe colour-contrast failed 4 E2E; now movement only.
- `740a016` founder UI refine from a 21st.dev reference (own palette kept): raised surfaces, button depth, glow,
  entry grid, staff phone menu (`(portal)/main-nav.tsx`), Google "G" button, practice/doubt lists as tables,
  page titles "Page · ExamEdge AI".
- `6132d60` ADR-050: Smart Study tools work without notes (general knowledge, labelled), Audio overview + Video
  overview (narrated slides) read by the browser voice; migration 33.
- `37d9f5f` ADR-050: tutor answers from general knowledge when no notes match (`tutor-v4`), labelled.
- Founder checks: owner Batches/People were fine (founder misread; temporary owner used to check → deleted).
  Founder listened to audio/video overviews: works; wants a paid voice later; understands video = narrated slides
  until a renderer is built.
- Explained to founder (no code): AI services to buy (Anthropic first; Sarvam voice; Voyage; no image AI needed;
  ffmpeg/Remotion for MP4) and that a free Gemini key is fine for testing only.
- Evidence: see Completed rows dated 2026-10-19 (session 43). Last full local gate on `37d9f5f`: format, lint +
  forbidden, typecheck PASS; unit 178/178; int 28/28; pgTAP Files=26 Tests=1459 PASS; build + bundle ok.

## Session 42 result (2026-10-19) — polish steps 1–6 built on `r13-ui`, commit `8ebab56`, PR #35
- Done: step 1 light only; step 2 type scale (16/15/14/13 px, h2 22, h3 18, h1 32–44, stat 36, no 650 weight);
  step 3 spacing (root cause of "too close": `div.inline` field rows had no CSS — `.inline` now styles any element,
  20 px gaps; forms 560 px; 48 px between sections; 14 px table cells; hint next to "Create test" in a `.row`);
  step 4 sidebar (248 px, 40 px logo, 44 px nav items, full-width Sign out, 24 px bottom padding; 768 px keeps the
  phone layout — checked by screenshot, no overflow); step 5 `.danger` red-outline on 13 destructive buttons
  (class only), 12 px gap in button rows, runner "Submit test" right-aligned under Previous/Next on desktop;
  step 6 content max 960 px.
- Evidence (2026-10-19, on `8ebab56`): `npm run format:check` PASS, `npm run lint` PASS, `npm run typecheck` PASS,
  `npm test` 163/163 PASS, `npm run build` PASS + check-bundle ok. Screenshots 375/768/1280 light of student Home,
  Contest, My progress, Review and staff Tests, Batches, Question bank, People: `scrollWidth` = viewport on all.
- **Not done / unverified:** numbers right-aligned in tables (`td.num`) and Contest "Results" rows (student1 is now
  in jee 2027 with no tests, so the list could not be seen); test runner, result page, check-answers, documents,
  bill and platform pages not screenshotted (step 7); E2E not run locally (:3000 is the founder's `next dev`) → CI.
- Founder follow-up (same session): text boxes grow with typing (3 lines min, `field-sizing`), 40 px buttons/inputs,
  styled dropdown (own chevron; Chrome `appearance: base-select` list) — `13b05cf`. Then founder said "make your
  changes, I will tell you to undo": Home "at a glance" band (next test / overall rank / last rank), dashed centred
  empty states, subject letter marks, table status = dot + word, numbers right-aligned (Tests, test results,
  standings), short confirmations as a fading toast (long ones stay), page rise + meter fill motion (off with reduced
  motion), entry page mint background + rule under the name. Gate PASS (format, lint, typecheck, unit 163, build).
  If the founder dislikes one, revert just that part.
- Next: step 7 page pass on the remaining pages, then step 8 (CI on PR #35, ask the founder "merge #35?").

## Next exact action (session 42) — history
**State:** `r13-ui` pushed, **PR #35 open** (https://github.com/khushpal-cipher/ExamEdge_ai/pull/35), Auto-fix on;
founder has NOT said "merge". Founder palette `#3368A0/#66A3BF/#C8DFDB/#F2EFE7` + Plus Jakarta Sans / Source Serif 4
are approved. Founder review (2026-10-19, screenshots of Tests, Contest, platform Institutes, staff pages): "keep the
**light theme**; the font style, font size, the sidebar and the place of buttons are not perfect; things are too
close to each other." Fix all of it on `r13-ui` (same PR), CSS + markup only, keep every E2E role/label and the
`.stat` / `.side` classes. Do the steps in order; after each, screenshot at 375 / 768 / 1280 (light only) with the
Playwright pattern below, fix, run format + lint + typecheck + build, commit, push.

Step 1: Light theme only — delete the `@media (prefers-color-scheme: dark)` block in `globals.css`, set
`color-scheme: light` on `:root`, update ADR-049 ("light only, founder").
→ Model: haiku → Effort: low → Why: delete one block + doc line.

Step 2: Type scale and font sizes. Body 16 px (line-height 1.6); UI text in tables, lists, labels 15 px; captions
and hints min 14 px (no 12–13 px except badges at 13 px); `th` 13→14 px semibold, sentence case; h2 22 px, h3 18 px;
page h1 serif 40–44 px desktop / 32 px phone; breadcrumb ("Batches", "Tests" above titles) 14 px muted, not tiny blue;
stat numbers 36 px. Check Plus Jakarta weights: only 400/500/600/700 used, no 650 (snap to 600).
→ Model: opus → Effort: high → Why: sets the visual system every later step depends on (founder's main complaint).

Step 3: Spacing system. Use the `--s*` scale everywhere: form fields 20–24 px apart (label→input 8 px, field→next
label 20 px — today forms put fields in nested grids/inline divs so the `form.stack` gap does not reach them; fix by
`label + label`, `.stack > label` margins or wrapping fields), 24 px between the last field and the submit row;
submit button never touches an input (platform "Create institute", Tests "Create test"); hint text after a button
gets 12 px gap or goes on its own line below; section rhythm: 48 px between sections, 16 px under each h2; cards
padding 24 px desktop / 16 px phone; table cell padding 14 px vertical.
→ Model: sonnet → Effort: medium → Why: mechanical CSS once the scale exists; verify every form page.

Step 4: Sidebar. Width 248 px; brand block with 40 px logo; batch switcher compact (label above a 40 px select, 24 px
below it); nav items 44 px tall, 15 px, 4 px gap, active = mint fill + 3 px blue bar (keep); bottom user block: name,
role and a full-width quiet "Sign out" with clear space (dev-only Next indicator overlaps it — not a bug, but leave
24 px bottom padding); phone: top bar brand + Sign out, nav as scrolling tabs, batch row — check at 375 and 768
(768 should still be the phone layout or a narrow 200 px sidebar, decide by screenshot).
→ Model: sonnet → Effort: medium → Why: one component, visible on every page.

Step 5: Buttons and their placement. Rules: one primary per page section; page actions sit next to the title on the
same baseline (not floating far right on wide screens — keep `.top` within the content width); secondary = mint fill
+ blue text (keep), destructive actions (Turn AI off, Delete, Withdraw) get a red-outline style `.danger` (markup:
add the class only, no logic); inline forms (`form.inline`: "₹ per US$" + Save rate, New subtopic + Add) align
input and button bottoms at the same 44 px height; button groups 12 px apart; `Export CSV` next to its table heading;
"Previous / Next / Submit" in the runner: Submit sits at the right of the nav row on desktop.
→ Model: sonnet → Effort: medium → Why: needs judgement page by page; no logic change.

Step 6: Content width and lists. Main content max 960 px; forms max 560 px; text lines ≤ 72ch; lists like Contest
"Results" become rows with dividers, title left + score/rank right but within 760 px so they do not drift apart on
wide screens; tables keep full section width, numbers right-aligned (`td.num`/th classes in markup where numeric).
→ Model: sonnet → Effort: medium → Why: layout per page, markup classes only.

Step 7: Page pass — every page at 375/768/1280 light: student Home, Contest, My progress, Review, subject, topic
(Subtopics + Smart Study tiles + tutor), test runner (temporary copy of "jhj" via SQL, delete after; tests count must
stay 10), result page; staff Dashboard, Batches, batch page, Subjects, topic, Tests (new + draft + check answers),
Question bank + edit, People (3 tabs), Documents/notes, student progress, Reviews, Bill; platform Institutes
(admin.localhost, needs founder MFA → check markup by CSS only or ask founder for a screenshot); sign-in, invite.
Fix what the shared CSS misses; send the founder before/after screenshots.
→ Model: sonnet → Effort: medium → Why: verification sweep; depends on steps 2–6, re-verify step 2 sizes here.

Step 8: Gate + merge. `npm run format:check`, lint, typecheck, unit, build; E2E in CI on PR #35 (local :3000 is the
founder's `next dev`, no demo seed); record evidence here; ask the founder "merge #35?".
→ Model: sonnet → Effort: medium → Why: standard gate; never weaken a failing test.

How to screenshot: Playwright script (chromium, `colorScheme: 'light'`, viewport 375/768/1280), open
`http://newtown.localhost:3000/`, fill "Demo user email" (student1@newtown.test = class 10 with tests,
student2 = neet 2027, teacher.jee@newtown.test = staff), click "Sign in as demo user", `waitForURL(/\/(home|dashboard)/)`,
then visit pages; save screenshots in the session scratchpad (never commit them); log `scrollWidth` = viewport.

## Previous next action (session 42 draft) — history

**UI redesign on `r13-ui`: founder's palette + new type system built for the shell, shared components, entry pages,
student Home and the test runner; founder approved the look ("keep this type of UI").** Next: plan steps 3–4
(remaining student pages: subject/topic, Smart Study, result, My progress, Review, Contest; staff pages: batches,
check answers, question bank, documents, people, reviews, bill, platform) — look at each at 375/1280 light/dark and
fix what the shared CSS misses; step 6 (replace colour/spacing inline styles); step 7 full gate, PR into `main`, CI,
ask "merge?". Screenshot script: copy the session scratch `shots.mjs` pattern (Playwright, demo sign-in, waitForURL).

## Next exact action (session 41) — history
**UI redesign (R1.3, ADR-049) — APPROVED by the founder, not started.** Branch `r13-ui` (from `main` `c24db29`)
holds only the plan: `docs/UI_REDESIGN_PLAN.md` (reference brilliant.org for layout/feel; own colours deep indigo
`#2D2A7A` + saffron `#F2A93B`, dark mode, Poppins + Lora; 7 steps with model/effort). Founder gave a free hand on
how to build it and asked to study brilliant.org and use a design skill (`impeccable` or `frontend-design`).
Steps:
1. `git checkout r13-ui && git pull`; `docker info`; `supabase status`.
2. Do plan step 1 (study brilliant.org in the built-in browser; tokens in `globals.css`) and step 2 (shell + building
   blocks), then show the founder student Home + the test page (light/dark, 375/1280 px screenshots) and wait for "ok".
3. Then plan steps 3–7; PR into `main`; CI green; ask "merge?".

## Previous next action (session 41, before the UI request) — history
State (2026-10-19, session 40): **PR #34 `r12-cbt` MERGED** into `main` as `c0c46ca` (squash; CI run 39155901063
green on `43825c7`: check + secrets, incl. E2E `cbt.spec.ts` and `assessments.spec.ts`). It holds CBT mode
(ADR-048, migration 32) plus the session 40 founder fixes: submit asked on the page (no `confirm()`), one question
per page with Previous / Next, CBT blocks copy/cut/paste as a warning. No PR open. Local DB = `main` (migrations to 32).
Steps:
1. `git checkout main && git pull`; `docker info`; `supabase status`. Restart the founder's `next dev` on :3000 only
   if it serves a stale build.
2. Founder may try CBT in Google Chrome on :3000 (the in-app pane refuses full screen).
3. Founder still to do: "₹ per US$" at admin.localhost:3000 → Institute bills; commission formula when ready (ADR-041).
4. Optional, ask first: question palette (jump to question n, answered/unanswered marks) on the test page; live CBT
   warning count for teachers; "End test now"; test Settings "Batches taking the test" checkboxes; reviews
   delete/hide + reply notification.
5. Otherwise ask the founder for the next change list. Phase 10 cloud parts stay BLOCKED (see Blocked).

## Next exact action (session 40) — history
State at handoff (2026-10-19, session 39): `main` = `86b677a` (PR #32 `16b7547` + PR #33 `03afbca` merged this
session, then the PROGRESS commit). **One PR open: #34 `r12-cbt`** (https://github.com/khushpal-cipher/ExamEdge_ai/pull/34),
CBT tests (ADR-048, migration 32), commits `44fadcb` (DB), `7b19a9c` (web, docs, E2E), `b61f991` (E2E fix).
- CI run 39153129147 (`7b19a9c`): check failed, only `e2e/cbt.spec.ts:31` — `getByLabel(/^CBT mode/)` never matched
  because Playwright tests the regex on the raw label text, which starts with a space (" CBT mode: …"). Fixed in
  `b61f991` (`/CBT mode/`, plus `exact: true` on the "CBT test:" note); reproduced the cause locally against the
  production build. **The rest of `cbt.spec.ts` has not run in CI yet** (it stopped at line 31). The student part
  (full screen → 3 warnings → auto-submit, answer kept) was checked by hand with headless Chromium on the production
  build (see Completed). Auto-fix is on for the session's PRs.
- Local working tree: branch `r12-cbt` (the founder's `next dev` on :3000 serves it, so CBT is visible there).
  Local DB has migrations up to 32 (32 = CBT, applied with `supabase migration up`; it is not on `main` yet).
- Founder's own reviews/replies in the local DB are real data — keep them. Never reset the DB without asking.
- Force-push is blocked: never rebase; update a branch by merging `main` into it.

Steps:
1. `git checkout r12-cbt && git pull`; `docker info`; `supabase status`.
2. `gh pr checks 34`. If red: `gh run view <id> --log-failed`, fix (never weaken an assertion), push. If green: ask
   the founder "merge #34?"; on yes `gh pr merge 34 --squash`, record the merge commit here, `git checkout main && git pull`.
3. Founder may try CBT on :3000 (Google Chrome, not the in-app pane, which refuses full screen): teacher.jee →
   Tests → New test (a class 10 subject) → tick **CBT mode** → add a question → Schedule; student2 opens it in Chrome.
4. Founder still to do: set "₹ per US$" at admin.localhost:3000 → Institute bills. Commission per institute: ask for
   the formula when they are ready (ADR-041).
5. Optional, ask first: teacher sees CBT warnings only after release (rank list + CSV) — a live count during the
   test was not asked; "End test now" button; test Settings still shows "Batches taking the test" checkboxes;
   reviews: delete/hide, notify the student of a reply.
6. Otherwise ask the founder for the next change list. Phase 10 cloud parts stay BLOCKED (see Blocked).

## Next exact action (session 39) — history
State at handoff (2026-10-18, session 38): `main` = `8499b5e` (PR #30 + #31 merged this session). **Two PRs open,
both CI green, NOT merged** (founder has not said "merge" for these):
- PR #32 `r12-instant-result` (CI run 39147007384 green on `8c20c74`): students see their own marks + right/wrong right
  after submitting, correct answers after closing time, theory = own answer + marks once checked, rank after release
  (ADR-046, migration 28).
- PR #33 `r12-reviews` (CI run 39147004736 green): student "Review" tab (text, "Hide my name"), owner/admin
  "Reviews" tab with replies; teachers see nothing; a hidden-name student still sees the reply via
  `private.review_authors` + `my_reviews()` (ADR-047, migrations 29–31).
- Both branches start from `main` `8499b5e`; they conflict only in PROGRESS.md (this file, on `r12-reviews`, is the
  newer one: keep it).
- Local working tree is on `r12-reviews`, so the founder's `next dev` on :3000 shows reviews but NOT #32's result page.
- Local DB has migrations up to 31: 28 via `supabase migration up`; 29–31 via `psql -1 -f` + hand-added rows in
  `supabase_migrations.schema_migrations` (`supabase migration up` refused while 28 was missing on the branch). The
  founder's own test reviews ("hello!" ×2, "whats up") and replies are real local data — keep them.
- Force-push is blocked by the auto-mode classifier: never rebase; update a branch by merging `main` into it.

Steps:
1. `git checkout r12-reviews && git pull`; `docker info`; `supabase status`.
2. Ask the founder "merge #32 and #33?". On yes: `gh pr merge 32 --squash`; then on `r12-reviews`
   `git fetch origin && git merge origin/main` (PROGRESS.md conflict: keep the `r12-reviews` side), run
   `npx supabase test db` + `npm run typecheck`, push, wait for CI green (Auto-fix on), `gh pr merge 33 --squash`.
   Record merge commits here.
3. Founder still to do: set "₹ per US$" at admin.localhost:3000 → Institute bills. Commission per institute: ask for
   the formula when they are ready (ADR-041).
4. Optional, ask first: "End test now" button for teachers; test Settings still shows "Batches taking the test"
   checkboxes; reviews: delete/hide, notify the student of a reply.
5. Otherwise ask the founder for the next change list. Phase 10 cloud parts stay BLOCKED (see Blocked).

## Next exact action (session 38) — history
State at handoff (2026-10-18, session 37): **two PRs open, both CI green, NOT merged** (founder has not said merge):
- PR #30 `r12-typed-marks` → `main` (CI run 39138871672 green): "Type a question" negative marks (accepts "1" or
  "-1", stored as the amount taken off), optional theory model answer (migration 25), multi-correct MCQs marked like
  JEE Advanced (migration 26, ADR-045), E2E selector fixes incl. the documents test that also failed on `main`.
- PR #31 `r12-bill` → base `r12-typed-marks` (CI run 39139334898 green): owner/admin "AI usage" → **Bill** in ₹
  (cost × "₹ per US$" set on the platform page; migration 27, pgTAP `240_bill.sql`). Commission later.
- Local working tree is on `r12-bill` (contains both). Local DB has migrations up to 27 (all applied). The founder's
  `next dev` on :3000 serves this folder, so they see both changes now. `web-prod-3001` preview may still run.
- Local data change with the founder's yes: test "jhj" (newtown, class 10, MCQ only, 1 submitted attempt) closing
  time moved to 2026-10-18 20:45 IST (the `guard_test` trigger refuses times on an open test, so it was done with
  `set local session_replication_role = replica` in one `psql` transaction). Founder will release it as
  teacher.jee@newtown.test after 20:45 and check My progress.

Steps:
1. Stay on `r12-bill` (it holds this PROGRESS.md and both PRs): `git checkout r12-bill && git pull`; `docker info`;
   `supabase status`.
2. Ask the founder "merge #30 and #31?". On yes: `gh pr merge 30 --squash --delete-branch`; then retarget #31
   (`gh pr edit 31 --base main`), rebase `r12-bill` onto `main` if needed (drop #30's commits), push, wait for CI
   (Auto-fix is on), `gh pr merge 31 --squash`. Record merge commits here.
3. **Open product decision (ask, do not build first):** MCQ-only tests show nothing until closing time + a teacher's
   "Release results" (ADR-023). Founder was offered: (a) student sees own score right after submit, rank later;
   (b) MCQ-only tests release by themselves at closing time; (c) "End test now" button for teachers. Build the chosen
   one(s) with pgTAP + E2E.
4. Founder must set "₹ per US$" at admin.localhost:3000 → Institute bills (until then the Bill says "Not available
   yet"). Commission per institute: ask for the formula when they are ready (ADR-041).
5. Items 4–5 of the session-37 list below (small follow-ups; ask first).

## Next exact action (session 37) — history
1. `cd ~/Documents/startup/examedge_ai && git checkout main && git pull` (`main` = `3261716`); `docker info`,
   `supabase status`. Local DB has migrations up to 24 (founder data — never reset without asking).
2. Nothing is in progress. R1.1, R1.2 and the session-36 founder follow-ups are merged. `next dev` on :3000 was
   restarted in session 36 (preview `web`); the worker from 14:05 still runs (`npm run dev:worker`, see launch notes).
3. Founder answers given in session 36 (no build needed): manual entry = draft test page → **Type a question**
   (type MCQ → options A–D + tick correct; Written → model answer for the teacher; students get their own answer box);
   theory answers are marked on Tests → test → **Check written answers**; results release only when all are marked.
   The founder's old "sql" notes (class 10 · computer · logic) were uploaded before ADR-044 → still "Not published";
   the founder publishes them by hand once.
4. Ask the founder for the next change list, or for ADR-041 part 2 (charges per institute + bill page; payment
   gateway = paid account → ask first). Phase 10 cloud parts stay BLOCKED (see Blocked).
5. Possible small follow-up (not asked for): a test made for one subject still shows "Batches taking the test"
   checkboxes in Settings (could add another batch) — ask the founder before changing.

## R1.2 founder change list (session 34, 2026-10-18) — founder said GO in session 35
R1.1 is merged and done (`main` = `f0b1ec5`). The founder described these changes in session 34 and said "that's all the
changes"; **the founder said go in session 35** (build all of R1.2 in the order below).
Each item: what the founder wants → how it is today → build notes.

**1. New test on the Tests page (replaces the topic's "AI test" tab and the bank's "Add question" form)**
- Founder wants: Tests → New test: the teacher picks **batch + subject** only (no topic picker), sets **date, time,
  duration**, then fills it one of two ways: **With AI** = a chat box where the teacher writes which topics, how many
  questions, which types and how hard ("10 MCQs + 5 theory on Networking and HTML, medium"); **Manual** = type the
  questions on the same page (MCQ: stem, options, correct; theory: question + model answer). Then review → Schedule.
  Remove the **AI test** tab from the topic page and the **Add question** form from the question bank (bank stays as
  the store: list, edit, approve; questions made on the test page are saved there for reuse).
- Today: topic page tab "AI test" (`makeAiTest`, counts + difficulty, one topic, default tomorrow 10:00–11:00);
  bank "New question" form; Tests page "New test" (title, times, batches) + add questions from the bank.
- Build notes: AI request = free text → gateway call that turns it into a spec (topics of that subject by name,
  counts per type, difficulty), validated against the subject's real topics, then the existing `generate` per topic
  with that topic's notes; `add_ai_test` is per chapter today → new/extended RPC for a subject-level test with
  questions from several topics (composite FKs, RLS, pgTAP). Prompt injection: the chat text is the teacher's own
  request, never shown to students; keep metering (`question_gen`) and the staff-only rule. Manual = server action
  that inserts questions (+ keys) and `test_questions` in one RPC.
**2. Batch switcher: one click** — picking a batch in the dropdown switches at once (no "Show" button).
  Today: select + Show (`chooseBatch` form). Build: submit on change (small client component; keep a no-JS fallback).
**3. After switching batch → Home of the new batch** — today the student stays on the old batch's subject page
  (founder saw "computer" of Class 10 after switching to jee 2027). Build: `chooseBatch` redirects to `/home`.
**4. Smart Study tools look like NotebookLM "Studio"** (founder's screenshots) — today: "Make" dropdown (Summary,
  Flashcards, Mind map, Practice quiz) + Generate. Build: a grid of tiles with icons in the site's colours, one per
  tool, tap = make; below it the list of what the student already made for this topic (open again). Audio, video,
  slides, reports, infographic, data table = later, not now.
**Waiting for the founder (do not build):** owner sidebar "AI usage" → renamed to a bill that shows only "how much to
pay this month" (no tokens), then a payment gateway — the founder decides each institute's charge **at the end, when
the website is fully ready** (ADR-041 part 2). Paid gateway account = ask first.

**Build order (model/effort per founder rule):**
1. ADR(s) for items 1–4 + HOW_IT_WORKS / DATABASE_DESIGN / AI_PIPELINE updates; design the AI chat → test-spec
   contract and the subject-level test RPC → Model: opus · Effort: high · Why: planning + data model + AI design.
2. Items 2 + 3 (switcher auto-submit, redirect to Home) + E2E → sonnet · low · Why: small, clear UI change.
3. Item 4 Smart Study tiles + "made before" list (+ 375 px, axe) → sonnet · medium · Why: UI restructure, reuse Studio actions.
4. Item 1 DB part: migration (subject-level AI test / manual test RPC), RLS + pgTAP isolation → opus · high · Why:
   tenancy/RLS on core tables, answer keys must stay hidden from students. Depends on step 1 — re-verify the design first.
5. Item 1 app part: New test page (batch → subject, times, With AI / Manual), remove topic AI test tab + bank Add
   question form, seed/E2E updates → sonnet · high · Why: AI gateway, metering, approval flow, many files.
6. Full gate (TEST_STRATEGY §6), browser check per role at 375 px, PR, CI, merge → sonnet · medium.
Steps 2 and 3 do not depend on 1 and can go first; step 5 depends on step 4.

## Next exact action (session 28) — history (R1.1, done)
**Founder's change list "R1.1" (session 26, 2026-10-17) — APPROVED: the founder said start building (session 27).**
The founder collects every finding first; then one plan, one branch per group, everything fixed together.
Each item: what the founder wants → how it is today → build notes.

**A. Structure: batch → subject → topic → subtopic**
- A1 **Subjects inside the batch.** When creating/editing a batch (e.g. "Class 10"), the owner types its subject names
  (Science, Maths, Social Studies) right there; no separate Subjects page + linking.
  Today: subjects are institute-wide, linked to batches via `batch_subjects` (DATABASE_DESIGN §4.2).
  Build: subject belongs to one batch (`subjects.batch_id`, composite FK); migrate existing rows; drop the linking UI.
- A2 **Subject → Topic → Subtopic; the topic is the working place** (founder answer, 2026-10-17). The teacher adds a
  main topic to a subject (Maths → Probability) and subtopics inside it (Conditional probability, Bayes theorem).
  The topic page has tabs like Vedam's class page (Session | Attendance | Assignment), here: **Subtopics | Smart
  Study**. Subtopics tab = each subtopic with its notes (uploaded + AI notes). **Teachers upload notes inside a
  subtopic, never on the topic itself** (founder, 2026-10-17); a student clicks the topic and sees all its resources
  (every subtopic's notes, grouped by subtopic). **Smart Study** tab (founder's chosen
  name) = the AI for that whole topic: **one AI tab per main topic; the AI picks the relevant subtopics itself**
  (retrieval over all notes of the topic's subtopics; no subtopic picker).
  Today: one subject page (Sources / AI tutor / Studio); chapters are flat labels; AI picks a chapter in a form.
  Build: rename/extend `chapters` into topics + a `subtopics` table (composite FKs, RLS), documents and AI scoped to
  subtopic/topic.
- A3 **"Upload notes" easy to find.** Today a small collapsed `<details>` at the bottom of Sources
  (`subjects/[id]/page.tsx`); on narrow screens the page opens on the AI tutor tab (`panes.tsx`). Build: a clear
  button inside each subtopic; teachers see only subjects of batches they teach (Neha Gupta, NEET
  teacher, opened "maths", which no batch of hers studies → upload works but nothing to publish to).

**B. Teacher AI = only these two features** (replaces today's teacher AI set; both inside a chapter, A2)
- B1 **AI notes.** Teacher explains the topic to the AI (typed) → AI writes detailed notes → teacher reviews/edits →
  Publish to batch → students of that batch see it like uploaded notes (tutor can use it). Format (founder answer):
  **a notes page in the app, with "Download as PDF"**.
  Today: does not exist (Studio "summary" only summarises existing notes).
- B2 **AI test.** Teacher asks for a quiz, theory (written) questions, or a mix → reviews → schedules the test.
  Today: "Make questions with AI" makes MCQ/numerical bank questions only, no written ones (ADR-032); test is then
  built by hand from the bank.
- Remove from teachers: Studio (summary/flashcards/mind map/quiz), the staff AI tutor and today's "Make questions
  with AI" form (B2 replaces it). **Students keep everything**: AI tutor, summary, flashcards, mind map, practice quiz
  (founder answer) — all inside the topic's Smart Study tab.

**C. Student portal**
- C1 **Batch history like a semester switcher** (founder showed Vedam's portal: "BTech CSE AI 2025" + "SEM1_25 /
  SEM2_25 / SEM3_26" dropdown). A student who joined in Class 9 and is now in Class 10 picks "Class 9" and sees
  **his own time** there: the notes, tests, results and progress from when he was in it — read-only — and **not**
  what this year's Class 9 students get. Default = current batch.
  Today: a student can be in several batches at once; no past/current, no switcher.
  Build: one batch per class per year (batches already have `academic_year`); promoting a student = add him to the
  new batch and mark the old membership **past** (`batch_members.left_at`), never delete it; a past batch is
  read-only for him (no new tests), but **he can still use Smart Study / the AI tutor on his old notes** (founder
  answer); next year's juniors join a new batch, so his view stays "his
  time" without date filters. Promotion tool for the owner: "move these students from Class 9 2025 → Class 10 2026".
- C2 **Contest page in the student sidebar.** A "Contest" item in the student portal's sidebar menu (next to Home /
  My progress) listing **every** test the institute conducted for his batch:
  upcoming, live (Start), finished, results (marks, rank).
  Today: home shows only upcoming tests; released tests appear on My progress.
- C3 **Student practice quiz only per chapter** (founder: "the quiz he creates should be on the specific subject
  chapter"). Today Studio already makes quizzes from one chapter's notes; keep it chapter-only, inside the chapter
  page (A2), and it never counts in the contest page or ranks.

**D. Money and AI usage**
- D1 **Institutes see a bill, not AI usage.** Remove the owner's "AI usage" page/numbers (tokens, cost per feature,
  budget banners). Show only "This month's AI charge: ₹X" = real AI cost + the founder's **commission**.
  Today: owner/admin "AI usage" tab (`/usage`, `usage_summary`).
- D2 **Platform admin sees both** (earlier item): per institute this month: tokens, real cost, commission, amount
  charged — in the "All institutes" table. The founder sets the commission **per institute** in the platform portal
  (different for each); the institute sees the charge **in ₹**. How the commission is calculated (%, ₹ per tokens,
  fixed fee) is **not decided yet** — founder will decide later; do not build D1/D2 before that.

**E. Remove the ExamEdge library** (earlier decision): library pages, subject → library link (newtown's maths and
physics are both linked to "JEE Main Physics", which is why Units/Laws of Motion/Rotational Motion/Gravitation show
under Sources), library on student pages, library in the tutor; drop tables (migration); tests, seed, docs; ADR
reversing ADR-010/ADR-027.

**Founder answers (2026-10-17):** Q1 students keep all AI tools, teachers only AI notes + AI test; Q2 commission
per institute, set in the platform portal, charged in ₹ — calculation undecided (founder decides later); Q3 Subject →
Topic → Subtopic, AI tab "Smart Study" per main topic, AI picks subtopics itself; Q4 past-batch students keep using
the AI; Q5 AI notes = in-app notes page + "Download as PDF".
**Last answers (2026-10-17, session 26):** keep both AI limits as today (institute monthly budget + student daily
limit; founder may revisit later); a past batch looks exactly like the current-batch interface (same pages, same
Smart Study), with content from the student's own year (founder's earlier words: "not what the current 9th class
students get"); no attendance / recordings / assignments in this build.
**Only open item:** commission formula → build D2's tokens + real-cost columns now; the commission field, the
institute's ₹ bill (D1) and hiding `/usage` from owners wait for the founder's formula (ask then).

**Build order (approved — start at step 1)** — model/effort per founder rule:
1. Write ADRs (one per group A–E; ADR-037 reverses ADR-010/027 for E) + update HOW_IT_WORKS / DATABASE_DESIGN → Model: opus · Effort: high · Why: data-model
   and product decisions for all groups.
2. E remove library (migration + code + tests) → sonnet · medium · Why: mechanical removal, many files, tests guide it.
3. A1 subjects inside batches + A2 topics/subtopics + C1 batch history (one migration: `subjects.batch_id`, topics,
   `subtopics`, `batch_members.left_at`, RLS +
   pgTAP isolation) → opus · high · Why: tenancy/RLS change on core tables; re-run full T-ISO suite after.
4. A2 topic page (Subtopics | Smart Study) + A3 upload button + C3 topic-only practice → sonnet · medium · Why: UI restructure on step 3.
5. B1 AI notes + B2 AI test (written questions, mix) → sonnet · high · Why: AI gateway, metering, approval flow.
6. C2 contest page → sonnet · low · Why: read-only list over existing tables/RPCs.
7. D2 tokens + real cost per institute on the platform table (D1 bill + commission wait for the formula) → opus · medium · Why: money; RLS so owners see only the charge.
8. Full gate (TEST_STRATEGY §6), browser check per role at 375 px, PR, CI, merge → sonnet · medium.
Steps 3–7 depend on step 1; step 4 depends on step 3 — re-verify step 3's RLS tests before starting 4.
**Status (session 28 handoff): steps 3 + 4 built on `r11-structure`; PR #21 open
(https://github.com/khushpal-cipher/ExamEdge_ai/pull/21), Auto-fix on, NOT merged.** First CI run (39051354988)
failed only at `format:check` on `.claude/launch.json` (fixed in the handoff commit), so **E2E has not run yet**.
**Next exact action (session 34):** steps 1–7 are merged (`main` = `4f3f78a`). Do step 8 only:
1. `git checkout main && git pull && git checkout -b r11-final-check`.
2. Local gate: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:db`,
   `npm run test:int`, `npm run build`. E2E needs `npm run seed:demo` → the local DB holds the founder's institutes:
   do NOT seed/reset without asking; E2E runs in CI on the PR (CI on `4f3f78a` was already green).
3. Browser check with `npm run dev` (+ `npm run dev:worker`) on http://newtown.localhost:3000 at 375 px
   (scrollWidth ≤ 375, no server errors): teacher (topics, subtopic upload, AI notes, AI test, question approve),
   student (home, Contest, Smart Study tutor + tools, My progress, batch switcher when 2+ batches), cross-institute
   404s. Owner and `/platform` need the founder's Google / MFA sign-in → covered by E2E (`portals.spec.ts`), say so.
   Any temporary rows you add: remove them and record it.
4. Fix what you find (with a test), commit, PR, CI green, merge; record here. Then R1.1 is done.
5. Known small gap from step 6: the test page still shows "Start test" for a past batch's open test (DB refuses
   with a message; Contest/Home hide it) — fix in step 8 if cheap.
6. Waiting for the founder (do not build without the founder's formula): ADR-041 part 2 — per-institute commission, owner's
   "This month's AI charge: ₹X", hiding the owner's `/usage` page.
**R1.1 progress (8 build steps):** 1 ADRs ✅ merged · 2 library removed ✅ merged · 3 DB structure ✅ merged (#21) ·
4 topic page / upload / topic-only practice ✅ merged (#21) · 5 AI notes + AI test ✅ merged (#22) · 6 Contest page +
batch switcher ✅ merged (#23) · 7 platform tokens + cost ✅ merged (#24) · 8 full gate + per-role browser
check ⬜. 7 of 8 steps done; by founder groups: E, A, B, C done; D part 1 done, part 2 waits for the founder's formula.
After merge: steps 5 (B1 AI notes, B2 AI test), 6 (C2 Contest
page + C1 batch switcher), 7 (D2 platform tokens + cost), 8. Teachers still have the tutor/Studio on the topic page
until step 5 removes them (ADR-039). The list below is the step 3/4 work list, kept for reference (done).
**(Done) step 3 + 4 on branch `r11-structure`** (`git checkout r11-structure && git pull`).
Steps 1–2 are merged; do not redo them. The DB part of step 3 is done and applied locally (see "In progress").
App part to build now (files found with `git grep batch_subjects`, `chapter_id`):
1. `apps/web/app/(portal)/actions.ts` (`setBatchSubjects` uses `batch_subjects`; `createSubject` needs `batch_id`) and
   `batches/[id]/page.tsx`: the batch page lists and adds its subjects (A1); add owner/admin "Move students to another
   batch" (insert into the new batch + set `left_at` on the old row, C1). `subjects/page.tsx`: drop the institute-wide
   list or group by batch; teachers see only batches they teach (UI filter).
2. `subjects/[id]/page.tsx` → lists topics (`chapters`) linking to a new `/topics/[id]` page with tabs
   **Subtopics | Smart Study** (A2): subtopic add/rename/delete, notes grouped by subtopic, "Upload notes" button
   inside each subtopic (A3; `documents/upload.tsx` + `documents/actions.ts` must send `chapter_id` + `subtopic_id`).
   Smart Study = tutor + Studio for the topic: new migration adds `conversations.chapter_id` and a topic filter to
   `match_chunks`; `api/tutor/route.ts` takes the topic; Studio already works per chapter (C3). Teachers get no
   tutor/Studio (that is step 5, ADR-039 — keep them for now if simpler, but students must have them in the topic).
3. `documents/[id]/page.tsx:46` and `studio/[id]/page.tsx:81` read `batch_subjects` for the audience picker →
   audience = the subject's batch only (trigger enforces it).
4. `scripts/seed-demo.ts` (lines ~110–175, ~581: subjects per batch, subtopics, documents with chapter + subtopic),
   `apps/worker/src/ingest.int.test.ts:38` and `purge.int.test.ts:21` (document inserts need chapter + subtopic),
   E2E specs that tick subjects on batches or upload notes (`e2e/portals.spec.ts`, `documents.spec.ts`,
   `studio.spec.ts`, `question-gen.spec.ts`, `tutor` spec) — update, never weaken.
5. Gate: format, lint, typecheck, unit, `npm run test:db`, `npm run test:int`, build; E2E runs in CI (local DB has
   founder data and no demo seed — do not seed or reset without asking). Browser check on newtown
   (http://newtown.localhost:3000, demo users below) as owner, teacher, student at 375 px. Then PR, CI green, merge.
6. Then steps 5 (B1 AI notes, B2 AI test), 6 (C2 Contest page + C1 batch switcher if not done in 4), 7 (D2 platform
   tokens + cost), 8 (full gate) from the build order above.
Standing items: `docs/FOUNDER_TEST_GUIDE.md` stays untracked (never commit it without the founder's yes). Still
unverified: accepting an invitation through Google sign-in. Founder's earlier "wait for go" items (usage column,
library removal) are now part of the approved R1.1 list.

**Local DB now (do NOT reset or delete without asking):** institutes `newtown` (owner = founder's Gmail
`khushalsinghchouhan4@gmail.com`; batches `jee 2027`, `neet 2027`) and `vedam` (owner `vedam@gmail.com`, joined;
created by the founder). Demo people added to newtown in session 25 (direct memberships via a scratch script using
`scripts/local-supabase.ts`, demo password, "Sign in as demo user" at http://newtown.localhost:3000):
`student1@newtown.test` (Riya Sharma, student, jee 2027), `teacher.jee@newtown.test` (teacher, jee 2027),
`teacher.neet@newtown.test` (teacher, neet 2027), `student2@newtown.test` (Aman Singh, student, neet 2027).
All 5 old institutes (demo, rival, sharma, v4classes, allen) were deleted with the founder's yes; their 27 Storage
files remain until the worker's daily purge. The sample data needs `npm run seed:demo` (ask first). E2E tests
create leftover rows when run locally. Founder's TOTP was reset (they re-enrol on next admin sign-in).
Worker start (local values): `WORKER_DATABASE_URL=postgresql://worker:worker_local_only@127.0.0.1:54322/postgres
WORKER_STORAGE_EMAIL=worker@examedge.test WORKER_STORAGE_PASSWORD=examedge-worker-local npm run dev:worker`.

**Verified by the founder (2026-10-17):** the owner invitation email for `newtown` was delivered to their Resend
account Gmail, but in **Spam** (test sender `onboarding@resend.dev`; a verified domain + `EMAIL_FROM` should fix it).
Still unverified: accepting an invitation through Google.
**Founder request (2026-10-17), NOT started — build only when they say go:** on the platform admin page
(admin.localhost → Institutes, "All institutes" table) show each institute's AI use: tokens used (input + output)
and cost this month. Platform admins can already read every `usage_records` row (DATABASE_DESIGN §4.6), so no new
data access is needed; counts only, no student data (TH-15).
**Founder decision (2026-10-17), NOT started:** delete the ExamEdge library feature — they will not share any content
with institutes. Remove the platform library pages, the subject → library link, the library on student subject pages
and library retrieval in the tutor (tutor = institute notes + general explanation only); drop the library tables with
a new migration; update tests, seed, HOW_IT_WORKS, AI_PIPELINE_DESIGN, DATABASE_DESIGN, and add an ADR that reverses
ADR-010/ADR-027. Build together with the usage column when the founder says go. Also untracked and uncommitted:
`docs/FOUNDER_TEST_GUIDE.md` (founder said don't push yet). Local only: founder's lost TOTP factor was deleted from
`auth.mfa_factors` with their yes, so they will enrol a new one on the next admin sign-in.

**Session 25 (2026-10-17), no code changed.** Founder answers: (a) **no new features** — "I don't want anything
already added on, I will test it myself by creating the whole simulation" → the aggregate-counts question is closed
(not built); wait for the founder's own test findings and fix what they report. (b) The two email/Google checks
(item 1 below) are **not tried yet** — still UNVERIFIED. (c) Leftover E2E rows removed with the founder's yes: one
`psql` transaction as `postgres` (aborts unless the counts match) deleted Demo batches `Commerce mvbx3jqy`,
`Commerce mvbx4px9`, `Commerce mvc3qbpz`, subjects `Economics mvbx3jqy`, `Economics mvbx4px9` (no members, documents,
tests or questions) and suspended institutes `gamma-mvc5sira/taw0/ucpx` (no memberships) → `deleted batches=3
subjects=2 institutes=3`; `demo`, `rival`, `sharma`, `v4classes`, `allen` untouched. Their 3 logo files go with the
worker's daily purge (ADR-031) once the worker runs. Note: running the E2E suite locally creates such rows again.

**Session 24 (2026-10-17), no code changed.** Founder asked for a read-only audit of "the three portals" (their prompt
said Flutter; there is no Flutter project on this Mac — this Next.js app is the one). Explained: platform admin
(admin.localhost:3000), staff portal and student portal (same institute address, role decides; `lib/tenant.ts`
`requireMember`, `app/page.tsx` redirect, `(portal)/layout.tsx` menus). Browser check against `next dev` (seeded demo
users only), all as expected, no console/server errors:
- signed out: `/dashboard` `/home` `/people` `/usage` → redirect to `/`; `demo.localhost/platform` 404; unknown host 404.
- owner@demo.test → `/dashboard`; all 7 staff tabs + batch/subject/test/question/student pages 200; sign-out works.
- teacher1@demo.test: 6 tabs (no AI usage), invite role "student" only, sees only JEE 2027 Morning; 404 on `/usage`,
  `/home`, `/progress`, the NEET batch and a Rival subject.
- student01@demo.test → `/home`; menu Home + My progress; 9 staff URLs 404; AI tutor (demo AI) answered with a
  "From your institute's notes … p.1" label (this added one chat for student01); on rival.localhost → "You are not a
  member of this institute".
- platform@examedge.test on admin.localhost → two-factor screen; `/library`, `/institutes/<id>` redirect without aal2.
  Stopped there (enrolling TOTP would change the account). Nothing after TOTP re-verified this session.
- `/tests/<id>/check` is 404 for tests without written questions — by design (link shown only when there are some).
Findings told to the founder: leftover E2E data in the local DB (Demo "Commerce mvbx…" batches, "Economics mvbx…"
subjects, three suspended `gamma-…` institutes); worker not running (new uploads stay queued); a typo in the demo
email creates an empty account (ADR-034); not built vs HOW_IT_WORKS: batch "last active", progress "days active /
notes opened / flashcards reviewed" (no activity tracking in R1), Excel (CSV only), KaTeX, break-glass support access.
Founder thought their platform portal "sees everything" about institutes — explained it cannot see students' data by
design (TH-15). **Open question to the founder:** do they want per-institute aggregate counts (students, batches,
tests, documents; no personal data) on the platform institute page? Product decision — wait for their answer.

`main` = `5fc5051` (+ PROGRESS commits). No open branch, no open PR. Session 23 (2026-10-17): PR #18 merged —
platform "Send new owner invitation" (ADR-036, `reinvite_owner`, migration `20261028000016`) + create form explains
the 3-character address minimum (founder kept the minimum at 3). Applied locally with `supabase migration up` (no reset).

**2026-10-17 (session 25), founder's yes: ALL 5 local institutes deleted** (`demo`, `rival`, `sharma`, `v4classes`, `allen`; one checked `psql` transaction, `institutes` count now 0). Sign-in accounts kept; 27 Storage files remain until the worker's daily purge (ADR-031). Restore sample data only with `npm run seed:demo` (ask first). The paragraph below is now history.

**Local state the founder is using — do NOT run `supabase db reset` / `npm run db:reset` without asking first** (it
wipes their test data): institutes `v4classes` (owner v4classes@gmail.com accepted; teacher khushpal@gmail.com invited),
`sharma` (owner sharma@gmail.com, not accepted), `allen` (owner allen@gmail.com, **accepted** 2026-10-17 09:13 IST via
local email sign-in); founder platform admin `khushalsinghchouhan4@gmail.com` (TOTP enrolled; **signed in with real
Google** 2026-10-17 10:18 IST — `auth.identities` provider `google`, checked in session 24). New migrations: apply with
`supabase migration up` (keeps data).
For the full gate without a reset, rely on CI and say so.

**Founder keys (never print, never commit):** root `.env` = `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID/SECRET` (read by
`supabase start`, so start Supabase from the repo root) + `RESEND_API_KEY`; `apps/web/.env.local` also has
`RESEND_API_KEY`. Both gitignored; `gitleaks dir` flags them (expected), `gitleaks git` must stay clean.

0. Fresh session: `cd ~/Documents/startup/examedge_ai && git checkout main && git pull && npm ci`; `docker info`
   (else `open -a Docker`); `supabase status` (else `supabase start`). Dev server and worker stop when a session ends:
   start the web with preview_start `web`; worker = `npm run dev:worker` with the local env from
   `scripts/local-supabase.ts` `localWorkerEnv` (WORKER_DATABASE_URL, WORKER_STORAGE_EMAIL/PASSWORD, NEXT_PUBLIC_*).
1. Ask the founder how their two pending checks went (UNVERIFIED; in session 23 they had not tried yet):
   (a) invite their Resend sign-up email from V4 Classes → People: email arrives ("emailed" badge);
   (b) open it in a private window → Continue with Google → Accept invitation (that Gmail must be a Google OAuth
   test user). Fix whatever fails; record evidence here.
   Session 24 DB check: Google sign-in itself works (platform admin's account, 10:18 IST); no invitation has been
   accepted through Google yet (the v4classes teacher invite is still pending); delivery of an email not checkable
   from here.
2. Founder can now fix the `sharma` owner email from admin.localhost:3000 → institute → "Owner invitation"
   (`allen` no longer needs it: its owner joined). No other offered feature is pending.
3. Still needs founder decisions/accounts (see Blocked): domain + Resend domain verification (emails to anyone, set
   `EMAIL_FROM`), publish the Google consent screen, Phase 10 cloud parts, Anthropic key, Q-08, Q-01.
4. Any new local task: new branch, tests, `supabase migration up` (no reset), PR, CI green, squash-merge, PROGRESS.
5. Done in session 25 (leftover E2E rows removed). Before any new deletion of local data, ask first.

## Relevant files and commands
- Plan entry point: `docs/PROJECT_MASTER_PLAN.md`
- Roadmap and acceptance criteria: `docs/IMPLEMENTATION_ROADMAP.md`
- Commands: `supabase start` / `supabase status` / `supabase test db`; scripts in root `package.json`.
- Local Supabase: API http://127.0.0.1:54321, DB postgresql://postgres:postgres@127.0.0.1:54322/postgres (local defaults; keys via `supabase status -o env`, never commit them).
- Preview config `web-prod-3001` in `.claude/launch.json` (session 28): `next start -p 3001` on the last build, for browser checks while another session's `next dev` holds :3000.
- `@axe-core/playwright` 4.13.0 (session 5, `npm i -D`).
- `@anthropic-ai/sdk` 0.131.0 (session 12, `npm i -w @examedge/core @anthropic-ai/sdk@0.131.0`).
- Playwright Chromium (session 3, `npx playwright install chromium`, chromium-1243/headless-shell-1248 in ~/Library/Caches/ms-playwright).
- Seed/ops: `npm run seed:demo`, `npm run create-institute`, `npm run audit`. Demo logins: owner@demo.test, admin@demo.test, teacher1-3@demo.test, student01-50@demo.test (same for @rival.test) via "Sign in as demo user".
- `pdfjs-dist` 6.4.299 (session 8, `npm i -w @examedge/worker pdfjs-dist@6.4.299`; optional `@napi-rs/canvas` comes with it); `@supabase/supabase-js` added to worker deps.
- `@napi-rs/canvas` 1.0.11 declared in worker deps (session 20; was already installed with pdfjs-dist).
- PostgreSQL 17 client tools (session 19, `brew install postgresql@17`, pg_dump 17.11) for `npm run backup` (server is 17).
- Tools installed by Claude: Docker Desktop 4.95.0 (`brew install --cask docker-desktop`), Supabase CLI 2.121.0 and gitleaks 8.30.1 (`brew install supabase/tap/supabase gitleaks`).

## Known regressions
- None.

## Known issues (not fixed)
- A subtopic (or topic) whose notes were deleted cannot be deleted until the daily purge hard-deletes those notes
  30 days later (soft-deleted documents still hold the no-action FK, ADR-038/ADR-031); the page says "It is still
  used somewhere". Found in session 31; pre-existing since step 3. Fix idea: let `deleteSubtopic` move or hard-delete
  soft-deleted documents of that subtopic (needs a small migration/RPC) — ask the founder if it matters.

## Session log
| Session | Date | Summary | Last commit |
|---|---|---|---|
| 53 | 2026-10-25 | Batch B: pilot pgTAP fixed (worker `auth.uid()` bug, seat regroup), `270_pilot`, pilot web (banner, platform fields, messages), ADR-058 + docs; pgTAP 1516, unit 203, int 28, build ok; PR #43 opened, CI pending | see `git log` (branch `r18-batch-b`) |
| 42 | 2026-10-19 | UI polish on PR #35: light only, type scale, spacing (`.inline` root cause), sidebar, `.danger` buttons, 960 px content; founder follow-ups: 40 px controls, growing text boxes, styled dropdown, Home at-a-glance band, empty states, status dots, right-aligned numbers, toast, motion, entry page. Gate green locally (E2E → CI) | `b8d6cdb` (branch `r13-ui`) |
| 39 | 2026-10-18/19 | Founder said merge: PR #32 (`16b7547`) and #33 (`03afbca`) merged after merging `main` into `r12-reviews` (pgTAP 1435). Founder asked for CBT tests: full screen, tab/app switch + reload count, 3rd warning auto-submits, Chrome only, warnings on results (ADR-048, migration 32, pgTAP 1456, E2E `cbt.spec.ts`); PR #34, first CI failed on an E2E locator, fixed | `b61f991` (branch `r12-cbt`) |
| 37 | 2026-10-18 | Founder: "Type a question" gets negative marks; theory model answer optional (migration 25); multi-correct = JEE Advanced marking (migration 26, ADR-045); owner "AI usage" → ₹ Bill at a platform-set rate (migration 27); pgTAP 1372; MCQ-only results question answered (release is manual) — decision open | branches `r12-typed-marks` (PR #30), `r12-bill` |
| 36b | 2026-10-18 | PR #26/#27 merged (R1.2 done); founder follow-ups: Add questions at the top of a draft test (PR #28 `ac20bed`), teacher notes publish themselves (ADR-044, PR #29 `3261716`); stale :3000 dev server restarted | `3261716` |
| 36 | 2026-10-18 | R1.2 item 1 web part finished (topic page fixed, New test subject picker, bank form removed, E2E rewritten, label width fix); local gate green, browser check at 375 px; PR #26 merge refused by the auto-mode classifier | see `git log` |
| 35 | 2026-10-18 | Founder: GO for R1.2. Steps 1–3 (ADR-042/043, one-click switcher → Home, Smart Study tiles) on PR #26, CI green, not merged. Item 1: migration 23 (`tests.subject_id`, `add_test_questions`, `add_ai_test` dropped; pgTAP 1347) applied locally, core `planTest` (10 unit tests); web part WIP (typecheck fails on the topic page) | WIP commit on `r12-new-test` |
| 34 | 2026-10-18 | R1.1 step 8: local gate, browser check per role at 375 px, 3 fixes (past-batch test page, teacher bank filter, wording); PR #25 CI green, merged `f0b1ec5` → R1.1 done. Founder's R1.2 change list recorded + planned (not started) | `f0b1ec5` |
| 32 | 2026-10-18 | PR #22 merged (`0cc9a2e`). Step 6: migration 21 (progress per batch, skip tests after leaving), Contest page, batch switcher, E2E; browser check with temporary rows (4 fixes); local gate green; PR #23 first CI failed on 2 E2E locators in the new spec, fixed and pushed | `6533b04` (branch `r11-contest`) |
| 31 | 2026-10-18 | Step 5 finished: AI notes edit on the document page, browser check (3 copy fixes + return-to-test after saving a question), E2E (AI test rewrite, AI notes journey, Studio teacher test), docs; local gate green except E2E (CI) | see `git log` (branch `r11-teacher-ai`) |
| 30 | 2026-10-17 | PR #21 E2E fixed (`demoTopic` batch order) and merged `22ac7f3`. Step 5: notes unit tests, written AI questions (`questions-v2`), worker Markdown, web AI notes / AI test / `/notes` page / bank form removed (typecheck + lint + unit green; no browser check, no E2E yet) | see `git log` (branch `r11-teacher-ai`) |
| 29 | 2026-10-17 | PR #21 CI: E2E 6/26 failing (not fixed). Step 5 started on `r11-teacher-ai`: migration 20 (staff/student AI split, Markdown notes, `add_ai_test`) applied locally, pgTAP 1321 PASS, core `notes.ts` + `claudeNotes`; web/worker/E2E not done | see `git log` (branch) |
| 28 | 2026-10-17 | R1.1 steps 3+4 app part: migration 19 (topic chats/retrieval, move_students), batch page subjects + promotion, topic page Subtopics / Smart Study, seed/E2E updated; local gate green except E2E (CI) | `debaaae` (branch) |
| 27 | 2026-10-17 | R1.1 step 1 (ADRs, #19) and step 2 (library removed, #20) merged; step 3 DB part (subjects in batches, subtopics, batch history, pgTAP 1285) on `r11-structure`, applied to the local DB; app part next. Founder guide pushed by mistake and removed at once | `58de935` (branch) |
| 26 | 2026-10-17 | No code. Founder change list R1.1 written, questions answered, approved for building (groups A–E, 8-step build order); worker started; both newtown students signed in | see `git log` |
| 25 | 2026-10-17 | Founder: no new features (will test the whole flow themself); email/Google checks not tried yet; leftover E2E rows (3 batches, 2 subjects, 3 gamma institutes) deleted from the local DB with their yes | see `git log` |
| 24 | 2026-10-17 | Read-only check of local state (real Google sign-in works; allen owner had joined). Read-only audit of the three portals + browser check of each role and isolation (no code changed); open question: aggregate counts on the platform institute page | see `git log` |
| 23 | 2026-10-17 | Founder chose: build "Send new owner invitation", keep 3-character address minimum. ADR-036, pgTAP 1303, PR #18 CI green and merged | `5fc5051` |
| 22 | 2026-10-17 | Founder hands-on testing. Merged #14 institute list refresh, #15 delete institute (ADR-033), #16 local demo accounts (ADR-034), #17 Google sign-in + invitation emails (ADR-035); CI green each | `e5ac8f3` |
| 1–2 | 2026-10-14/15 | Planning docs, founder decisions, tools, git init, workspaces, local Supabase init + pgTAP smoke | `5d26fc7` |
| 4 | 2026-10-15 | Phase 1 gate green, CI audit gate, PR #1 merged (`913ec7f`). Phase 2 built: tenancy schema + RLS, 334 pgTAP, web tenant/sign-in/invite, demo seed, 6 E2E; local gate green; PR not yet opened | see `git log` |
| 5 | 2026-10-15 | PR #2 merged (`c106364`). Phase 3 built (migration + 394 pgTAP, staff/student portals, platform admin + TOTP, E2E spec); E2E 4 failures fixed but not re-run; gate not run | see `git log` |
| 6 | 2026-10-15 | Phase 3 E2E fixed (12/12), aal from verified claims, gate green, PR #3 merged (`0417717`). Phase 7 DB (692 pgTAP) + UI built; seed WIP failing | see `git log` |
| 7 | 2026-10-15 | PR #4 merged (`2a5f25e`). Phase 7 seed fixed, `e2e/assessments.spec.ts`, 6 real bugs fixed (test creation RLS, key save, key embeds, submit, form state, checking scroll), browser check, ADR-023, gate green | `40fc4fc` |
| 8 | 2026-10-15 | Phase 4 DB + worker + tests green (850 pgTAP, 16 integration); institute-delete cascade bug fixed; web UI + seed written, not verified | see `git log` |
| 13 | 2026-10-16 | Phase 6: assemble fix, streaming tutor route, safe Markdown + XSS/injection suites, tutor pane + reports + doubts, browser-verified; AC6.4/E2E/gate pending | `7fd9b8a` |
| 14 | 2026-10-16 | Phase 6: AC6.4 isolation test, eval runner, tutor E2E, 375 px check, ADR-026, gate, PR #7 CI green and merged (`7863900`); branch `phase-8-library` | see `git log` |
| 9 | 2026-10-15 | Phase 4 web UI browser-verified, worker env/CI, `e2e/documents.spec.ts`, logo upload; founder pausing subscription — handoff written | see `git log` |
| 10 | 2026-10-16 | ADR-024, Phase 4 full gate green (2 test-fixture races fixed), PR #5 merged (`cbfb62e`); Phase 5 prices verified, usage migration written (pgTAP 2 failing, WIP) | see `git log` |
| 11 | 2026-10-16 | Phase 5: pgTAP green + `080_usage.sql`, core gateway (routing/cost/metered), worker metering, `/usage` page, platform AI switches, AC5.3 concurrency + AC5.4 API tests; 2 real bugs fixed (safeupdate kill switch, phone layout); full gate green; PR #6 opened, CI pending at handoff | `0802398` |
| 12 | 2026-10-16 | PR #6 merged (`b1f0795`). Phase 6: tutor schema + RLS + pgTAP (1064 PASS), Anthropic SDK 0.131.0, core tutor/fake/Claude provider + tests WIP (1 unit test failing, fix known) | see `git log` |
| 16 | 2026-10-16 | Phase 8: AC8.4 fixed (OR keyword query, library recall 1.0), web verified in browser (2 UI fixes), `e2e/library.spec.ts`, ADR-027 + docs, gate, PR #8 CI green (E2E 24/24) and merged (`bce1046`); branch `phase-9-studio` | see `git log` |
| 17 | 2026-10-16 | Phase 9: studio schema + 38 pgTAP (1220 PASS), core generators + Claude structured-output provider (unit 132), web Studio pane/artifact page/quiz/progress written, first browser check OK; handoff mid-browser-check | see `git log` |
| 18 | 2026-10-16 | Phase 9: browser check done (no bugs), Studio seed, `e2e/studio.spec.ts`, ADR-028 + DB docs, local gate (E2E 25/26, T-SEC-05 dev-only), PR #9 CI green (E2E 26/26) and merged (`67ed4ac`); branch `phase-10-local`; handoff for Phase 10 | see `git log` |
| 19 | 2026-10-16 | Phase 10 local: upload/storage/job limits, retention purge, backup + restore drill, runbooks, README, ADR-029; local gate green (E2E 25/26, T-SEC-05 dev-only) | `b731118` |
| 20 | 2026-10-16 | Claude OCR provider (ADR-030, PR #11 merged `69d3fc6`); purge of unreachable files (ADR-031) built + gate green, pushed, PR not opened | `2dc2fc7` |
| 21 | 2026-10-16 | Purge re-checked, PR #12 merged (`6f343a0`). Found AC7.5 never built → AI bank questions + blind second solve (ADR-032), gate green (E2E 27/27) | `fa25f32` |
| 15 | 2026-10-16 | Phase 8: library migration + 40 pgTAP (1104 PASS), core two-layer tutor (46 unit), web/platform editor/seed/eval written; AC8.4 library recall 0.81 FAILING (keyword AND), handoff | see `git log` |
| 3 | 2026-10-15 | Phase 1: web skeleton (build OK), pg-boss schema + worker heartbeat (ran OK), logger, lint/format/test configs, forbidden-pattern check (lint OK), bundle scan, gitleaks hook, CI workflow, .env.example. Full gate NOT yet run; nothing pushed before the WIP commit. | see `git log` |
