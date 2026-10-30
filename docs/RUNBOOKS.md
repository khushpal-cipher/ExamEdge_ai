# ExamEdge AI — Runbooks (what to do when…)

Last updated: 2026-10-16 · Tried on this Mac only, not on a live site yet.

**How to read this:**
- **BLOCKED** = needs the live-site accounts (Supabase cloud, Vercel, Render, Resend, Sentry). They don't exist yet.
- **[U]** = not checked yet. Confirm it before relying on it.
- Each time you really use a runbook, write a line in [PROGRESS.md](../PROGRESS.md): date, who, what happened.

**Who is on call:** the founder. Turn on 2-step login (2FA) for every provider account, and keep the recovery codes in
your password manager.

## 1. Something went wrong

**In the first 15 minutes, stop the damage first.** Find out why after that. Write down what you see, with the time.

| What happened | What to do right away |
|---|---|
| AI bill shooting up | Open `admin.<your domain>` → **Turn AI off for everyone**. All AI stops from the next request. For one institute only: Institutes → pick it → untick **AI enabled**. Later, also lower the spend limit at the AI provider (BLOCKED). |
| One institute may see another's data | Set that institute's status to **suspended** (Institutes → status). Its users are locked out at once. Keep the logs, then run the safety tests: `npm run test:db` and the browser isolation tests. |
| A key or password leaked | See §2, "If a key leaked". |
| Wrong answer key in a test | The teacher fixes the key, then clicks **Recalculate results** on the test. Marks and both ranks are worked out again. |
| Wrong or harmful notes uploaded | The teacher or admin clicks **Withdraw**. Students lose access on their next click. Who uploaded it is in the audit record. |
| Site is down | Check the status pages of Supabase, Vercel and Render. Open `/api/health` for the website. Check the worker log for a `worker.heartbeat` line (one every minute). If the last release broke it, go back to the previous version (§6). |

**Finding out why:**
- **Logs** hold only ids, never names, emails or chat text.
- **Who did what:** the `audit_events` table. Owners and admins see their own institute; the platform admin sees everything.
- **AI use per institute, person and feature:** the `usage_records` table.

**Afterwards:**
- Write a short note in PROGRESS.md: what happened, who was affected, how it was fixed, what to do next.
- If students' personal data may have leaked, ask the lawyer first whether and how people must be told (India's DPDP
  law) **[U]**.

## 2. Changing keys and passwords

**Normal change:** make the new key → save it where the app reads it → restart (redeploy) the app → check
`/api/health` and the worker heartbeat → delete the old key → write the date in PROGRESS.md.

**If a key leaked:** delete the old key **first**, even if the site stops for a few minutes. Then make a new one. Then
check the provider's usage page for strange use while the key was out. More detail:
[API_AND_SECRETS_INVENTORY.md](API_AND_SECRETS_INVENTORY.md) §4.

| Key / password | Used by | How to change it | How often |
|---|---|---|---|
| Anthropic key (`ANTHROPIC_API_KEY`) | Website (Vercel) and worker (Render) | Anthropic console → new key → put it in both → redeploy both → delete old key | Every 90 days |
| Voyage key (`VOYAGE_API_KEY`) | Same | Same steps in the Voyage dashboard (not used yet) | Every 90 days |
| Supabase secret key | Admin scripts on your own computer only — never the website or worker | Supabase dashboard → API keys → new secret key → save in password manager → delete old key | When needed |
| Worker database password (`WORKER_DATABASE_URL`) | Worker (Render) | In the Supabase SQL editor run `alter role worker password '<new>'` → update Render → redeploy → heartbeat appears within 1 minute | Every 3 months |
| Worker file-download password (`WORKER_STORAGE_PASSWORD`) | Worker (Render) | Supabase → Auth → users → worker account → new password → update Render → redeploy → upload a test PDF and check it reaches **Ready** | When needed |
| Google sign-in secret | Supabase sign-in settings | Google Cloud console → add new secret → paste it in Supabase → test signing in → delete old secret | Once a year |
| Platform admin login code (authenticator app) | Your phone | Lost phone: use the recovery method set up in advance **[U: check how Supabase does this]**, then remove the old phone | — |

## 3. Backups and restoring

**Goal for the pilot:** lose at most 1 day of data, and be back online within 8 hours.

Supabase's own daily backups do **not** include uploaded files (PDFs, logos). So we keep our own copy of both the
database and the files.

**On this Mac (works today):**
- **Make a backup:** `npm run backup`. It creates a folder `backups/<time>/` (never committed to git) with:
  - `db.dump`: the whole database
  - `storage/`: every uploaded file
  - `manifest.json`: how many rows each table has, and a fingerprint (checksum) of every file
- **Test that the backup works:** `npm run restore-drill -- backups/<time>`. It:
  - restores the backup into a spare, temporary database
  - checks that every table has the same number of rows and every file matches its fingerprint
  - prints how long it took
  - deletes the spare database (add `--keep` to keep it)
  - stops with an error if anything is different
- **Needs:** the PostgreSQL 17 tools (`brew install postgresql@17`). They must be the same version as the database.

**For the live site (works, drilled 2026-10-30):**
- **Make a backup:** `scripts/backup-prod.sh backup` (needs Docker running and `supabase login` + `supabase link`; no secret key).
  Creates `backups/prod-<time>/` (never in git) with `data.sql` (every row of public, private, auth, storage), `storage/`
  (every uploaded file) and `manifest.txt` (checksums). The schema is not in it: it comes from `supabase/migrations`.
