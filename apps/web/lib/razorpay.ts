import { createHmac, timingSafeEqual } from 'node:crypto';
import { log } from '@examedge/core/log';

// Razorpay Standard Checkout (ADR-062). Server-only: Key ID and Key Secret come from Vercel env. Without both, the
// Bill page offers only the manual UPI payment. The webhook secret is not here: the database checks webhooks.
export const razorpayOn = () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

const hmac = (data: string, secret: string) => createHmac('sha256', secret).update(data).digest('hex');

/** Checkout's success handler returns this signature: HMAC-SHA256(order_id|payment_id, key secret). */
export function checkoutSignatureOk(orderId: string, paymentId: string, signature: string, secret: string) {
  const want = Buffer.from(hmac(`${orderId}|${paymentId}`, secret));
  const got = Buffer.from(signature);
  return want.length === got.length && timingSafeEqual(want, got);
}

/** One order for one stored payment: the amount is the database's total, the receipt is our payment id (the
 *  webhook matches on it). Returns the order id or null. */
export async function createOrder(paise: number, paymentId: string): Promise<string | null> {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  try {
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { authorization: `Basic ${auth}`, 'content-type': 'application/json' },
      body: JSON.stringify({ amount: paise, currency: 'INR', receipt: paymentId }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      log.error('razorpay.order_failed', { status: res.status });
      return null;
    }
    return ((await res.json()) as { id?: string }).id ?? null;
  } catch {
    log.error('razorpay.order_failed', { status: 0 });
    return null;
  }
}
