import { log } from '@examedge/core/log';

// Invitation emails through Resend's batch API (ADR-035). Without RESEND_API_KEY nothing is sent and the caller keeps
// showing the one-time links. Sent from the Server Function because only it ever holds the raw token (we store a hash).
export type Invite = { email: string; link: string; role: string };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function inviteEmail(institute: string, { email, link, role }: Invite) {
  const who = role === 'owner' || role === 'admin' ? `an ${role}` : `a ${role}`;
  return {
    from: process.env.EMAIL_FROM || 'ExamEdge <onboarding@resend.dev>',
    to: [email],
    subject: `You're invited to ${institute} on ExamEdge`,
    text: `You have been invited to join ${institute} as ${who}.\n\nOpen this link and sign in with ${email}:\n${link}\n\nThe link works once and expires in 7 days.`,
    html: `<p>You have been invited to join <b>${esc(institute)}</b> as ${who}.</p><p><a href="${esc(link)}">Accept the invitation</a> and sign in with ${esc(email)}.</p><p style="color:#666">The link works once and expires in 7 days.</p>`,
  };
}

// Returns the addresses that were accepted by Resend. shortcut: a chunk of 100 succeeds or fails as a whole (strict
// batch validation), so one bad address marks its chunk "not emailed"; switch to per-email results if that bites.
export async function sendInvites(institute: string, invites: Invite[]): Promise<Set<string>> {
  const sent = new Set<string>();
  const key = process.env.RESEND_API_KEY;
  if (!key) return sent;
  for (let i = 0; i < invites.length; i += 100) {
    const chunk = invites.slice(i, i + 100);
    try {
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify(chunk.map((inv) => inviteEmail(institute, inv))),
      });
      if (res.ok) chunk.forEach((inv) => sent.add(inv.email));
      else log.error('email.invite_failed', { status: res.status, count: chunk.length });
    } catch {
      log.error('email.invite_failed', { status: 0, count: chunk.length });
    }
  }
  return sent;
}
