create table public.ksm_pavilion_admins (
 user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.ksm_pavilion_admins enable row level security;
revoke all on public.ksm_pavilion_admins from anon,authenticated;
grant select on public.ksm_pavilion_admins to authenticated;
create policy own_admin_membership on public.ksm_pavilion_admins for select to authenticated using (user_id=(select auth.uid()));
insert into public.ksm_pavilion_admins(user_id) select id from auth.users where lower(email)='mattglick@tuscinc.com' on conflict do nothing;
create table public.ksm_pavilion_settings (
 id text primary key check(id in ('pricing','defaults')),
 data jsonb not null,
 updated_at timestamptz not null default now()
);
alter table public.ksm_pavilion_settings enable row level security;
revoke all on public.ksm_pavilion_settings from anon,authenticated;
grant select on public.ksm_pavilion_settings to anon,authenticated;
grant insert,update on public.ksm_pavilion_settings to authenticated;
create policy published_settings_read on public.ksm_pavilion_settings for select to anon,authenticated using(true);
create policy admin_settings_insert on public.ksm_pavilion_settings for insert to authenticated with check(exists(select 1 from public.ksm_pavilion_admins where user_id=(select auth.uid())));
create policy admin_settings_update on public.ksm_pavilion_settings for update to authenticated using(exists(select 1 from public.ksm_pavilion_admins where user_id=(select auth.uid()))) with check(exists(select 1 from public.ksm_pavilion_admins where user_id=(select auth.uid())));
create table public.ksm_pavilion_quotes (
 id uuid primary key,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 project_name text not null,
 customer jsonb not null,
 design jsonb not null,
 summary jsonb not null,
 delivery jsonb,
 status text not null default 'new' check(status in ('new','contacted','ordered','closed')),
 email_status text not null default 'pending',
 service_status text not null default 'pending',
 square_order_id text,
 checkout_url text,
 payment_status text not null default 'not_started',
 staff_notes text not null default ''
);
create index ksm_pavilion_quotes_created on public.ksm_pavilion_quotes(created_at desc);
alter table public.ksm_pavilion_quotes enable row level security;
revoke all on public.ksm_pavilion_quotes from anon,authenticated;
grant select on public.ksm_pavilion_quotes to authenticated;
grant update(status,staff_notes) on public.ksm_pavilion_quotes to authenticated;
create policy admin_quotes_select on public.ksm_pavilion_quotes for select to authenticated using(exists(select 1 from public.ksm_pavilion_admins where user_id=(select auth.uid())));
create policy admin_quotes_update on public.ksm_pavilion_quotes for update to authenticated using(exists(select 1 from public.ksm_pavilion_admins where user_id=(select auth.uid()))) with check(exists(select 1 from public.ksm_pavilion_admins where user_id=(select auth.uid())));
grant all on public.ksm_pavilion_admins,public.ksm_pavilion_settings,public.ksm_pavilion_quotes to service_role;
