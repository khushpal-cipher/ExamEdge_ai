# ExamEdge AI — Runbooks

Status: **Written for the pilot, rehearsed locally only** · Last updated: 2026-10-16 · Labels: see [ARCHITECTURE.md](ARCHITECTURE.md) header.
Steps marked **BLOCKED** need the production accounts (Supabase cloud, Vercel, Railway, Resend, Sentry), which the
founder has not created yet. Everything else was run on the local stack. Record every real run (date, who, result) in
[PROGRESS.md](../PROGRESS.md).

On call: the founder (single person). Every provider account needs 2FA, and its recovery codes go in the password manager.

## 1. Incident response

**First 15 minutes:** contain, then investigate. Write down what you see and the time.

| Situation | Contain (fastest first) |
|---|---|
| AI cost spike or provider abuse | `admin.<root>` → **Turn AI off for everyone** (blocks every AI call from the next request, audited `platform.ai_enabled`). One institute only: Institutes → institute → untick "AI enabled". Then lower the provider spend limit (BLOCKED). |
| Suspected cross-tenant leak | Set the affected institute(s) to **suspended** (Institutes → status): `has_role` refuses every member at once. Keep the logs. Run `npm run test:db` and the isolation E2E on the deployed commit. |
| Leaked key | Follow §2 "suspected leak": revoke first, rotate after. |
| Wrong answer key in a test | Teacher fixes the key → **Recalculate results** on the test (re-grades and recomputes both ranks; ADR-023). |
| Malicious or wrong notes | Teacher/admin **Withdraw** (students lose access on the next request, AC4.3). Uploader is in `audit_events`. |
| Site down | Check Supabase/Vercel/Railway status pages; `/api/health` (web) and the `worker.heartbeat` log line (every minute). Roll back the last deployment (§6). |

**Investigate:** logs are JSON lines with ids only (`packages/core/src/log.ts` removes emails and text). Who did what is
in `audit_events` (owner/admin see their institute, platform admin sees all). AI use per institute/user/feature is in
`usage_records`.

**Afterwards:** write a short note in PROGRESS.md (what happened, impact, fix, follow-ups). If students' personal data
may have been exposed, ask the lawyer about notification duties under DPDP (Q-01) **[U]** before contacting anyone.

## 2. Key rotation

General steps (also [API_AND_SECRETS_INVENTORY.md](API_AND_SECRETS_INVENTORY.md) §4): create the new key → put it in
the secret store → redeploy → check `/api/health` and the worker heartbeat → revoke the old key → note the date in PROGRESS.md.
**Suspected leak:** revoke first, then rotate (accept a few minutes of downtime), then check the provider's usage log for the abuse window.

| Credential | Where it is used | How to rotate |
|---|---|---|
| `ANTHROPIC_API_KEY` | Vercel (web) + Railway (worker) | Anthropic console → new key → both env stores → redeploy both → revoke old. Every 90 days. |
| `VOYAGE_API_KEY` | same | Same steps in the Voyage dashboard (not in use yet, Q-08). |
| Supabase secret key | ops scripts only (never web/worker) | Supabase dashboard → API keys → create new secret key → update the password manager → delete the old one. |
| `WORKER_DATABASE_URL` (role `worker`) | Railway | `alter role worker password '<new>'` as `postgres` (SQL editor) → update Railway → redeploy → heartbeat visible within 1 min. Quarterly. |
| `WORKER_STORAGE_PASSWORD` (worker storage account) | Railway | Supabase Auth → users → worker account → set new password → update Railway → redeploy → upload a test PDF and check it reaches "Ready". |
| Google OAuth client secret | Supabase Auth provider settings | Google Cloud console → add secret → paste in Supabase → test sign-in → delete old secret. Yearly. |
| Platform admin TOTP | founder's authenticator app | Lost phone: sign in with a recovery path agreed in advance **[U: Supabase MFA recovery]**; remove the old factor. |

## 3. Backup and restore

Targets for the pilot: RPO 24 h, RTO 8 h (ARCHITECTURE §6). Supabase's daily backups do **not** include Storage files,
so we also keep our own copy of the database and of every file.

**Local (done, 2026-10-16):** `npm run backup` writes `backups/<time>/` (gitignored): `db.dump` (`pg_dump -Fc`, client
must match the server major version — PostgreSQL 17, `brew install postgresql@17`), `storage/<bucket>/<object>` and
`manifest.json` (row counts per table, size and SHA-256 per file). `npm run restore-drill -- backups/<time>` restores
the dump into a scratch database `restore_drill` as `supabase_admin` (keeps every owner and grant), compares the row
counts of all tables in `public`, `private`, `auth`, `storage`, checks every file's checksum and that each processed
document's stored `sha256` matches its copied file, prints the time, drops the scratch database (`--keep` keeps it)
and exits 1 on any difference.

