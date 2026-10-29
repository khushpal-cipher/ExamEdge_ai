// Daily renewal reminder (LAUNCH_PLAN step 8): one email per paid period to the institute's owners, from the
// examedgeai.in sender. Without RESEND_API_KEY nothing is sent and nothing is marked, so it retries once a key exists.
// Logs counts only (no addresses).
import type pg from 'pg';

type Due = { institute_id: string; name: string; paid_until: string; owners: string[] };

export async function remindRenewals(pool: pg.Pool, env = process.env) {
  const key = env.RESEND_API_KEY;
  if (!key) return { due: 0, sent: 0 };
  const { rows } = await pool.query<Due>('select * from private.renewals_due()');
  let sent = 0;
  for (const r of rows) {
    if (!r.owners.length) continue;
    const day = new Date(`${r.paid_until}T00:00:00Z`).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: env.EMAIL_FROM || 'ExamEdge <onboarding@resend.dev>',
        to: r.owners,
        subject: `Renew ${r.name} on ExamEdge`,
        text: `${r.name} is paid up to ${day}.\n\nOpen the Bill page and pay before then. After 3 more days without payment the institute becomes read-only (nothing is deleted).`,
      }),
    }).catch(() => null);
    if (res?.ok) {
      await pool.query('select private.mark_reminded($1, $2)', [r.institute_id, r.paid_until]);
      sent++;
    }
  }
  return { due: rows.length, sent };
}
