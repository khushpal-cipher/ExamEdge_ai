'use server';

// Owner payments by UPI (LAUNCH_PLAN step 7). The database computes the amount and checks the caller is the owner;
// the UTR is checked there too (12 digits, unique across all payments).
import { redirect } from 'next/navigation';
import { done, text } from '../form';
import { alertPayment } from '@/lib/email';
import { PAY_KINDS, rupees } from '@/lib/billing';
import { requireMember } from '@/lib/tenant';

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