**Production — BLOCKED until the production project exists:**
1. Nightly: the same backup run from a trusted machine or a scheduled job with the production `DB_URL` and secret key,
   written to independent storage (provider not chosen yet, inventory #10). `scripts/backup.ts` is local-only today
   (it refuses non-local URLs); give it the production settings through env when the project exists.
2. Restore drill (G7, before the pilot and every 90 days): create a scratch Supabase project, restore with Supabase's
   documented dump/restore steps **[U: verify current CLI commands]**, upload the files from the copy, run the same
   row-count and checksum checks, measure the time against RTO 8 h, record it in PROGRESS.md.
3. After any real restore: replay the erasure log (users who asked to be deleted after the backup was taken) before
   reopening (TH-16), then check `/api/health`, sign-in, one tutor answer and one document download.

## 4. Institute offboarding

1. Platform admin sets the institute's status to **offboarding** (members can still sign in to take their data).
2. Export for the institute (owner/admin): batch rank lists and test results (CSV export buttons). A full data export
   (notes files + all tables as files) is **not built yet** — run `npm run backup` and hand over that institute's
   folder under `storage/documents/<institute id>/` plus CSVs on request.
3. After the 30-day grace period (Q-07, assumption): set status **suspended**, then delete the institute row as
   `postgres` (`delete from public.institutes where id = '<id>'`). Every tenant row cascades; audit rows remain with
   their ids (DATABASE_DESIGN §7).
4. Delete the institute's files: every object under `<institute id>/` in the `documents` and `logos` buckets (Supabase
   dashboard → Storage, or the Storage API with the secret key from an ops machine). **[U: no script yet]**
5. Note the date in PROGRESS.md. The deleted data still exists in backups until they age out (7 days of Supabase
   backups + our copies' retention, to be set with the lawyer, Q-06).

## 5. Switching from demo (fake) AI to real providers

Today everything runs with `AI_PROVIDER=fake` and `EMBEDDINGS_PROVIDER=fake` (deterministic, cost 0, still metered).

| Feature | Real provider code | Status |
|---|---|---|
| Tutor answers (Haiku, "Solve step by step" Sonnet) | `packages/core/src/ai/claude.ts` `claudeTutor` | Ready, tested against a recorded stream; needs a key |
| Studio: summary (Sonnet), flashcards, mind map, quiz (Haiku) | `claude.ts` `claudeStudio` | Ready, tested against a recorded response; needs a key |
| OCR of scanned pages/photos | `packages/core/src/ai/ocr.ts` | **Not written** — throws with `AI_PROVIDER=anthropic`. Write Claude PDF/image OCR before switching the worker. |
| Embeddings (Voyage `voyage-4`) | `packages/core/src/ai/embed.ts` | **Not written** — BLOCKED on Q-08 (Voyage data-use terms). |

Steps (production project, with founder approval for the accounts and spend):
1. Create an Anthropic workspace + key for the environment, set a spend limit there.
2. Web (Vercel): `AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY=<key>`. Keep `EMBEDDINGS_PROVIDER=fake` until Q-08 is
   resolved and the Voyage client is written. Worker (Railway): keep `AI_PROVIDER=fake` until Claude OCR exists.
3. Redeploy. Ask one tutor question and generate one summary on a test institute; check `/usage` shows provider
   `anthropic` with real tokens and cost.
4. Check the prices in `packages/core/src/ai/routing.ts` against the provider's page (AC5.2: metered cost within ±2 %
   of the console on a 50-call sample).
5. Switching embeddings later changes every vector: set `EMBEDDINGS_PROVIDER=voyage` on web **and** worker together,
   then re-queue every ready version (reprocess) so old fake vectors are replaced; until that finishes, retrieval mixes
   models — do it outside teaching hours.
6. Run the evals (`npm run eval -- <change>`) and the pilot golden set (AC6.1–AC6.6).

**Roll back:** set `AI_PROVIDER=fake` and redeploy, or use the AI switch (§1) to stop all AI at once.

## 6. Deployment rollback — BLOCKED (no Vercel/Railway projects yet)

Web: Vercel → Deployments → previous production deployment → **Promote** **[U]**. Worker: Railway → service →
previous deployment → **Redeploy** **[U]**. Migrations are forward-only: a bad migration is fixed by a new migration,
never by editing an applied one. Rehearse once before the pilot (AC10.5).
