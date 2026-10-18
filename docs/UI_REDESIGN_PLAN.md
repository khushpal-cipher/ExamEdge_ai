# UI redesign plan (R1.3, founder, 2026-10-19) — ADR-049

## What the founder asked
"The UI looks very bad." Of five references (21st.dev, brilliant.org, guild.com, circle-website.webflow.io,
museconnect.webflow.io) the founder accepted **Brilliant** as the layout/feel reference, but **not Brilliant's
colours**: ExamEdge gets its own theme, **deep indigo + saffron**. The founder gave a free hand on how to build it
and asked to study how brilliant.org works and to use a design skill (`impeccable` / `frontend-design`).

Ranking given to the founder (session 40): 1 Brilliant (a learning app, one problem at a time, calm, phone-first),
2 Guild (education, trustworthy, but corporate/B2B), 3 Circle (course landing template, no app screens),
4 Muse Connect (decorative template with placeholder text), 5 21st.dev (developer component shop, dark, dense).

## What to take from Brilliant (layout and feel, not colours)
Study brilliant.org in the browser first (home, a course page, a lesson if reachable without an account) and note:
- Lots of white space, one clear task per screen, a single strong call to action.
- Big, confident serif/display headings; plain sans for UI; short line lengths for reading.
- Soft, rounded cards with a thin border and light shadow; generous padding (24–32 px).
- Buttons: large (44–48 px tall), rounded, solid primary; a quiet secondary.
- Progress made visible: progress bars, "n of N", completed ticks.
- Phone first: one column, sticky bottom action on phones.
Do not copy their logo, illustrations, copy, fonts files or exact colours.

## Theme (tokens in `apps/web/app/globals.css :root` — the app already reads everything from tokens)
| Token | Light | Dark | Use |
|---|---|---|---|
| `--accent` (primary) | `#2D2A7A` indigo | `#8C88F0` | main buttons, links, active nav |
| `--on-accent` | `#FFFFFF` | `#14132B` | text on primary |
| `--accent-ink` | `#2D2A7A` | `#B9B6FF` | links |
| `--saffron` (new) | `#F2A93B` | `#F2A93B` | highlights, rank/streak badges, focus ring — small amounts only |
| `--bg` | `#FAF8F3` | `#14132B` | page |
| `--card` | `#FFFFFF` | `#1D1C3A` | cards |
| `--soft` | `#F1EFF8` | `#25244A` | soft fills, table heads |
| `--ink` | `#1B1B2F` | `#ECEBF5` | body text |
| `--muted` | `#6B6F80` | `#A3A6B8` | hints |
| `--line` | `#E5E3EE` | `#34335C` | borders |
| `--good` / `--good-soft` | `#1E8E5A` / `#E3F3EA` | `#5CCB93` / `#173A2B` | correct, saved |
| `--bad` / `--bad-soft` | `#C8443A` / `#FBE5E2` | `#F08A80` / `#3E1F23` | wrong, CBT warning, errors |
| `--warn-soft` | `#FDF1DC` | `#3B3220` | notices |
Check every text/background pair is WCAG AA (4.5:1 body, 3:1 large text/UI) — verify with a script, not by eye
(e.g. saffron is for fills/badges with ink text, never white text on saffron). Green/red stay only for right/wrong
and warnings. Dark mode: `@media (prefers-color-scheme: dark)` on `:root` (new; the app has none today).
Fonts stay Poppins (headings/UI) + Lora (`.reading`, long notes) — already loaded in `app/layout.tsx`.

## Build order (branch `r13-ui`; one commit per green step; founder sees step 2 before the rest)
Each step: run format/lint/typecheck/build, look at the page at 375 px and 1280 px in light and dark, fix, commit.

Step 1: Study brilliant.org; write the token table + type scale + spacing into `globals.css :root` (tokens only).
→ Model: opus  → Effort: high  → Why: sets the whole visual system; every later step depends on it.

Step 2: Restyle shell + building blocks (sidebar/top bar, cards, buttons, forms, tables, alerts, tabs) in
`globals.css`, then show the founder **student Home + the test page** (light + dark, phone + desktop screenshots)
and wait for "ok" before step 3.
→ Model: sonnet  → Effort: medium  → Why: CSS work on known classes; the founder's look decides the rest.

Step 3: Student pages: Home, Subjects → Topic (Smart Study tiles, tutor), Tests (runner: big option rows, sticky
Previous/Next/Submit bar on phones, progress bar "n of N"), result page, My progress, Review.
→ Model: sonnet  → Effort: medium  → Why: page-by-page polish; logic untouched.

Step 4: Staff pages: Dashboard, Batches, Tests (create/settings/check), Question bank, Studio, Documents, People,
Reviews, Bill; platform admin pages.
→ Model: sonnet  → Effort: medium  → Why: same classes, more tables/forms.

Step 5: Public pages: landing (`app/page.tsx`), sign-in, invite — Brilliant-like hero with one call to action.
Exactly one `<h1>` per page, page titles ≤ 60 chars.
→ Model: sonnet  → Effort: medium  → Why: few pages, visible to parents/owners.

Step 6: Replace the 57 inline `style={{…}}` props with classes where they set colours/spacing (keep layout-only
ones); remove dead CSS.
→ Model: haiku  → Effort: low  → Why: mechanical; re-verify step 3–4 screens after (depends on them).

Step 7: Full gate (`npm run check`), axe on every E2E page already in the suites (no new serious/critical issues —
colour contrast is checked there), E2E selectors unchanged (roles/labels, not classes); PR into `main`, CI green,
ask the founder "merge?".
→ Model: sonnet  → Effort: medium  → Why: standard gate; never weaken a failing test.

## Rules for this work
- CSS and markup only: no logic, DB, RLS or server-action changes. No new dependency (no Tailwind/UI kit) — the
  app's own classes in `globals.css` are enough; a dependency needs a DECISIONS.md entry and the founder's yes.
- Keep every role/label the E2E tests use; keep the CBT cover and full-screen behaviour (ADR-048) working.
- Images: none needed; if any are added use WebP/SVG with `alt`.
