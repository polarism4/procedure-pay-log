-- Apply once to a new Supabase project, as a database administrator.
begin;
create table public.app_settings (
 user_id uuid primary key references auth.users(id) on delete cascade,
 revision bigint not null default 0,
 default_coverage text not null default 'sss' check(default_coverage in ('sss','private')),
 updated_at timestamptz not null default now()
);
create table public.procedure_types (
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 200),
 sss numeric(12,2) not null check(sss >= 0),
 private numeric(12,2) not null check(private >= 0),
 active boolean not null default true,
 primary key(user_id,name)
);
-- Names/prices are historical snapshots: catalog renames must not rewrite history.
create table public.procedure_entries (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null,
 ts timestamptz not null,
 procedure text not null check(length(trim(procedure)) between 1 and 200),
 "right" text not null check("right" in ('sss','private')),
 qty integer not null check(qty between 1 and 1000000),
 unit numeric(12,2) not null check(unit >= 0),
 total numeric generated always as (qty * unit) stored,
 note text not null default '' check(length(note)<=5000),
 primary key(user_id,id)
);
create index procedure_entries_user_date on public.procedure_entries(user_id,ts desc);
alter table public.app_settings enable row level security;
alter table public.procedure_types enable row level security;
alter table public.procedure_entries enable row level security;
create policy own_settings on public.app_settings for all to authenticated using ((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy own_types on public.procedure_types for all to authenticated using ((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy own_entries on public.procedure_entries for all to authenticated using ((select auth.uid())=user_id) with check((select auth.uid())=user_id);
revoke all on public.app_settings, public.procedure_types, public.procedure_entries from anon,authenticated;
grant select on public.app_settings, public.procedure_types, public.procedure_entries to authenticated;
-- All writes use a locked revision and one transaction; stale devices cannot replace newer data.
create function public.save_pay_log(expected_revision bigint, payload jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); current_revision bigint;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 if jsonb_typeof(payload->'entries') is distinct from 'array' or jsonb_typeof(payload->'prices') is distinct from 'object' then raise exception 'Invalid payload'; end if;
 insert into public.app_settings(user_id) values(uid) on conflict do nothing;
 select revision into current_revision from public.app_settings where user_id=uid for update;
 if expected_revision is distinct from current_revision then raise exception 'REVISION_CONFLICT'; end if;
 delete from public.procedure_entries where user_id=uid;
 delete from public.procedure_types where user_id=uid;
 insert into public.procedure_types(user_id,name,sss,private,active)
 select uid,key,(value->>'sss')::numeric,(value->>'private')::numeric,coalesce((value->>'active')::boolean,true) from jsonb_each(payload->'prices');
 insert into public.procedure_entries(user_id,id,ts,procedure,"right",qty,unit,note)
 select uid,x->>'id',(x->>'ts')::timestamptz,x->>'procedure',x->>'right',(x->>'qty')::integer,(x->>'unit')::numeric,coalesce(x->>'note','') from jsonb_array_elements(payload->'entries') x;
 update public.app_settings set revision=revision+1,updated_at=now() where user_id=uid returning revision into current_revision;
 return current_revision;
end $$;
-- One statement gives an internally consistent snapshot, without REST row limits.
create function public.load_pay_log() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('revision',coalesce((select revision from public.app_settings where user_id=auth.uid()),0),
 'entries',coalesce((select jsonb_agg(to_jsonb(e)-'user_id' order by ts desc) from public.procedure_entries e where user_id=auth.uid()),'[]'::jsonb),
 'prices',coalesce((select jsonb_object_agg(name,jsonb_build_object('sss',sss,'private',private,'active',active)) from public.procedure_types where user_id=auth.uid()),'{}'::jsonb));
$$;
revoke all on function public.save_pay_log(bigint,jsonb),public.load_pay_log() from public,anon;
grant execute on function public.save_pay_log(bigint,jsonb),public.load_pay_log() to authenticated;
commit;
