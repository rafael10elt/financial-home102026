-- FH-SQL-001 (espelho de banco.sql) - manter sincronizado com o livro banco.sql
-- Fonte autoritativa: banco.sql, secao FH-SQL-001

begin;

-- gen_random_bytes() vem do pgcrypto (necessario para o join_code).
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Tabelas
-- ---------------------------------------------------------------------
create table if not exists public.households_fh (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  join_code   text not null unique
              default upper(encode(gen_random_bytes(6), 'hex')),
  created_by  uuid not null default auth.uid(),
  created_at  timestamptz not null default now()
);

create table if not exists public.household_members_fh (
  household_id uuid not null references public.households_fh (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'member')),
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index if not exists household_members_fh_user_idx
  on public.household_members_fh (user_id);

create table if not exists public.profiles_fh (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null check (char_length(btrim(display_name)) between 1 and 80),
  household_id  uuid references public.households_fh (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists profiles_fh_household_idx
  on public.profiles_fh (household_id);

create table if not exists public.user_settings_fh (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Funcoes auxiliares
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at_fh()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Recupera a casa do usuario autenticado.
-- SECURITY DEFINER: le profiles_fh sem depender de RLS (evita recursao).
create or replace function public.current_household_id_fh()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.household_id
  from public.profiles_fh p
  where p.id = auth.uid()
  limit 1;
$$;

-- Verifica se o usuario autenticado pertence a casa informada.
-- SECURITY DEFINER: necessaria porque as policies referenciam esta tabela
-- (sem isso o Postgres acusa recursao de RLS).
create or replace function public.is_household_member_fh(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members_fh m
    where m.household_id = p_household_id
      and m.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------
-- 3. Perfil automatico no cadastro (trigger em auth.users)
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user_fh()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles_fh (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(coalesce(new.email, 'user'), '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists t_auth_users_fh on auth.users;
create trigger t_auth_users_fh
  after insert on auth.users
  for each row execute function public.handle_new_user_fh();

-- ---------------------------------------------------------------------
-- 4. Funcoes de criacao e entrada de casa (SECURITY DEFINER)
-- ---------------------------------------------------------------------
-- Garante um perfil mesmo que o trigger ja tenha rodado antes desta migracao.
create or replace function public.create_household_fh(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_household_id uuid;
begin
  if v_user is null then
    raise exception 'autenticacao_requerida';
  end if;
  if p_name is null or char_length(btrim(p_name)) = 0 then
    raise exception 'nome_invalido';
  end if;
  if exists (
    select 1 from public.household_members_fh where user_id = v_user
  ) then
    raise exception 'usuario_ja_pertence_a_uma_casa';
  end if;

  insert into public.profiles_fh (id, display_name)
  values (
    v_user,
    coalesce(
      nullif(trim((select u.raw_user_meta_data ->> 'display_name'
                   from auth.users u where u.id = v_user)), ''),
      split_part(coalesce((select u.email from auth.users u where u.id = v_user), 'user'), '@', 1)
    )
  )
  on conflict (id) do nothing;

  insert into public.households_fh (name, created_by)
  values (btrim(p_name), v_user)
  returning id into v_household_id;

  insert into public.household_members_fh (household_id, user_id, role)
  values (v_household_id, v_user, 'owner');

  update public.profiles_fh
    set household_id = v_household_id
    where id = v_user;

  return v_household_id;
end;
$$;

create or replace function public.join_household_by_code_fh(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_household_id uuid;
begin
  if v_user is null then
    raise exception 'autenticacao_requerida';
  end if;

  select id into v_household_id
  from public.households_fh
  where join_code = v_code;

  if v_household_id is null then
    raise exception 'codigo_invalido';
  end if;

  insert into public.profiles_fh (id, display_name)
  values (
    v_user,
    coalesce(
      nullif(trim((select u.raw_user_meta_data ->> 'display_name'
                   from auth.users u where u.id = v_user)), ''),
      split_part(coalesce((select u.email from auth.users u where u.id = v_user), 'user'), '@', 1)
    )
  )
  on conflict (id) do nothing;

  insert into public.household_members_fh (household_id, user_id, role)
  values (v_household_id, v_user, 'member')
  on conflict (household_id, user_id) do nothing;

  update public.profiles_fh
    set household_id = v_household_id
    where id = v_user;

  return v_household_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Triggers de updated_at
-- ---------------------------------------------------------------------
drop trigger if exists t_profiles_fh_updated on public.profiles_fh;
create trigger t_profiles_fh_updated
  before update on public.profiles_fh
  for each row execute function public.set_updated_at_fh();

drop trigger if exists t_user_settings_fh_updated on public.user_settings_fh;
create trigger t_user_settings_fh_updated
  before update on public.user_settings_fh
  for each row execute function public.set_updated_at_fh();

-- ---------------------------------------------------------------------
-- 6. Row Level Security
-- ---------------------------------------------------------------------
alter table public.households_fh enable row level security;
alter table public.household_members_fh enable row level security;
alter table public.profiles_fh enable row level security;
alter table public.user_settings_fh enable row level security;

-- households_fh: membros leem; criacao/exclusao so via funcao; update apenas owner.
drop policy if exists households_fh_select on public.households_fh;
create policy households_fh_select on public.households_fh
  for select
  to authenticated
  using (public.is_household_member_fh(id));

drop policy if exists households_fh_update on public.households_fh;
create policy households_fh_update on public.households_fh
  for update
  to authenticated
  using (created_by = auth.uid() and public.is_household_member_fh(id))
  with check (created_by = auth.uid() and public.is_household_member_fh(id));

drop policy if exists households_fh_delete on public.households_fh;
create policy households_fh_delete on public.households_fh
  for delete
  to authenticated
  using (created_by = auth.uid() and public.is_household_member_fh(id));
-- Sem policy de INSERT: so create_household_fh (SECURITY DEFINER) insere.

-- household_members_fh: leitura para membros da mesma casa; escrita apenas via funcao.
drop policy if exists household_members_fh_select on public.household_members_fh;
create policy household_members_fh_select on public.household_members_fh
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_household_member_fh(household_id));
-- Sem policies de INSERT/UPDATE/DELETE: escrita exclusiva das funcoes.

-- profiles_fh: o proprio usuario e os membros da mesma casa leem;
-- o proprio usuario edita somente o proprio perfil.
drop policy if exists profiles_fh_select on public.profiles_fh;
create policy profiles_fh_select on public.profiles_fh
  for select
  to authenticated
  using (
    id = auth.uid()
    or (household_id is not null and public.is_household_member_fh(household_id))
  );

drop policy if exists profiles_fh_insert on public.profiles_fh;
create policy profiles_fh_insert on public.profiles_fh
  for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_fh_update on public.profiles_fh;
create policy profiles_fh_update on public.profiles_fh
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- user_settings_fh: estritamente pessoal.
drop policy if exists user_settings_fh_all on public.user_settings_fh;
create policy user_settings_fh_all on public.user_settings_fh
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 7. Permissoes de execucao das funcoes
-- ---------------------------------------------------------------------
revoke all on function public.create_household_fh(text) from public, anon;
revoke all on function public.join_household_by_code_fh(text) from public, anon;
grant execute on function public.create_household_fh(text) to authenticated;
grant execute on function public.join_household_by_code_fh(text) to authenticated;
grant execute on function public.current_household_id_fh() to authenticated;
grant execute on function public.is_household_member_fh(uuid) to authenticated;

commit