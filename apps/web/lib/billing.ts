// Billing display helpers (LAUNCH_PLAN steps 5, 7). Money is whole paise in the database; amounts come from the
// database functions, the web only formats them.
export const rupees = (paise: number | string) =>
  `₹${(Number(paise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export const KIND_LABEL: Record<string, string> = {
  monthly: 'Monthly plan',
  yearly: 'Yearly plan (pay 10 months, get 12)',
  extras: 'Extra accounts this quarter',
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