- **Test it:** `scripts/backup-prod.sh drill backups/prod-<time>`. Starts a scratch Postgres in Docker, applies the migrations,
  loads `data.sql`, compares row counts with the live database, prints the time, deletes the scratch container.
  Needs the local Supabase stack running (its auth/storage definitions are reused).
- **A real restore:** new Supabase project, `supabase db push`, empty the seeded tables (the drill shows how), load `data.sql`,
  create the `worker` login role first, upload `storage/` again, set the worker password again.
- **Result 2026-10-30:** 17 MB database + 0.7 MB files gave a 972 KB backup; the drill restored in 3 s with every count equal
  (6 users, 1 institute, 3 memberships, 2 platform admins, 2 files, 44 tables). File checksums are listed in the manifest but
  not yet compared automatically. Keep the folder somewhere other than Supabase (an encrypted copy on Google Drive is fine);
  nothing runs it nightly yet, so run it by hand weekly during the pilot.
- **Still to do:** nightly automatic run and off-site storage (decide with the founder), repeat the drill every 90 days.
- **After a real restore, before reopening:**
   - delete again anyone who asked to be deleted after the backup was made
   - check that `/api/health` works, signing in works, the tutor answers, and a PDF opens

## 4. When an institute leaves

**An ended free pilot:** the platform page lists pilots that ended more than 30 days ago under "Ended pilots
older than 30 days — delete by hand" (ADR-058). If the coaching did not pay, follow steps 2–5 below for it.

Created by mistake and nobody has joined yet? Use **Delete institute** on its page in the platform admin instead (ADR-033).

1. The platform admin sets the institute's status to **offboarding**. Its people can still sign in to download their data.
2. **Giving them their data:**
   - **Ready now:** owners and admins can download rank lists and test results with the CSV buttons.
   - **Not built yet:** a full export (all files and records). For now, run `npm run backup` and give them their
     folder `storage/documents/<institute id>/` plus any CSVs they ask for.
3. **After 30 days** (assumed; to be confirmed): set the status to **suspended**, then delete the institute as the
   `postgres` user:

   ```sql
   delete from public.institutes where id = '<id>'
   ```

   All of its records are deleted with it. The audit record stays.
4. **Its files are deleted automatically:** the worker's daily clean-up (03:00 India time) deletes every file that
   no record points to any more, once it is a day old. To check after two days: Supabase dashboard → Storage → the
   `documents` and `logos` buckets have no `<institute id>/` folder left.
5. Write the date in PROGRESS.md. Copies of the data stay in old backups until those expire. How long backups are kept
   is to be agreed with the lawyer.

## 5. Switching from fake AI to real AI

Today all AI is **fake**: it costs nothing and always gives the same kind of answer, but it is still counted against
the limits. The settings are `AI_PROVIDER=fake` and `EMBEDDINGS_PROVIDER=fake`.

| Feature | Ready for real AI? |
|---|---|
| Tutor answers (Haiku; Sonnet for "Solve step by step") | **Yes** — needs only an Anthropic key |
| Studio: summary (Sonnet), flashcards, mind map, quiz (Haiku) | **Yes** — needs only an Anthropic key |
| Reading scanned pages and photos (OCR, Haiku, in the worker) | **Yes** — needs only an Anthropic key |
| Question bank: AI-made questions (Opus writes, Sonnet checks) | **Yes** — needs only an Anthropic key |
| Finding the right paragraphs (Voyage search) | **No** — not written yet, waiting for the Voyage data terms answer (Q-08) |

**Steps** (on the live site, after you approve the accounts and the cost):
1. Create an Anthropic key and set a spending limit in the Anthropic console.
2. On the website (Vercel), set `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY=<key>`.
   - Keep `EMBEDDINGS_PROVIDER=fake` until the Voyage part is written.
   - On the worker (Render), set the same `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY=<key>` so scanned pages
     and photos are read by Claude.
3. Redeploy. On a test institute, ask the tutor one question, make one summary, make 5 AI questions on the question bank and upload one scanned page (a phone
   photo of handwritten notes). The `/usage` page should show `anthropic` with a real cost, and the uploaded page's
   text should match the photo (check formulas by eye: that is AC4.5).
4. Compare the prices in `packages/core/src/ai/routing.ts` with the provider's price page. Our cost count should be
   within 2% of the provider's bill over about 50 calls.
5. **Later, switching to Voyage:** change `EMBEDDINGS_PROVIDER=voyage` on the website **and** the worker at the same
   time. Then reprocess all notes so every paragraph gets new search data. Search is mixed until that finishes, so do
   it outside class hours.
6. Run the quality checks: `npm run eval -- <change>` and the pilot test questions.

**To undo:** set `AI_PROVIDER=fake` and redeploy, or use **Turn AI off for everyone** (§1) to stop all AI at once.

## 6. Undoing a bad release — BLOCKED (the live site now exists)

- **Website:** Vercel → Deployments → pick the previous working version → **Promote** **[U]**.
- **Worker:** Render → service → previous version → **Redeploy** **[U]**.
- **Database changes are never undone by editing an old one.** Fix a bad change with a new database change.

Practise this once before the pilot.
