-- Test-only Gemini provider (ADR-051): usage records may name provider 'google' (free tier, metered at cost 0).
alter table public.usage_records drop constraint usage_records_provider_check;
alter table public.usage_records add constraint usage_records_provider_check
  check (provider in ('fake', 'anthropic', 'google', 'voyage'));
