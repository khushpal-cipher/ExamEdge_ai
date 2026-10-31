'use client';

import Script from 'next/script';
import { useState } from 'react';
import { onlineOrder, onlinePaid } from './actions';

type Success = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type Checkout = { open: () => void };
declare global {
  interface Window {
    Razorpay?: new (options: object) => Checkout;
  }
}

// Razorpay Standard Checkout for one stored payment (ADR-062). The server makes the order; this only opens it.
export function PayOnline({ pay }: { pay: string }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  async function start() {
    setBusy(true);
    setProblem('');
    const o = await onlineOrder(pay);
    if ('error' in o || !window.Razorpay) {
      setProblem('Online payment is not available right now. Pay by UPI below, or try again in a minute.');
      setBusy(false);
      return;
    }
    new window.Razorpay({
      key: o.key,
      order_id: o.order,
      amount: o.amount,
      currency: 'INR',
      name: 'ExamEdge AI',
      description: o.name,
      handler: (r: Success) => onlinePaid(pay, r.razorpay_order_id, r.razorpay_payment_id, r.razorpay_signature),
      modal: { ondismiss: () => setBusy(false) },
    }).open();
  }

  return (
    <div className="stack">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />
      <p>
        <button type="button" className="primary" onClick={start} disabled={busy}>
          {busy ? 'Opening…' : 'Pay online'}
        </button>{' '}
        <span className="muted small">UPI, card or netbanking through Razorpay. Approved automatically.</span>
      </p>
      {problem && (
        <p role="alert" className="alert">
          {problem}
        </p>
      )}
    </div>
  );
}
