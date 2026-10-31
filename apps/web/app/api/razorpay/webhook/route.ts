import { createClient } from '@supabase/supabase-js';
import { log } from '@examedge/core/log';
import { alertPayment } from '@/lib/email';

// Razorpay webhook (ADR-062, TH-13). No user is signed in, so this only forwards the raw body: the database checks
// the HMAC signature, keeps each event id once and approves a matching order.paid. Subscribe only to order.paid.
const NEEDS_CHECK = ['unmatched', 'not_waiting', 'amount_mismatch'];

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('x-razorpay-signature');
  const eventId = request.headers.get('x-razorpay-event-id');
  if (!signature || !eventId || eventId.length > 100 || body.length > 100_000) {
    return new Response(null, { status: 400 });
  }
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
  const { data, error } = await db.rpc('razorpay_webhook', { body, signature, event_id: eventId });
  if (error) {
    log.error('razorpay.webhook_failed', { code: error.code, reason: error.message.slice(0, 40) });
    // a bad signature is final; anything else (not configured, database down) lets Razorpay retry
    return new Response(null, { status: error.message === 'bad_signature' ? 400 : 503 });
  }
  if (NEEDS_CHECK.includes(data)) {
    log.error('razorpay.webhook_unmatched', { result: data });
    await alertPayment(
      'Razorpay',
      `Webhook result: ${data}.`,
      'A Razorpay payment could not be approved automatically.\nSee audit "billing.razorpay_unmatched" and the Razorpay dashboard; refund by hand if needed.',
    );
  }
  return Response.json({ result: data });
}
