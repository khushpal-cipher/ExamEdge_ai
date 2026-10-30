-- Yearly plan: pay 11 months, get 12 (founder, 2026-10-30; was 10). Nobody has paid yet, so the current price list
-- is changed in place; once a coaching has paid, add a new price list instead (a coaching keeps its list until renewal).
update public.price_lists set yearly_months_paid = 11;
