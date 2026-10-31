import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkoutSignatureOk, createOrder } from './razorpay';

const sign = (s: string) => createHmac('sha256', 'key-secret').update(s).digest('hex');

describe('checkoutSignatureOk', () => {
  it('accepts the signature of order_id|payment_id', () => {
    expect(checkoutSignatureOk('order_A', 'pay_B', sign('order_A|pay_B'), 'key-secret')).toBe(true);
  });
  it('refuses another payment, another secret or garbage', () => {
    expect(checkoutSignatureOk('order_A', 'pay_C', sign('order_A|pay_B'), 'key-secret')).toBe(false);
    expect(checkoutSignatureOk('order_A', 'pay_B', sign('order_A|pay_B'), 'other')).toBe(false);
    expect(checkoutSignatureOk('order_A', 'pay_B', 'short', 'key-secret')).toBe(false);
  });
});

describe('createOrder', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('sends the stored amount in paise with our payment id as receipt', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'order_X' })));
    vi.stubGlobal('fetch', fetchMock);
    expect(await createOrder(599900, 'pay-uuid')).toBe('order_X');
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({
      amount: 599900,
      currency: 'INR',
      receipt: 'pay-uuid',
    });
  });
  it('returns null when Razorpay refuses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    expect(await createOrder(100, 'x')).toBeNull();
  });
});
