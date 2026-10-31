// ADR-062, T-SEC-13: the Razorpay webhook route forwards the raw body; the database checks the signature, approves a
// matching order.paid once and ignores a replay. Needs `npm run seed:demo` (Demo Classes).
import { createHmac } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { instituteId, sql } from './helpers';

const SECRET = 'e2e-webhook-secret';

test('webhook: bad signature 400, signed order.paid approves once, replay does nothing', async ({ request }) => {
  const inst = await instituteId('demo.localhost');
  const { rows: old } = await sql(`select razorpay_webhook_secret as s from private.settings`);
  await sql(`update private.settings set razorpay_webhook_secret = $1 where id`, [SECRET]);
  const { rows } = await sql(
    `insert into public.payments (institute_id, kind, price_list_id, base_paise, gst_paise, total_paise)
     values ($1, 'topup', private.newest_price_list(), 9900, 0, 9900) returning id`,
    [inst],
  );
  const pay = rows[0].id as string;
  const eventId = `evt_e2e_${Date.now()}`;
  try {
    const body = JSON.stringify({
      event: 'order.paid',
      payload: {
        payment: { entity: { id: 'pay_E2eTest0000001', amount: 9900, currency: 'INR', status: 'captured' } },
        order: {
          entity: { id: 'order_E2eTest00001', amount_paid: 9900, currency: 'INR', receipt: pay, status: 'paid' },
        },
      },
    });
    const sig = createHmac('sha256', SECRET).update(body).digest('hex');
    const post = (signature: string | null) =>
      request.post('/api/razorpay/webhook', {
        data: body,
        headers: {
          'content-type': 'application/json',
          'x-razorpay-event-id': eventId,
          ...(signature ? { 'x-razorpay-signature': signature } : {}),
        },
      });

    expect((await post(null)).status()).toBe(400);
    expect((await post('0'.repeat(64))).status()).toBe(400);
    const { rows: still } = await sql(`select status from public.payments where id = $1`, [pay]);
    expect(still[0].status).toBe('waiting');

    const ok = await post(sig);
    expect(ok.status()).toBe(200);
    expect(await ok.json()).toEqual({ result: 'approved' });
    expect(await (await post(sig)).json()).toEqual({ result: 'duplicate' });
    const { rows: after } = await sql(`select status, razorpay_payment_id from public.payments where id = $1`, [pay]);
    expect(after[0]).toEqual({ status: 'approved', razorpay_payment_id: 'pay_E2eTest0000001' });
  } finally {
    await sql(`delete from private.payment_events where event_id = $1`, [eventId]);
    await sql(`delete from public.payments where id = $1`, [pay]);
    await sql(`update private.settings set razorpay_webhook_secret = $1 where id`, [old[0].s]);
  }
});
