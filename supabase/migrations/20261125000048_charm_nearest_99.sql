-- Founder, 2026-10-29: charm prices always end in 99, at the nearest one (₹6,200 -> ₹6,199, ₹89,445 -> ₹89,399,
-- ₹89,460 -> ₹89,499, ₹2,500 -> ₹2,499). Replaces the "₹1 less" rule of migration 47. Amounts below ₹100 stay as they are.
create or replace function private.charm(raw bigint) returns bigint
language sql immutable security invoker set search_path = '' as $$
  select case when raw >= 10000 then round((raw + 100) / 10000.0)::bigint * 10000 - 100 else raw end $$;
