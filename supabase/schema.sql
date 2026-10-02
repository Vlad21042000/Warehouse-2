-- Apply only to the dedicated Warehouse Reporting project.
-- Owner authorization is server-managed app_metadata, never user_metadata.
create table public.warehouse_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null,
  verified_at timestamptz,
  last_sign_in_at timestamptz
);
alter table public.warehouse_profiles enable row level security;
revoke all on public.warehouse_profiles from anon, authenticated;
grant select on public.warehouse_profiles to authenticated;
create policy warehouse_profiles_read on public.warehouse_profiles for select to authenticated
  using ((select auth.uid()) = user_id or ((select auth.jwt()) -> 'app_metadata' ->> 'warehouse_role') = 'owner');

-- This privileged trigger copies only safe profile fields from Auth.
-- Direct invocation is revoked; it does not expose Auth passwords or tokens.
create function public.warehouse_sync_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.warehouse_profiles(user_id, email, created_at, verified_at, last_sign_in_at)
  values(new.id, coalesce(new.email, ''), new.created_at, new.email_confirmed_at, new.last_sign_in_at)
  on conflict(user_id) do update set email = excluded.email, verified_at = excluded.verified_at, last_sign_in_at = excluded.last_sign_in_at;
  return new;
end;
$$;
revoke execute on function public.warehouse_sync_profile() from public, anon, authenticated;
create trigger warehouse_sync_auth_profile after insert or update of email, email_confirmed_at, last_sign_in_at on auth.users
  for each row execute function public.warehouse_sync_profile();
insert into public.warehouse_profiles(user_id, email, created_at, verified_at, last_sign_in_at)
  select id, coalesce(email,''), created_at, email_confirmed_at, last_sign_in_at from auth.users;

create function public.warehouse_valid_snapshot(payload jsonb, report_day date) returns boolean
language plpgsql immutable security invoker set search_path = '' as $$
declare
  t jsonb; field text; stamp numeric;
  start_ms numeric := extract(epoch from (report_day::timestamp at time zone 'UTC')) * 1000;
begin
  if payload ->> 'version' is distinct from '1' or jsonb_typeof(payload -> 'dataset') is distinct from 'object'
    or jsonb_typeof(payload #> '{dataset,transactions}') is distinct from 'array'
    or jsonb_typeof(payload #> '{dataset,source}') is distinct from 'string'
    or length(payload #>> '{dataset,source}') > 500
    or jsonb_typeof(payload #> '{dataset,sheet}') is distinct from 'string'
    or length(payload #>> '{dataset,sheet}') > 200
    or jsonb_typeof(payload #> '{dataset,sample}') is distinct from 'boolean' then return false; end if;
  if jsonb_array_length(payload #> '{dataset,transactions}') not between 1 and 200000 then return false; end if;
  for t in select value from jsonb_array_elements(payload #> '{dataset,transactions}') loop
    if jsonb_typeof(t) is distinct from 'object' or jsonb_typeof(t -> 'activity') is distinct from 'string'
      or t ->> 'activity' not in ('PICK','PUT','RECEIPT','REPLN')
      or jsonb_typeof(t -> 'employee') is distinct from 'string'
      or length(trim(t ->> 'employee')) not between 1 and 200
      or t ->> 'date' is distinct from report_day::text or not (t ? 'timestamp') then return false; end if;
    if t -> 'timestamp' <> 'null'::jsonb then
      if jsonb_typeof(t -> 'timestamp') is distinct from 'number' then return false; end if;
      stamp := (t ->> 'timestamp')::numeric;
      if stamp < start_ms or stamp >= start_ms + 86400000 then return false; end if;
    end if;
    foreach field in array array['order','item','task','trip','from','to','quantity','uom'] loop
      if t ? field and (jsonb_typeof(t -> field) is distinct from 'string' or length(t ->> field) > 1000) then return false; end if;
    end loop;
  end loop;
  return true;
end;
$$;
revoke execute on function public.warehouse_valid_snapshot(jsonb,date) from public, anon;
grant execute on function public.warehouse_valid_snapshot(jsonb,date) to authenticated;

create table public.warehouse_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 120),
  report_date date not null check (report_date between date '1900-01-01' and date '2200-12-31'),
  source text not null check (length(source) <= 500),
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  payload jsonb not null check (octet_length(payload::text) <= 10485760 and public.warehouse_valid_snapshot(payload,report_date)),
  total_lines integer generated always as (jsonb_array_length(payload #> '{dataset,transactions}')) stored,
  pick_lines integer generated always as (jsonb_array_length(jsonb_path_query_array(payload, '$.dataset.transactions[*] ? (@.activity == "PICK")'))) stored,
  put_lines integer generated always as (jsonb_array_length(jsonb_path_query_array(payload, '$.dataset.transactions[*] ? (@.activity == "PUT")'))) stored,
  receipt_lines integer generated always as (jsonb_array_length(jsonb_path_query_array(payload, '$.dataset.transactions[*] ? (@.activity == "RECEIPT")'))) stored,
  repln_lines integer generated always as (jsonb_array_length(jsonb_path_query_array(payload, '$.dataset.transactions[*] ? (@.activity == "REPLN")'))) stored,
  unique(user_id,report_date,fingerprint)
);
create index warehouse_reports_history on public.warehouse_reports(user_id,created_at desc,id desc);
alter table public.warehouse_reports enable row level security;
revoke all on public.warehouse_reports from anon, authenticated;
grant select on public.warehouse_reports to authenticated;
grant insert(user_id,title,report_date,source,fingerprint,payload) on public.warehouse_reports to authenticated;
grant update(archived_at) on public.warehouse_reports to authenticated;
create policy warehouse_reports_read on public.warehouse_reports for select to authenticated
  using ((select auth.uid()) = user_id or ((select auth.jwt()) -> 'app_metadata' ->> 'warehouse_role') = 'owner');
create policy warehouse_reports_insert on public.warehouse_reports for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy warehouse_reports_archive on public.warehouse_reports for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- No DELETE grant: users archive and restore. The owner has read access, not
-- permission to alter other people's reports or promote accounts.
