'use server';

// Owner payments by UPI (LAUNCH_PLAN step 7). The database computes the amount and checks the caller is the owner;
// the UTR is checked there too (12 digits, unique across all payments).
import { redirect } from 'next/navigation';
import { done, text } from '../form';
import { alertPayment } from '@/lib/email';
import { isFresh, PAY_KINDS, rupees } from '@/lib/billing';
import { checkoutSignatureOk, createOrder, razorpayOn } from '@/lib/razorpay';
import { isUuid, requireMember } from '@/lib/tenant';

export async function startPay(form: FormData) {
  const { institute, db } = await requireMember(['owner']);
  const kind = text(form, 'kind');
  if (!PAY_KINDS.includes(kind)) done('/usage', { code: '23514' });
  const { error } = await db.rpc('start_payment', { inst: institute.id, pay_kind: kind });
  done('/usage', error, 'payment_started');
}

export async function submitUtr(form: FormData) {
  const { institute, db } = await requireMember(['owner']);
  const pay = text(form, 'pay', 40);
  const { error } = await db.rpc('submit_utr', { pay, ref: text(form, 'utr', 30) });
  if (error) done('/usage', error);
  const { data: p } = await db.from('payments').select('kind, total_paise').eq('id', pay).maybeSingle();
  if (p) await alertPayment(institute.name, `${p.kind}: ${rupees(p.total_paise)}`);
  redirect('/usage?ok=utr_sent');
}

// Online payment (ADR-062). The order is made here from the stored payment's amount, never from the browser.
export type Order = { key: string; order: string; amount: number; name: string } | { error: string };

export async function onlineOrder(pay: string): Promise<Order> {
  const { institute, db } = await requireMember(['owner']);
  if (!razorpayOn() || !isUuid(pay)) return { error: 'failed' };
  const { data: p } = await db
    .from('payments')
    .select('id, total_paise, status, utr, razorpay_payment_id, created_at')
    .eq('id', pay)
    .eq('institute_id', institute.id)
    .maybeSingle();
  if (!p || p.status !== 'waiting' || p.utr || p.razorpay_payment_id || !isFresh(p.created_at)) {
    return { error: 'not_available' };
  }
  const order = await createOrder(Number(p.total_paise), p.id);
  if (!order) return { error: 'failed' };
  return { key: process.env.RAZORPAY_KEY_ID!, order, amount: Number(p.total_paise), name: institute.name };
}

// Checkout finished: a valid signature records the payment id like a UTR (the webhook approves; it never comes from here).
export async function onlinePaid(pay: string, order: string, payment: string, signature: string) {
  const { db } = await requireMember(['owner']);
  if (!checkoutSignatureOk(order, payment, signature, process.env.RAZORPAY_KEY_SECRET ?? '')) {
    done('/usage', { message: 'razorpay_invalid' });
  }
  const { error } = await db.rpc('submit_razorpay', { pay, ref: payment });
  done('/usage', error, 'online_paid');
}
