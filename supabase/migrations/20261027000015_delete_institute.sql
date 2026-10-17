-- Platform admin: delete an institute created by mistake (wrong owner email, typo in the address).
-- Only while nobody has joined it, so no tenant data can be lost; institutes with members go through
-- suspended -> offboarding (RUNBOOKS.md). The audit trigger on institutes records the delete (ADR-033).
create function private.delete_institute(inst uuid, confirm_slug text)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  s text;
begin
  if not private.is_platform_admin() then
    raise exception 'platform admin with MFA required' using errcode = '42501';
  end if;
  select slug::text into s from public.institutes where id = inst for update;
  if s is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if lower(trim(confirm_slug)) is distinct from s then
    raise exception 'confirm_mismatch' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.memberships where institute_id = inst) then
    raise exception 'has_members' using errcode = 'P0001';
  end if;
  delete from public.institutes where id = inst;
end $$;
create function public.delete_institute(inst uuid, confirm_slug text)
returns void language sql volatile security invoker set search_path = '' as $$
  select private.delete_institute(inst, confirm_slug)
$$;

revoke execute on function private.delete_institute(uuid, text) from public;
grant execute on function private.delete_institute(uuid, text) to authenticated;
revoke execute on function public.delete_institute(uuid, text) from public;
grant execute on function public.delete_institute(uuid, text) to authenticated;
