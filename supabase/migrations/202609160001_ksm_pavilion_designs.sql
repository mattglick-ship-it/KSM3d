create table public.ksm_pavilion_designs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check (length(btrim(name)) between 1 and 120),
 config jsonb not null check (jsonb_typeof(config) = 'object' and config->>'version' = '1' and octet_length(config::text) < 500000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index ksm_pavilion_designs_owner_updated on public.ksm_pavilion_designs(user_id,updated_at desc);
alter table public.ksm_pavilion_designs enable row level security;
revoke all on public.ksm_pavilion_designs from anon;
grant select,insert,update,delete on public.ksm_pavilion_designs to authenticated;
create policy ksm_design_select on public.ksm_pavilion_designs for select to authenticated using (user_id=(select auth.uid()));
create policy ksm_design_insert on public.ksm_pavilion_designs for insert to authenticated with check (user_id=(select auth.uid()));
create policy ksm_design_update on public.ksm_pavilion_designs for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy ksm_design_delete on public.ksm_pavilion_designs for delete to authenticated using (user_id=(select auth.uid()));
create function public.ksm_pavilion_touch_updated_at() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at=clock_timestamp(); return new; end; $$;
revoke all on function public.ksm_pavilion_touch_updated_at() from public,anon,authenticated;
create trigger ksm_pavilion_designs_updated before update on public.ksm_pavilion_designs for each row execute function public.ksm_pavilion_touch_updated_at();
