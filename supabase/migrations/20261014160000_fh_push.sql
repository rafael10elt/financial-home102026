-- FH-SQL-006 (espelho de banco.sql) - manter sincronizado com o livro banco.sql
-- Fonte autoritativa: banco.sql, secao FH-SQL-006

begin;

create table if not exists public.push_subscriptions_fh (
  user_id    uuid not null references public.profiles_fh (id) on delete cascade,
  endpoint   text not null,
  keys       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, endpoint)
);

alter table public.push_subscriptions_fh enable row level security;

drop policy if exists push_subscriptions_fh_select on public.push_subscriptions_fh;
create policy push_subscriptions_fh_select on public.push_subscriptions_fh
  for select to anon, authenticated using (user_id = public.current_profile_id_fh());

drop policy if exists push_subscriptions_fh_insert on public.push_subscriptions_fh;
create policy push_subscriptions_fh_insert on public.push_subscriptions_fh
  for insert to anon, authenticated with check (user_id = public.current_profile_id_fh());

drop policy if exists push_subscriptions_fh_delete on public.push_subscriptions_fh;
create policy push_subscriptions_fh_delete on public.push_subscriptions_fh
  for delete to anon, authenticated using (user_id = public.current_profile_id_fh());

commit
