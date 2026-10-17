-- Platform admin: send a new owner invitation (wrong owner email, lost or expired link) while the institute has
-- no owner yet. Revokes every pending owner invitation, so an old link stops working, and returns the new raw
-- token once (only its hash is stored). The audit trigger on invitations records both changes (ADR-036).
create function private.reinvite_owner(inst uuid, owner_email text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if not private.is_platform_admin() then
    raise exception 'platform admin with MFA required' using errcode = '42501';
  end if;
  perform 1 from public.institutes where id = inst for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.memberships where institute_id = inst and role = 'owner' and status = 'active') then
    raise exception 'has_owner' using errcode = 'P0001';
  end if;
  update public.invitations set revoked_at = now()
  where institute_id = inst and role = 'owner' and accepted_at is null and revoked_at is null;
  insert into public.invitations (institute_id, email, role, token_hash, created_by)
  values (inst, lower(trim(owner_email)), 'owner', sha256(convert_to(token, 'UTF8')), (select auth.uid()));
  return token;
end $$;
create function public.reinvite_owner(inst uuid, owner_email text)
returns text language sql volatile security invoker set search_path = '' as $$
  select private.reinvite_owner(inst, owner_email)
$$;

revoke execute on function private.reinvite_owner(uuid, text) from public;
grant execute on function private.reinvite_owner(uuid, text) to authenticated;
revoke execute on function public.reinvite_owner(uuid, text) from public;
grant execute on function public.reinvite_owner(uuid, text) to authenticated;
