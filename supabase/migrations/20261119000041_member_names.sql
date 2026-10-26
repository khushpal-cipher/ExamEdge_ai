-- Student names (founder change A, 2026-10-26): an invitation may carry the person's name (used when the profile has
-- none), and staff can set the name of the students/teachers of their institute.
alter table public.invitations add column full_name text check (length(full_name) <= 120);

drop function public.create_invitation(uuid, text, text, uuid);
drop function private.create_invitation(uuid, text, text, uuid);

create function private.create_invitation(inst uuid, invite_email text, invite_role text, batch uuid default null,
                                          invite_name text default null)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  token text := encode(extensions.gen_random_bytes(32), 'hex');
  addr text := lower(trim(invite_email));
begin
  if not (
    (invite_role in ('owner', 'admin') and private.has_role(inst, '{owner}'))
    or (invite_role in ('teacher', 'student') and private.has_role(inst, '{owner,admin}'))
    or (invite_role = 'student' and batch is not null and private.has_role(inst, '{teacher}')
        and private.teaches_batch(batch))
  ) then
    raise exception 'not allowed to invite this role' using errcode = '42501';
  end if;
  update public.invitations set revoked_at = now()
  where institute_id = inst and email = addr and accepted_at is null and revoked_at is null;
  if invite_role <> 'owner' and private.seats_full(inst, invite_role, true) then
    raise exception 'seats_full' using errcode = 'P0001';
  end if;
  insert into public.invitations (institute_id, email, role, batch_id, token_hash, created_by, full_name)
  values (inst, addr, invite_role, batch, sha256(convert_to(token, 'UTF8')), (select auth.uid()),
          nullif(left(trim(invite_name), 120), ''));
  return token;
end $$;
create function public.create_invitation(inst uuid, invite_email text, invite_role text, batch uuid default null,
                                         invite_name text default null)
returns text language sql volatile security invoker set search_path = '' as $$
  select private.create_invitation(inst, invite_email, invite_role, batch, invite_name)
$$;
revoke execute on function public.create_invitation(uuid, text, text, uuid, text) from public;
grant execute on function private.create_invitation(uuid, text, text, uuid, text),
  public.create_invitation(uuid, text, text, uuid, text) to authenticated;

-- Same as before, plus: the invited name fills an empty profile name (a name the person already has is kept).
create or replace function private.accept_invitation(token text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  user_email text;
  inv public.invitations;
  mid uuid;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into inv from public.invitations where token_hash = sha256(convert_to(token, 'UTF8')) for update;
  if not found then raise exception 'invitation_invalid' using errcode = 'P0001'; end if;
  if inv.revoked_at is not null or inv.accepted_at is not null or inv.expires_at <= now() then
    raise exception 'invitation_not_usable' using errcode = 'P0001';
  end if;
  select lower(u.email) into user_email from auth.users u where u.id = uid and u.email_confirmed_at is not null;
  if user_email is distinct from inv.email then raise exception 'email_mismatch' using errcode = 'P0001'; end if;
  if exists (select 1 from public.memberships where institute_id = inv.institute_id and user_id = uid) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;
  insert into public.memberships (institute_id, user_id, role) values (inv.institute_id, uid, inv.role)
  returning id into mid;
  if inv.batch_id is not null then
    insert into public.batch_members (batch_id, membership_id, institute_id, batch_role)
    values (inv.batch_id, mid, inv.institute_id, case when inv.role = 'student' then 'student' else 'teacher' end);
  end if;
  update public.profiles set full_name = inv.full_name
  where user_id = uid and inv.full_name is not null and coalesce(trim(full_name), '') = '';
  update public.invitations set accepted_at = now(), accepted_by = uid where id = inv.id;
  return inv.institute_id;
end $$;

-- Staff sets a student's or teacher's name: owner/admin for any student or teacher of the institute, a teacher only
-- for students of their own batches. Owners and admins are never renamed by someone else.
create function private.set_member_name(membership uuid, new_name text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare m public.memberships;
begin
  select * into m from public.memberships where id = membership;
  if not found or m.status = 'removed' then raise exception 'not allowed' using errcode = '42501'; end if;
  if not (
    (m.role in ('student', 'teacher') and private.has_role(m.institute_id, '{owner,admin}'))
    or (m.role = 'student' and private.has_role(m.institute_id, '{teacher}') and private.teaches_member(m.id))
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if length(trim(coalesce(new_name, ''))) not between 1 and 120 then
    raise exception 'name_invalid' using errcode = 'P0001';
  end if;
  update public.profiles set full_name = trim(new_name) where user_id = m.user_id;
end $$;
create function public.set_member_name(membership uuid, new_name text) returns void
language sql volatile security invoker set search_path = '' as $$ select private.set_member_name(membership, new_name) $$;
revoke execute on function public.set_member_name(uuid, text) from public;
grant execute on function private.set_member_name(uuid, text), public.set_member_name(uuid, text) to authenticated;
