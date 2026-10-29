# ExamEdge AI — API and Secrets Inventory

Status: **Draft for approval** · Last updated: 2026-10-14 · Labels: see [ARCHITECTURE.md](ARCHITECTURE.md) header.
**This file contains no secret values and must never contain any.** Real values live only in the secret stores in §3.

## 1. Credential types

| Type | Meaning | Example here | Exposure |
|---|---|---|---|
| Config value | Not secret | Supabase project URL, app domain | Public OK |
| Publishable key | Designed to be in browsers; safe because RLS protects data | Supabase publishable key, Razorpay key id, Sentry DSN | Public OK |
| API key / secret key | Grants paid usage or privileged access | Anthropic, Voyage, Resend, Sarvam, Supabase secret key | **Server-only** |
| OAuth client credentials | Identify our app to Google | Google client id (public), client secret (secret) | Secret stored in Supabase Auth settings only |
| Webhook signing secret | Verifies inbound webhooks | Razorpay webhook secret | **Server-only** |
| Database credentials | Postgres login | `worker` role password, migration connection string | **Server/CI-only** |
| CI/deploy tokens | Automate deploys | Supabase access token, Sentry auth token | **CI-only** |

## 2. Integration inventory

| # | Service | What it does | Needed for | Credential(s) | Configured in | Public? | Separate per env | Usage measured by | Failure handling | Rotation |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Supabase (DB/Auth/Storage) | Data, login, files, queue | **MVP** | Project URL (config); publishable key; secret key (ops scripts only); DB password (migrations); `worker` role password | Vercel env, Render env, GitHub Actions secrets, local `.env.local` | URL + publishable: yes; others no | Yes: local / staging / prod projects | Supabase usage dashboard; MAU | Status page; app shows maintenance; retries for transient errors | Rotate secret key/DB passwords on suspicion; quarterly for DB role passwords [R] |
| 2 | Google OAuth | Student/staff sign-in | **MVP** | Client id + client secret | Google Cloud console → pasted into Supabase Auth provider settings (not in our code) | id yes, secret no | Yes (separate OAuth clients per env; redirect URLs differ) | Google Cloud console | Login unavailable → status message | Rotate secret yearly or on suspicion; non-sensitive scopes only (openid, email, profile); brand-verification need **[U]** |
| 3 | Anthropic (Claude) | Tutor, generation, OCR | **MVP** | API key | Vercel + Render env | No | Yes (separate workspace + key per env [U: verify workspace spend limits]) | `usage_records` + Anthropic console | Gateway retry once on 429/5xx; refusal handling; feature degrades with message | 90 days or on suspicion; revoke in console |
| 4 | Voyage AI | Embeddings, rerank | **MVP** | API key | Vercel + Render env | No | Yes | `usage_records` (tokens) + Voyage dashboard | Ingestion job retries; tutor falls back to keyword-only retrieval | 90 days; data-use terms **[U] Q-08** |
| 5 | Resend | Invitation and notification email | **MVP** | API key; DNS records (SPF/DKIM) | Render env (worker sends) | No | Yes (staging uses a test domain) | Resend dashboard | Queue retry; invitation remains copyable link for admins | 90 days |
| 6 | Sentry | Errors/traces | **MVP** | DSN (public); auth token for source maps (CI) | Vercel/Render env; GitHub secrets | DSN yes | Yes (environments within one project) | Sentry quota | Non-blocking | Auth token yearly |
| 7 | Vercel | Web hosting | **MVP** | GitHub integration (no token in repo) | Vercel dashboard | — | Preview/Production environments | Vercel usage | Rollback to previous deployment | Team member 2FA |
| 8 | Render | Worker hosting | **MVP** | GitHub integration or deploy hook (CI) | Render / GitHub secrets | No | staging / production services | Render dashboard | Restart policy; jobs persist in Postgres | Token on suspicion |
| 9 | GitHub | Code, CI | **MVP** | Actions secrets: `SUPABASE_ACCESS_TOKEN`, staging/prod DB URLs | GitHub repo settings (environments with required reviewers for prod) | No | staging/prod environments | — | — | Yearly |
| 10 | Backup storage (independent) | Nightly DB dump + storage copy | **Before pilot** | Access key pair | Render env (backup job) | No | prod only | provider dashboard | Alert on failure | 90 days [D: provider] |
| 11 | Sarvam AI | TTS (audio overviews, video narration) | R2 | API subscription key | Render env | No | Yes | `usage_records` (characters) | Per-line retry; English fallback voice [D] | 90 days |
| 12 | Razorpay | Subscriptions, payments | R2 | Key id (public), key secret, webhook secret | Vercel env | key id yes | Yes (test mode vs live mode keys) | Razorpay dashboard | Webhook retries are idempotent | On suspicion; webhook secret rotation supports old-secret validation window [V] |
| 13 | Anthropic web search | Current affairs | R3 | (same Anthropic key) | — | — | — | per search | Disable per subject | — |
| 14 | Remotion licence | Video rendering | R3 | Licence (not a runtime secret) [U] | — | — | — | — | — | — |

**Deliberately not added:** Redis, separate vector DB, separate queue service, OpenAI/Gemini keys, analytics SaaS — none is needed for the MVP (DECISIONS ADR-006/007).

## 3. Where secrets live

| Store | Holds | Notes |
|---|---|---|
| Vercel environment variables | Web-side server secrets per environment (Production / Preview) | Only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SENTRY_DSN` may use the `NEXT_PUBLIC_` prefix |
| Render variables | Worker secrets per environment | Includes `WORKER_DATABASE_URL` (worker role) |
| Supabase dashboard | Google client secret | Never in app env |
| GitHub Actions environments | Migration + deploy tokens | `production` environment requires manual approval |
| Local `.env.local` (gitignored) | Developer's dev-environment keys | `.env.example` lists **names only** |
| Password manager | Root/provider account credentials, recovery codes | 2FA on every provider account |

Upgrade to a dedicated secrets manager (Doppler/Infisical) only if the count of environments or people grows [D].

## 4. Rotation and revocation runbook (summary)
1. Create the new credential at the provider (keep old active).
2. Update the secret store for the affected environment(s); redeploy web/worker.
3. Verify with the health check (`/api/health` + worker heartbeat job).
4. Revoke the old credential. Record date and reason in `audit_events` (platform) and PROGRESS.md.
5. On suspected leak: revoke **first**, then rotate (accept brief downtime); check provider usage logs for abuse window.

## 5. Credential count (estimate, after stack is final)

| Environment | Secret items (excluding publishable/config) |
|---|---|
| Local | ~5 (Anthropic, Voyage, Resend test, local DB is default creds) |
| Staging | ~9 (Supabase secret key, DB migration URL, worker DB URL, Anthropic, Voyage, Resend, Sentry auth token, Supabase access token, Google client secret) |
| Production | ~10 (staging set + backup storage key) |
| **MVP total** | **≈ 24 secret items + ≈ 9 public config values** [E] |
| R2 adds | Sarvam ×2 envs, Razorpay key secret + webhook secret ×2 envs → **+6** |

Counts are estimates; the authoritative list is `.env.example` + this table once Phase 1 creates them.
