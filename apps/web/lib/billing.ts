// Billing display helpers (LAUNCH_PLAN steps 5, 7). Money is whole paise in the database; amounts come from the
// database functions, the web only formats them.
export const rupees = (paise: number | string) =>
  `₹${(Number(paise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export const KIND_LABEL: Record<string, string> = {
  monthly: 'Monthly plan',
  yearly: 'Yearly plan (pay 11 months, get 12)',
  extras: 'New accounts, rest of the year',
  topup: 'AI top-up',
};
export const PAY_KINDS = Object.keys(KIND_LABEL);

/** "Pay with UPI" link for a phone (UPI deep link); the payee comes from the server-only UPI_ID setting. */
export function upiLink(upiId: string, paise: number | string, note: string) {
  const q = new URLSearchParams({
    pa: upiId,
    pn: 'ExamEdge AI',
    am: (Number(paise) / 100).toFixed(2),
    cu: 'INR',
    tn: note,
  });
  return `upi://pay?${q.toString()}`;
}

/** An unpaid payment's amount is valid for 24 hours (M7); the database refuses a UTR for an older one. */
export const isFresh = (createdAt: string, now = Date.now()) => Date.parse(createdAt) > now - 86_400_000;
