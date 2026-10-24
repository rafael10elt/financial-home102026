-- =====================================================================
-- Financial Home 102026 — Livro cumulativo de alterações de banco
-- =====================================================================
--
-- PROPÓSITO
-- Este é a fonte única de SQL do projeto. Todo comando de banco destinado
-- ao Supabase deve ser registrado aqui, em seção identificada, antes de ser
-- executado. O usuário revisa e executa manualmente no Supabase SQL Editor.
--
-- REGRAS DE INTEGRIDADE
--  * Nunca executar SQL no Supabase sem autorização explícita do usuário.
--  * Nunca remover migrações históricas. Correções entram como NOVOS blocos
--    de compensação/correção, com novo identificador.
--  * Nenhum segredo, chave, token ou senha pode aparecer neste arquivo.
--  * Todo objeto personalizado termina em `_fh`. O app nao usa auth.users
--    nem auth.uid(); o Supabase continua hospedando Postgres e Storage.
--  * SQL pronto para execução é sempre separado e rotulado de SQL
--    demonstrativo/exploratório.
--  * Verificar o esquema existente antes de preparar uma migração, para
--    evitar duplicações.
--
-- CONVENÇÃO DE IDENTIFICADOR
--  FH-SQL-NNN  (FH = Financial Home, SQL = tipo de artefato, NNN = sequência)
--
-- ESTADOS CONHECIDOS DE UM BLOCO
--  [preparado]           escrito e revisado, aguardando execução pelo usuário
--  [executado-pelo-usuario]  usuário informou que rodou no Supabase
--  [confirmado]          evidência de execução verificada (consulta de
--                        validação retornou o esperado)
--  [bloqueado]           não pode ser preparado ainda (dependência ausente)
--  [compensado]          neutralizado por um bloco posterior
--
-- COMO USAR
--  1. Localize a seção desejada pelo identificador FH-SQL-NNN.
--  2. Copie o bloco SQL completo para o Supabase SQL Editor.
--  3. Execute dentro de uma transação quando disponível/recomendado.
--  4. Rode as "Consultas de validação" e confirme o resultado.
--  5. Atualize o estado do bloco nesta rodada e registre em `diario.md`.
-- =====================================================================


-- =====================================================================
-- ÍNDICE DE BLOCOS
-- ---------------------------------------------------------------------
--
-- FH-SQL-000 | Fase 0 | 2026-10-11 | Cabeçalho e convenções (sem DDL)   [preparado]
-- FH-SQL-001 | Fase 1 | 2026-10-11 | Casa, membros, perfis, preferências e RLS  [preparado para banco novo]
-- FH-SQL-002 | Fase 2 | 2026-10-14 | Agenda, recorrencia, categorias, notificacoes e layout  [preparado]
-- FH-SQL-003 | Fase 3 | 2026-10-14 | Financas: contas, lancamentos, recorrencias, transferencias, metas, cambio, importacao, auditoria  [preparado]
-- FH-SQL-004 | Fase 4 | 2026-10-14 | Diario: posts, midia, fotos, humor, dicas, anuncios, fofocas + Storage  [preparado]
-- FH-SQL-005 | Fase 5 | 2026-10-14 | IA: config Groq, conversas, mensagens, memoria, logs + webhooks n8n  [preparado]
-- FH-SQL-006 | Fase 6 | 2026-10-14 | Push: inscricoes de notificacao push por usuario  [preparado]
-- FH-SQL-007 | Diagnostico | 2026-10-24 | Verificacao somente leitura de casas e membros  [preparado]
-- FH-SQL-008 | Identidade local | 2026-10-24 | Perfis Jéssica/Rafael e RLS por x-profile-id  [incluido no FH-SQL-001]
-- FH-SQL-009 | IA | 2026-10-24 | Chave Groq única e global, compartilhada por todos os perfis [preparado]
-- =====================================================================


-- =====================================================================
-- FH-SQL-000 — Cabeçalho e convenções do livro
-- Data: 2026-10-11
-- Fase: 0 — Inspeção e planejamento
-- Objetivo: Abrir o livro cumulativo. NÃO contém DDL nem DML.
-- Dependências: nenhuma.
-- Objetos criados: nenhum.
-- Efeito esperado: nenhum efeito no banco (arquivo de documentação).
-- Riscos: nenhum. Rollback: não aplicável.
-- Estado: [preparado] — nada a executar no Supabase.
--
-- Nota: o esquema do projeto ainda não existe. Os blocos FH-SQL-001 em
-- diante serão preparados na Fase 1 (fundação: casas, membros, perfis,
-- preferências, RLS) somente após inspeção do esquema real do Supabase e
-- aprovação do plano pelo usuário.
-- =====================================================================

SELECT 'FH-SQL-000: livro banco.sql aberto. Nenhum objeto criado.' AS fh_check;

-- =====================================================================
-- FH-SQL-001 - Casa, membros, perfis, preferencias e RLS
-- Tipo: migracao nova
-- Data: 2026-10-11
-- Fase: 1 - Fundacao
-- Objetivo: criar o nucleo de identidade domestica com perfis locais fixos,
--           funcoes de casa e RLS que usa o header do perfil selecionado.
-- Dependencias: projeto Supabase ativo (sem provedor de Auth).
-- Pre-requisito: nenhum objeto `*_fh` existente (bloco inedito).
--
-- Objetos criados:
--   Tabelas: households_fh, household_members_fh, profiles_fh, user_settings_fh
--   Funcoes: set_updated_at_fh(), current_profile_id_fh(), current_household_id_fh(),
--            is_household_member_fh(uuid),
--            create_household_fh(text), join_household_by_code_fh(text)
--   Perfis iniciais: Jéssica e Rafael (UUIDs fixos)
--   Policies RLS nas 4 tabelas
--
-- Efeito esperado:
--   * A escolha de perfil seleciona a linha existente em profiles_fh.
--   * O perfil selecionado pode criar uma casa (vira owner) ou entrar com codigo.
--   * Membros da mesma casa veem os registros um do outro.
--   * Preferencias pessoais ficam protegidas: so o proprio usuario le/grava.
--   * Escritas diretas em household_members_fh sao bloqueadas: apenas as
--     funcoes SECURITY DEFINER inserem membros.
--
-- Riscos e rollback:
--   * Baixo risco. Nao ha dados a migrar (banco novo).
--   * Rollback (somente se nada mais tiver sido criado depois):
--
--     DROP FUNCTION IF EXISTS public.current_profile_id_fh();
--     DROP FUNCTION IF EXISTS public.join_household_by_code_fh(text);
--     DROP FUNCTION IF EXISTS public.create_household_fh(text);
--     DROP FUNCTION IF EXISTS public.is_household_member_fh(uuid);
--     DROP FUNCTION IF EXISTS public.current_household_id_fh();
--     DROP FUNCTION IF EXISTS public.set_updated_at_fh();
--     DROP TABLE IF EXISTS public.user_settings_fh;
--     DROP TABLE IF EXISTS public.profiles_fh;
--     DROP TABLE IF EXISTS public.household_members_fh;
--     DROP TABLE IF EXISTS public.households_fh;
--
-- Revisao 2026-10-14 (antes da primeira execucao bem-sucedida):
--   * Causa raiz do erro 42601 `syntax error at or near "public"`:
--     faltava a palavra-chave FUNCTION em todas as criacoes de funcao
--     (`create or replace public.x()` -> `create or replace function public.x()`).
--   * Comentarios normalizados para ASCII puro para eliminar qualquer
--     risco de codificacao ao colar no editor web (havia caracteres
--     corrompidos U+FFFD na primeira versao do bloco).
--   * O bloco nunca foi aplicado (a transacao abortou no erro de sintaxe
--     e nada recebeu COMMIT), por isso a correcao e feita no proprio
--     FH-SQL-001 em vez de um bloco de compensacao. A reexecucao integral
--     e idempotente (IF NOT EXISTS / OR REPLACE / DROP ... IF EXISTS).
--
-- Instrucao: executar o bloco inteiro uma unica vez no Supabase SQL Editor.
-- Estado: [executado-pelo-usuario em 2026-10-14] - validacao 3 confirmada (8 policies).
-- =====================================================================

-- INSTALACAO LIMPA (2026-10-24): o usuario apagara o esquema e executara
-- este arquivo completo. Os blocos seguintes sao o esquema integral atual;
-- nao e necessario criar/ativar usuarios no Supabase Auth nem rodar SQL
-- complementar. Os UUIDs de Jéssica e Rafael abaixo sao perfis do app.

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
  created_by  uuid not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.profiles_fh (
  id            uuid primary key,
  display_name  text not null check (char_length(btrim(display_name)) between 1 and 80),
  household_id  uuid references public.households_fh (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists profiles_fh_household_idx
  on public.profiles_fh (household_id);

-- Perfis locais fixos: podem ser adicionados/editados aqui sem Auth.
insert into public.profiles_fh (id, display_name) values
  ('00000000-0000-4000-8000-000000000001', 'Jéssica'),
  ('00000000-0000-4000-8000-000000000002', 'Rafael')
on conflict (id) do update set display_name = excluded.display_name;

-- O navegador envia x-profile-id. Isto e apenas identificacao visual:
-- qualquer pessoa pode alterar o header e assumir outro perfil.
create or replace function public.current_profile_id_fh()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_headers text;
  v_id uuid;
  v_exists boolean;
begin
  v_headers := current_setting('request.headers', true);
  if v_headers is null then return null; end if;
  begin
    v_id := (v_headers::jsonb ->> 'x-profile-id')::uuid;
  exception when others then
    return null;
  end;
  execute 'select exists (select 1 from public.profiles_fh where id = $1)'
    into v_exists using v_id;
  if v_exists then return v_id; end if;
  return null;
end;
$$;

create table if not exists public.user_settings_fh (
  user_id     uuid primary key references public.profiles_fh (id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create table if not exists public.household_members_fh (
  household_id uuid not null references public.households_fh (id) on delete cascade,
  user_id      uuid not null references public.profiles_fh (id) on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'member')),
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index if not exists household_members_fh_user_idx
  on public.household_members_fh (user_id);

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

-- Recupera a casa do perfil ativo enviado pelo navegador.
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
  where p.id = public.current_profile_id_fh()
  limit 1;
$$;

-- Verifica se o perfil selecionado pertence a casa informada.
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
      and m.user_id = public.current_profile_id_fh()
  );
$$;

-- ---------------------------------------------------------------------
-- 4. Funcoes de criacao e entrada de casa (SECURITY DEFINER)
-- ---------------------------------------------------------------------
create or replace function public.create_household_fh(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := public.current_profile_id_fh();
  v_household_id uuid;
begin
  if v_user is null then
    raise exception 'perfil_requerido';
  end if;
  if p_name is null or char_length(btrim(p_name)) = 0 then
    raise exception 'nome_invalido';
  end if;
  if exists (
    select 1 from public.household_members_fh where user_id = v_user
  ) then
    raise exception 'usuario_ja_pertence_a_uma_casa';
  end if;

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
  v_user uuid := public.current_profile_id_fh();
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_household_id uuid;
begin
  if v_user is null then
    raise exception 'perfil_requerido';
  end if;

  select id into v_household_id
  from public.households_fh
  where join_code = v_code;

  if v_household_id is null then
    raise exception 'codigo_invalido';
  end if;

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
  to anon, authenticated
  using (public.is_household_member_fh(id));

drop policy if exists households_fh_update on public.households_fh;
create policy households_fh_update on public.households_fh
  for update
  to anon, authenticated
  using (created_by = public.current_profile_id_fh() and public.is_household_member_fh(id))
  with check (created_by = public.current_profile_id_fh() and public.is_household_member_fh(id));

drop policy if exists households_fh_delete on public.households_fh;
create policy households_fh_delete on public.households_fh
  for delete
  to anon, authenticated
  using (created_by = public.current_profile_id_fh() and public.is_household_member_fh(id));
-- Sem policy de INSERT: so create_household_fh (SECURITY DEFINER) insere.

-- household_members_fh: leitura para membros da mesma casa; escrita apenas via funcao.
drop policy if exists household_members_fh_select on public.household_members_fh;
create policy household_members_fh_select on public.household_members_fh
  for select
  to anon, authenticated
  using (user_id = public.current_profile_id_fh() or public.is_household_member_fh(household_id));
-- Sem policies de INSERT/UPDATE/DELETE: escrita exclusiva das funcoes.

-- profiles_fh: o proprio usuario e os membros da mesma casa leem;
-- o proprio usuario edita somente o proprio perfil.
drop policy if exists profiles_fh_select on public.profiles_fh;
create policy profiles_fh_select on public.profiles_fh
  for select
  to anon, authenticated
  using (true);

drop policy if exists profiles_fh_update on public.profiles_fh;
create policy profiles_fh_update on public.profiles_fh
  for update
  to anon, authenticated
  using (id = public.current_profile_id_fh())
  with check (id = public.current_profile_id_fh());

-- user_settings_fh: estritamente pessoal.
drop policy if exists user_settings_fh_all on public.user_settings_fh;
create policy user_settings_fh_all on public.user_settings_fh
  for all
  to anon, authenticated
  using (user_id = public.current_profile_id_fh())
  with check (user_id = public.current_profile_id_fh());

-- ---------------------------------------------------------------------
-- 7. Permissoes de execucao das funcoes
-- ---------------------------------------------------------------------
grant execute on function public.current_profile_id_fh() to anon, authenticated;
grant execute on function public.create_household_fh(text) to anon, authenticated;
grant execute on function public.join_household_by_code_fh(text) to anon, authenticated;
grant execute on function public.current_household_id_fh() to anon, authenticated;
grant execute on function public.is_household_member_fh(uuid) to anon, authenticated;

commit;

-- ---------------------------------------------------------------------
-- Consultas de validacao (rodar apos a execucao do bloco acima)
-- ---------------------------------------------------------------------
-- 1) Objetos existem:
select table_name from information_schema.tables
 where table_schema = 'public' and table_name like '%_fh'
 order by table_name;
-- Esperado: household_members_fh, households_fh, profiles_fh, user_settings_fh

-- 2) RLS habilitado em todas:
select relname, relrowsecurity
  from pg_class
 where relnamespace = 'public'::regnamespace
   and relname like '%_fh' and relkind = 'r';
-- Esperado: relrowsecurity = true em todas

-- 3) Policies criadas:
select tablename, policyname from pg_policies
 where schemaname = 'public' order by tablename, policyname;
-- Esperado: 8 policies (3 households, 1 members, 3 profiles, 1 settings)

-- 4) Teste manual com dois usuarios (fase de validacao do usuario):
--    a) usuario A executa: select public.create_household_fh('Casa Teste');
--    b) copia o join_code: select join_code from public.households_fh;
--    c) usuario B executa: select public.join_household_by_code_fh('<codigo>');
--    d) B consulta: select * from public.households_fh;  -> deve ver 1 linha
--    e) usuario C (sem codigo) consulta o mesmo select -> deve ver 0 linhas

-- =====================================================================
-- FH-SQL-002 — Agenda, recorrência, categorias, notificações e layout
-- Tipo: migração nova
-- Data: 2026-10-14
-- Fase: 2 — Overview e agenda
-- Objetivo: criar eventos, tarefas e lembretes como entidades distintas,
--           com regras de recorrência genéricas, exceções por ocorrência,
--           categorias compartilhadas por domínio, centro de notificações
--           internas e layout de widgets por usuário.
-- Dependências: FH-SQL-001 aplicado (is_household_member_fh,
--               households_fh, set_updated_at_fh).
-- Pré-requisito: tabelas *_fh da Fase 1 existentes.
--
-- Objetos criados:
--   Tabelas: categories_fh, recurrence_rules_fh, recurrence_exceptions_fh,
--            events_fh, tasks_fh, reminders_fh, notifications_fh,
--            notification_preferences_fh, dashboard_layouts_fh
--   Função: is_household_owner_fh(uuid)
--   Policies RLS nas 9 tabelas + seeds de categorias globais da agenda
--
-- Decisões de modelagem (registradas também no diario.md, rodada 005):
--   * categories_fh compartilhada por domínio (coluna domain) em vez de
--     uma tabela por domínio: evita duplicação entre agenda/finanças/diário.
--   * recurrence_exceptions_fh genérica em vez de task_occurrences_fh:
--     pular/adiar ocorrências funciona igual para eventos, tarefas e
--     lembretes; recorrências financeiras continuam separadas na Fase 3
--     por exigirem estados financeiros e idempotência por período.
--   * notifications_fh com dedupe_key por usuário: o gerador pode rodar
--     várias vezes sem duplicar avisos (upsert por (user_id, dedupe_key)).
--
-- Efeito esperado:
--   * CRUD de eventos/tarefas/lembretes com visibilidade pessoal aplicada
--     no banco (pessoal = visível só a owner/criador).
--   * Recorrências expansíveis no frontend; exceções registradas por data.
--   * Categorias globais (casa, pessoal, finanças, compartilhado) visíveis
--     a todos; cada casa pode criar as suas.
--   * Notificações internas por usuário, sem duplicatas.
--   * Layout de widgets por usuário em dashboard_layouts_fh.
--
-- Riscos e rollback: baixo risco, banco sem dados reais ainda. Rollback =
--   DROP TABLE (cascade) na ordem inversa + DROP FUNCTION
--   public.is_household_owner_fh(uuid). Ver seção de rollback no fim.
--
-- Instrução: executar o bloco inteiro uma única vez no Supabase SQL Editor.
-- Estado: [preparado] — aguardando execução do usuário.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Função auxiliar: verifica se o usuário é o dono (criador) da casa
-- ---------------------------------------------------------------------
create or replace function public.is_household_owner_fh(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.households_fh h
    where h.id = p_household_id
      and h.created_by = public.current_profile_id_fh()
  );
$$;

-- ---------------------------------------------------------------------
-- 2. Categorias compartilhadas por domínio
--    household_id NULL = categoria global (criada por migração, imutável
--    via API: sem policy de escrita para linhas globais).
-- ---------------------------------------------------------------------
create table if not exists public.categories_fh (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid references public.households_fh (id) on delete cascade,
  domain        text not null check (domain in ('agenda', 'finance', 'diary', 'board')),
  name          text not null check (char_length(btrim(name)) between 1 and 40),
  kind          text,
  color         text,
  icon          text,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists categories_fh_household_uniq
  on public.categories_fh (household_id, domain, name)
  where household_id is not null;

create unique index if not exists categories_fh_global_uniq
  on public.categories_fh (domain, name)
  where household_id is null;

create index if not exists categories_fh_household_idx
  on public.categories_fh (household_id);

-- Seeds globais da agenda (idempotentes).
insert into public.categories_fh (household_id, domain, name, color, icon)
values
  (null, 'agenda', 'casa', '#1d4ed8', 'home'),
  (null, 'agenda', 'pessoal', '#7c3aed', 'user'),
  (null, 'agenda', 'finanças', '#047857', 'wallet'),
  (null, 'agenda', 'compartilhado', '#b45309', 'users')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 3. Regras de recorrência genéricas + exceções por ocorrência
-- ---------------------------------------------------------------------
create table if not exists public.recurrence_rules_fh (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references public.households_fh (id) on delete cascade,
  frequency         text not null check (frequency in ('daily', 'weekly', 'monthly', 'yearly')),
  interval_n        integer not null default 1 check (interval_n >= 1),
  days_of_week      integer[],
  month_day         integer check (month_day is null or (month_day between 1 and 31)),
  start_date        date not null,
  end_date          date,
  occurrence_count  integer check (occurrence_count is null or occurrence_count > 0),
  timezone          text not null default 'Europe/Dublin',
  created_by        uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create index if not exists recurrence_rules_fh_household_idx
  on public.recurrence_rules_fh (household_id);

create table if not exists public.recurrence_exceptions_fh (
  id             uuid primary key default gen_random_uuid(),
  rule_id        uuid not null references public.recurrence_rules_fh (id) on delete cascade,
  original_date  date not null,
  action         text not null check (action in ('skipped', 'postponed')),
  new_start_at   timestamptz,
  created_by     uuid,
  created_at     timestamptz not null default now(),
  unique (rule_id, original_date)
);

create index if not exists recurrence_exceptions_fh_rule_idx
  on public.recurrence_exceptions_fh (rule_id);

-- ---------------------------------------------------------------------
-- 4. Eventos, tarefas e lembretes
-- ---------------------------------------------------------------------
create table if not exists public.events_fh (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references public.households_fh (id) on delete cascade,
  title               text not null check (char_length(btrim(title)) between 1 and 120),
  description         text,
  location            text,
  start_at            timestamptz not null,
  end_at              timestamptz,
  all_day             boolean not null default false,
  category_id         uuid references public.categories_fh (id) on delete set null,
  visibility          text not null default 'shared' check (visibility in ('shared', 'personal')),
  owner_id            uuid references public.profiles_fh (id) on delete set null,
  created_by          uuid,
  recurrence_rule_id  uuid references public.recurrence_rules_fh (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (end_at is null or end_at >= start_at)
);

create index if not exists events_fh_household_idx on public.events_fh (household_id);
create index if not exists events_fh_start_idx on public.events_fh (start_at);

create table if not exists public.tasks_fh (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references public.households_fh (id) on delete cascade,
  title               text not null check (char_length(btrim(title)) between 1 and 120),
  notes               text,
  due_at              timestamptz,
  priority            text not null default 'medium'
                      check (priority in ('low', 'medium', 'high', 'urgent')),
  status              text not null default 'open'
                      check (status in ('open', 'done', 'cancelled')),
  completed_at        timestamptz,
  category_id         uuid references public.categories_fh (id) on delete set null,
  visibility          text not null default 'shared' check (visibility in ('shared', 'personal')),
  owner_id            uuid references public.profiles_fh (id) on delete set null,
  created_by          uuid,
  recurrence_rule_id  uuid references public.recurrence_rules_fh (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists tasks_fh_household_idx on public.tasks_fh (household_id);
create index if not exists tasks_fh_due_idx on public.tasks_fh (due_at);

create table if not exists public.reminders_fh (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references public.households_fh (id) on delete cascade,
  title               text not null check (char_length(btrim(title)) between 1 and 120),
  remind_at           timestamptz not null,
  notes               text,
  category_id         uuid references public.categories_fh (id) on delete set null,
  visibility          text not null default 'shared' check (visibility in ('shared', 'personal')),
  owner_id            uuid references public.profiles_fh (id) on delete set null,
  created_by          uuid,
  recurrence_rule_id  uuid references public.recurrence_rules_fh (id) on delete set null,
  dismissed_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists reminders_fh_household_idx on public.reminders_fh (household_id);
create index if not exists reminders_fh_remind_idx on public.reminders_fh (remind_at);

-- ---------------------------------------------------------------------
-- 5. Notificações internas + preferências
-- ---------------------------------------------------------------------
create table if not exists public.notifications_fh (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households_fh (id) on delete cascade,
  user_id      uuid not null references public.profiles_fh (id) on delete cascade,
  type         text not null,
  title        text not null check (char_length(btrim(title)) between 1 and 200),
  body         text,
  ref_type     text,
  ref_id       uuid,
  dedupe_key   text not null,
  read_at      timestamptz,
  created_at   timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create index if not exists notifications_fh_user_idx
  on public.notifications_fh (user_id, read_at);

create table if not exists public.notification_preferences_fh (
  user_id          uuid primary key references public.profiles_fh (id) on delete cascade,
  enabled          boolean not null default true,
  digest_enabled   boolean not null default false,
  lead_time_hours  integer not null default 24 check (lead_time_hours >= 0),
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6. Layout de widgets por usuário
-- ---------------------------------------------------------------------
create table if not exists public.dashboard_layouts_fh (
  user_id    uuid primary key references public.profiles_fh (id) on delete cascade,
  layout     jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7. Triggers de updated_at
-- ---------------------------------------------------------------------
drop trigger if exists t_categories_fh_updated on public.categories_fh;
create trigger t_categories_fh_updated
  before update on public.categories_fh
  for each row execute function public.set_updated_at_fh();

drop trigger if exists t_recurrence_rules_fh_updated on public.recurrence_rules_fh;
create trigger t_recurrence_rules_fh_updated
  before update on public.recurrence_rules_fh
  for each row execute function public.set_updated_at_fh();

drop trigger if exists t_events_fh_updated on public.events_fh;
create trigger t_events_fh_updated
  before update on public.events_fh
  for each row execute function public.set_updated_at_fh();

drop trigger if exists t_tasks_fh_updated on public.tasks_fh;
create trigger t_tasks_fh_updated
  before update on public.tasks_fh
  for each row execute function public.set_updated_at_fh();

drop trigger if exists t_reminders_fh_updated on public.reminders_fh;
create trigger t_reminders_fh_updated
  before update on public.reminders_fh
  for each row execute function public.set_updated_at_fh();

drop trigger if exists t_notification_preferences_fh_updated on public.notification_preferences_fh;
create trigger t_notification_preferences_fh_updated
  before update on public.notification_preferences_fh
  for each row execute function public.set_updated_at_fh();

drop trigger if exists t_dashboard_layouts_fh_updated on public.dashboard_layouts_fh;
create trigger t_dashboard_layouts_fh_updated
  before update on public.dashboard_layouts_fh
  for each row execute function public.set_updated_at_fh();

-- ---------------------------------------------------------------------
-- 8. Row Level Security
-- ---------------------------------------------------------------------
alter table public.categories_fh enable row level security;
alter table public.recurrence_rules_fh enable row level security;
alter table public.recurrence_exceptions_fh enable row level security;
alter table public.events_fh enable row level security;
alter table public.tasks_fh enable row level security;
alter table public.reminders_fh enable row level security;
alter table public.notifications_fh enable row level security;
alter table public.notification_preferences_fh enable row level security;
alter table public.dashboard_layouts_fh enable row level security;

-- Categorias: leitura global + da casa; escrita só de linhas da casa,
-- pelo criador ou pelo dono da casa. Linhas globais são imutáveis via API.
drop policy if exists categories_fh_select on public.categories_fh;
create policy categories_fh_select on public.categories_fh
  for select
  to anon, authenticated
  using (household_id is null or public.is_household_member_fh(household_id));

drop policy if exists categories_fh_insert on public.categories_fh;
create policy categories_fh_insert on public.categories_fh
  for insert
  to anon, authenticated
  with check (
    household_id is not null
    and public.is_household_member_fh(household_id)
  );

drop policy if exists categories_fh_update on public.categories_fh;
create policy categories_fh_update on public.categories_fh
  for update
  to anon, authenticated
  using (
    household_id is not null
    and (created_by = public.current_profile_id_fh() or public.is_household_owner_fh(household_id))
  )
  with check (
    household_id is not null
    and (created_by = public.current_profile_id_fh() or public.is_household_owner_fh(household_id))
  );

drop policy if exists categories_fh_delete on public.categories_fh;
create policy categories_fh_delete on public.categories_fh
  for delete
  to anon, authenticated
  using (
    household_id is not null
    and (created_by = public.current_profile_id_fh() or public.is_household_owner_fh(household_id))
  );

-- Regras de recorrência: escopo da casa; escrita pelo criador ou dono da casa.
drop policy if exists recurrence_rules_fh_select on public.recurrence_rules_fh;
create policy recurrence_rules_fh_select on public.recurrence_rules_fh
  for select
  to anon, authenticated
  using (public.is_household_member_fh(household_id));

drop policy if exists recurrence_rules_fh_insert on public.recurrence_rules_fh;
create policy recurrence_rules_fh_insert on public.recurrence_rules_fh
  for insert
  to anon, authenticated
  with check (public.is_household_member_fh(household_id));

drop policy if exists recurrence_rules_fh_update on public.recurrence_rules_fh;
create policy recurrence_rules_fh_update on public.recurrence_rules_fh
  for update
  to anon, authenticated
  using (created_by = public.current_profile_id_fh() or public.is_household_owner_fh(household_id))
  with check (created_by = public.current_profile_id_fh() or public.is_household_owner_fh(household_id));

drop policy if exists recurrence_rules_fh_delete on public.recurrence_rules_fh;
create policy recurrence_rules_fh_delete on public.recurrence_rules_fh
  for delete
  to anon, authenticated
  using (created_by = public.current_profile_id_fh() or public.is_household_owner_fh(household_id));

-- Exceções: seguem a casa da regra-pai.
drop policy if exists recurrence_exceptions_fh_select on public.recurrence_exceptions_fh;
create policy recurrence_exceptions_fh_select on public.recurrence_exceptions_fh
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.recurrence_rules_fh r
      where r.id = rule_id and public.is_household_member_fh(r.household_id)
    )
  );

drop policy if exists recurrence_exceptions_fh_insert on public.recurrence_exceptions_fh;
create policy recurrence_exceptions_fh_insert on public.recurrence_exceptions_fh
  for insert
  to anon, authenticated
  with check (
    exists (
      select 1 from public.recurrence_rules_fh r
      where r.id = rule_id and public.is_household_member_fh(r.household_id)
    )
  );

drop policy if exists recurrence_exceptions_fh_update on public.recurrence_exceptions_fh;
create policy recurrence_exceptions_fh_update on public.recurrence_exceptions_fh
  for update
  to anon, authenticated
  using (
    created_by = public.current_profile_id_fh()
    or exists (
      select 1 from public.recurrence_rules_fh r
      where r.id = recurrence_exceptions_fh.rule_id
        and public.is_household_owner_fh(r.household_id)
    )
  )
  with check (
    created_by = public.current_profile_id_fh()
    or exists (
      select 1 from public.recurrence_rules_fh r
      where r.id = recurrence_exceptions_fh.rule_id
        and public.is_household_owner_fh(r.household_id)
    )
  );

drop policy if exists recurrence_exceptions_fh_delete on public.recurrence_exceptions_fh;
create policy recurrence_exceptions_fh_delete on public.recurrence_exceptions_fh
  for delete
  to anon, authenticated
  using (
    created_by = public.current_profile_id_fh()
    or exists (
      select 1 from public.recurrence_rules_fh r
      where r.id = recurrence_exceptions_fh.rule_id
        and public.is_household_owner_fh(r.household_id)
    )
  );

-- Eventos/tarefas/lembretes: leitura respeita visibilidade pessoal;
-- escrita pelo criador, responsável ou dono da casa.
drop policy if exists events_fh_select on public.events_fh;
create policy events_fh_select on public.events_fh
  for select
  to anon, authenticated
  using (
    public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = public.current_profile_id_fh() or created_by = public.current_profile_id_fh())
  );

drop policy if exists events_fh_insert on public.events_fh;
create policy events_fh_insert on public.events_fh
  for insert
  to anon, authenticated
  with check (
    public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = public.current_profile_id_fh())
  );

drop policy if exists events_fh_update on public.events_fh;
create policy events_fh_update on public.events_fh
  for update
  to anon, authenticated
  using (
    created_by = public.current_profile_id_fh()
    or owner_id = public.current_profile_id_fh()
    or public.is_household_owner_fh(household_id)
  )
  with check (
    public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = public.current_profile_id_fh())
  );

drop policy if exists events_fh_delete on public.events_fh;
create policy events_fh_delete on public.events_fh
  for delete
  to anon, authenticated
  using (
    created_by = public.current_profile_id_fh()
    or owner_id = public.current_profile_id_fh()
    or public.is_household_owner_fh(household_id)
  );

drop policy if exists tasks_fh_select on public.tasks_fh;
create policy tasks_fh_select on public.tasks_fh
  for select
  to anon, authenticated
  using (
    public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = public.current_profile_id_fh() or created_by = public.current_profile_id_fh())
  );

drop policy if exists tasks_fh_insert on public.tasks_fh;
create policy tasks_fh_insert on public.tasks_fh
  for insert
  to anon, authenticated
  with check (
    public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = public.current_profile_id_fh())
  );

drop policy if exists tasks_fh_update on public.tasks_fh;
create policy tasks_fh_update on public.tasks_fh
  for update
  to anon, authenticated
  using (
    created_by = public.current_profile_id_fh()
    or owner_id = public.current_profile_id_fh()
    or public.is_household_owner_fh(household_id)
  )
  with check (
    public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = public.current_profile_id_fh())
  );

drop policy if exists tasks_fh_delete on public.tasks_fh;
create policy tasks_fh_delete on public.tasks_fh
  for delete
  to anon, authenticated
  using (
    created_by = public.current_profile_id_fh()
    or owner_id = public.current_profile_id_fh()
    or public.is_household_owner_fh(household_id)
  );

drop policy if exists reminders_fh_select on public.reminders_fh;
create policy reminders_fh_select on public.reminders_fh
  for select
  to anon, authenticated
  using (
    public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = public.current_profile_id_fh() or created_by = public.current_profile_id_fh())
  );

drop policy if exists reminders_fh_insert on public.reminders_fh;
create policy reminders_fh_insert on public.reminders_fh
  for insert
  to anon, authenticated
  with check (
    public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = public.current_profile_id_fh())
  );

drop policy if exists reminders_fh_update on public.reminders_fh;
create policy reminders_fh_update on public.reminders_fh
  for update
  to anon, authenticated
  using (
    created_by = public.current_profile_id_fh()
    or owner_id = public.current_profile_id_fh()
    or public.is_household_owner_fh(household_id)
  )
  with check (
    public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = public.current_profile_id_fh())
  );

drop policy if exists reminders_fh_delete on public.reminders_fh;
create policy reminders_fh_delete on public.reminders_fh
  for delete
  to anon, authenticated
  using (
    created_by = public.current_profile_id_fh()
    or owner_id = public.current_profile_id_fh()
    or public.is_household_owner_fh(household_id)
  );

-- Notificações: estritamente pessoais (destinatário).
drop policy if exists notifications_fh_select on public.notifications_fh;
create policy notifications_fh_select on public.notifications_fh
  for select
  to anon, authenticated
  using (user_id = public.current_profile_id_fh());

drop policy if exists notifications_fh_insert on public.notifications_fh;
create policy notifications_fh_insert on public.notifications_fh
  for insert
  to anon, authenticated
  with check (user_id = public.current_profile_id_fh());

drop policy if exists notifications_fh_update on public.notifications_fh;
create policy notifications_fh_update on public.notifications_fh
  for update
  to anon, authenticated
  using (user_id = public.current_profile_id_fh())
  with check (user_id = public.current_profile_id_fh());

drop policy if exists notifications_fh_delete on public.notifications_fh;
create policy notifications_fh_delete on public.notifications_fh
  for delete
  to anon, authenticated
  using (user_id = public.current_profile_id_fh());

-- Preferências de notificação e layout: estritamente pessoais.
drop policy if exists notification_preferences_fh_all on public.notification_preferences_fh;
create policy notification_preferences_fh_all on public.notification_preferences_fh
  for all
  to anon, authenticated
  using (user_id = public.current_profile_id_fh())
  with check (user_id = public.current_profile_id_fh());

drop policy if exists dashboard_layouts_fh_all on public.dashboard_layouts_fh;
create policy dashboard_layouts_fh_all on public.dashboard_layouts_fh
  for all
  to anon, authenticated
  using (user_id = public.current_profile_id_fh())
  with check (user_id = public.current_profile_id_fh());

-- ---------------------------------------------------------------------
-- 9. Permissões de execução da função auxiliar
-- ---------------------------------------------------------------------
revoke all on function public.is_household_owner_fh(uuid) from public, anon;
grant execute on function public.is_household_owner_fh(uuid) to anon, authenticated;

commit;

-- ---------------------------------------------------------------------
-- Consultas de validação (rodar após a execução do bloco acima)
-- ---------------------------------------------------------------------
-- 1) Tabelas *_fh (esperado: 13 — 4 da Fase 1 + 9 da Fase 2):
select table_name from information_schema.tables
 where table_schema = 'public' and table_name like '%_fh'
 order by table_name;

-- 2) RLS habilitado em todas as tabelas *_fh (esperado: true em todas):
select relname, relrowsecurity
  from pg_class
 where relnamespace = 'public'::regnamespace
   and relname like '%_fh' and relkind = 'r'
 order by relname;

-- 3) Total de policies (esperado: 38 — 8 da Fase 1 + 30 da Fase 2):
select count(*) as total_policies from pg_policies
 where schemaname = 'public';

-- Permissoes de API para app sem Supabase Auth. RLS continua ativa nas 40
-- tabelas *_fh e as policies validam x-profile-id; o header e spoofavel.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated;

-- FH-SQL-007 — Diagnostico somente leitura: casa, dono e membros
-- Data: 2026-10-24
-- Objetivo: confirmar no SQL Editor se a casa criada pela aplicacao foi
--           persistida e quais perfis estao associados.
-- Dependencias: FH-SQL-001 aplicado.
-- Efeito: somente leitura; nao altera dados.
-- Estado: [preparado].
--
-- Interpretacao: uma linha por membro. Se a consulta retornar zero linhas,
-- confirme que o SQL Editor esta no projeto Supabase usado pelo .env.
-- `join_code` e dado de convite: compartilhe apenas com a pessoa que entrara.
-- =====================================================================
select
  h.name as casa,
  h.created_at as criada_em,
  h.created_by as usuario_dono_id,
  owner_profile.display_name as nome_dono,
  h.join_code as codigo_convite,
  m.user_id as membro_id,
  member_profile.display_name as nome_membro,
  m.role as papel,
  m.joined_at as entrou_em
from public.households_fh h
left join public.household_members_fh m on m.household_id = h.id
left join public.profiles_fh owner_profile on owner_profile.id = h.created_by
left join public.profiles_fh member_profile on member_profile.id = m.user_id
order by h.created_at desc, m.joined_at;

-- 4) Categorias globais da agenda (esperado: 4 linhas):
select domain, name from public.categories_fh
 where household_id is null order by name;

-- 5) Rollback (somente se nada posterior tiver sido criado):
--    DROP TABLE IF EXISTS public.dashboard_layouts_fh;
--    DROP TABLE IF EXISTS public.notification_preferences_fh;
--    DROP TABLE IF EXISTS public.notifications_fh;
--    DROP TABLE IF EXISTS public.reminders_fh;
--    DROP TABLE IF EXISTS public.tasks_fh;
--    DROP TABLE IF EXISTS public.events_fh;
--    DROP TABLE IF EXISTS public.recurrence_exceptions_fh;
--    DROP TABLE IF EXISTS public.recurrence_rules_fh;
--    DROP TABLE IF EXISTS public.categories_fh;
--    DROP FUNCTION IF EXISTS public.is_household_owner_fh(uuid);

-- =====================================================================
-- FH-SQL-003 — Financas domesticas, cambio, importacao e auditoria
-- Tipo: migracao nova
-- Data: 2026-10-14
-- Fase: 3 — Financas
-- Objetivo: contas, lancamentos com estados, recorrencias financeiras,
--           transferencias entre contas proprias, metas virtuais, cambio
--           (taxa efetiva x cotacao de referencia), importacao revisavel
--           de CSV/PDF e trilha de auditoria.
-- Dependencias: FH-SQL-001 e FH-SQL-002 aplicados (helpers de casa,
--               categories_fh, set_updated_at_fh).
--
-- Objetos criados (11 tabelas, sem funcoes novas):
--   financial_accounts_fh, financial_transactions_fh,
--   financial_recurrences_fh, financial_transfers_fh,
--   exchange_rates_fh, exchange_operations_fh,
--   financial_goals_fh, goal_contributions_fh,
--   financial_imports_fh, financial_import_rows_fh, audit_logs_fh
--
-- Regras de negocio garantidas no esquema:
--   * Valores monetarios em numeric(18,2); taxas em numeric(18,6).
--   * Valor e moeda originais preservados em cada lancamento.
--   * Recorrencias geram lancamentos pendentes com (recurrence_id,
--     period_key) unico: retry nao duplica o periodo (idempotencia).
--   * Transferencias vivem em tabela propria: nunca entram no consolidado
--     de receitas/despesas (que le somente financial_transactions_fh).
--   * Contribuicoes de meta nao tocam em contas (sem transaction gerada).
--   * Linhas importadas viram lancamento somente via confirmacao, ligada
--     por import_row_id unico: a mesma linha nunca gera dois lancamentos.
--   * Cotacoes de referencia sao historico imutavel (insert-only via API:
--     sem policy de update/delete); taxas efetivas guardam os valores reais.
--   * "Vencido" e derivado na aplicacao (previsto/pendente com data passada);
--     nao e estado gravado, para nao exigir job de varredura.
--
-- Efeito esperado: CRUD financeiro com RLS e visibilidade pessoal; saldos
--   calculados na aplicacao a partir de opening_balance + movimentacoes.
-- Riscos e rollback: baixo risco, sem dados reais. Rollback = DROP TABLE
--   na ordem inversa (ver fim do bloco).
--
-- Instrucao: executar o bloco inteiro uma unica vez no Supabase SQL Editor.
-- Estado: [preparado] — aguardando execucao do usuario.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Contas (individuais ou compartilhadas via visibility/owner)
-- ---------------------------------------------------------------------
create table if not exists public.financial_accounts_fh (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references public.households_fh (id) on delete cascade,
  name             text not null check (char_length(btrim(name)) between 1 and 60),
  type             text not null default 'checking'
                   check (type in ('checking', 'savings', 'cash', 'other')),
  currency         char(3) not null default 'EUR',
  opening_balance  numeric(18,2) not null default 0,
  visibility       text not null default 'shared' check (visibility in ('shared', 'personal')),
  owner_id         uuid references public.profiles_fh (id) on delete set null,
  created_by       uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists financial_accounts_fh_household_idx
  on public.financial_accounts_fh (household_id);

-- ---------------------------------------------------------------------
-- 2. Lancamentos (receitas e despesas)
-- ---------------------------------------------------------------------
create table if not exists public.financial_transactions_fh (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references public.households_fh (id) on delete cascade,
  account_id          uuid not null references public.financial_accounts_fh (id) on delete restrict,
  kind                text not null check (kind in ('income', 'expense')),
  amount              numeric(18,2) not null check (amount > 0),
  currency            char(3) not null default 'EUR',
  status              text not null default 'pendente'
                      check (status in ('previsto', 'pendente', 'pago', 'recebido', 'cancelado')),
  description         text not null check (char_length(btrim(description)) between 1 and 200),
  category_id         uuid references public.categories_fh (id) on delete set null,
  date                date not null,
  paid_at             timestamptz,
  owner_id            uuid references public.profiles_fh (id) on delete set null,
  created_by          uuid,
  recurrence_id       uuid,
  period_key          text,
  installment_group   uuid,
  installment_number  integer check (installment_number is null or installment_number > 0),
  installment_total   integer check (installment_total is null or installment_total > 0),
  import_row_id       uuid unique,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index if not exists financial_transactions_fh_period_uniq
  on public.financial_transactions_fh (recurrence_id, period_key)
  where recurrence_id is not null;

create index if not exists financial_transactions_fh_household_idx
  on public.financial_transactions_fh (household_id);
create index if not exists financial_transactions_fh_account_idx
  on public.financial_transactions_fh (account_id);
create index if not exists financial_transactions_fh_date_idx
  on public.financial_transactions_fh (date);

-- ---------------------------------------------------------------------
-- 3. Recorrencias financeiras (geram lancamentos pendentes)
-- ---------------------------------------------------------------------
create table if not exists public.financial_recurrences_fh (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references public.households_fh (id) on delete cascade,
  account_id       uuid not null references public.financial_accounts_fh (id) on delete restrict,
  kind             text not null check (kind in ('income', 'expense')),
  amount           numeric(18,2) not null check (amount > 0),
  currency         char(3) not null default 'EUR',
  description      text not null check (char_length(btrim(description)) between 1 and 200),
  category_id      uuid references public.categories_fh (id) on delete set null,
  frequency        text not null check (frequency in ('daily', 'weekly', 'monthly', 'yearly')),
  interval_n       integer not null default 1 check (interval_n >= 1),
  start_date       date not null,
  end_date         date,
  occurrence_count integer check (occurrence_count is null or occurrence_count > 0),
  active           boolean not null default true,
  owner_id         uuid references public.profiles_fh (id) on delete set null,
  created_by       uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create index if not exists financial_recurrences_fh_household_idx
  on public.financial_recurrences_fh (household_id);

-- ---------------------------------------------------------------------
-- 4. Transferencias entre contas proprias (fora do consolidado)
-- ---------------------------------------------------------------------
create table if not exists public.financial_transfers_fh (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households_fh (id) on delete cascade,
  from_account  uuid not null references public.financial_accounts_fh (id) on delete restrict,
  to_account    uuid not null references public.financial_accounts_fh (id) on delete restrict,
  amount        numeric(18,2) not null check (amount > 0),
  currency      char(3) not null default 'EUR',
  to_amount     numeric(18,2),
  to_currency   char(3),
  fee           numeric(18,2) not null default 0 check (fee >= 0),
  date          date not null,
  description   text,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (from_account <> to_account)
);

create index if not exists financial_transfers_fh_household_idx
  on public.financial_transfers_fh (household_id);

-- ---------------------------------------------------------------------
-- 5. Cambio: cotacao de referencia (historico) x operacao efetiva
-- ---------------------------------------------------------------------
create table if not exists public.exchange_rates_fh (
  id          uuid primary key default gen_random_uuid(),
  household_id uuid references public.households_fh (id) on delete cascade,
  base        char(3) not null,
  target      char(3) not null,
  rate        numeric(18,6) not null check (rate > 0),
  source      text not null,
  manual      boolean not null default false,
  fetched_at  timestamptz not null default now(),
  created_by  uuid,
  created_at  timestamptz not null default now(),
  check (base <> target)
);

create unique index if not exists exchange_rates_fh_household_uniq
  on public.exchange_rates_fh (household_id, base, target, fetched_at)
  where household_id is not null;

create table if not exists public.exchange_operations_fh (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references public.households_fh (id) on delete cascade,
  from_amount     numeric(18,2) not null check (from_amount > 0),
  from_currency   char(3) not null,
  to_amount       numeric(18,2) not null check (to_amount > 0),
  to_currency     char(3) not null,
  fee             numeric(18,2) not null default 0 check (fee >= 0),
  effective_rate  numeric(18,6) not null check (effective_rate > 0),
  date            date not null,
  source          text,
  notes           text,
  created_by      uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (from_currency <> to_currency)
);

create index if not exists exchange_operations_fh_household_idx
  on public.exchange_operations_fh (household_id);

-- ---------------------------------------------------------------------
-- 6. Metas virtuais (nao alteram saldo real)
-- ---------------------------------------------------------------------
create table if not exists public.financial_goals_fh (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households_fh (id) on delete cascade,
  name           text not null check (char_length(btrim(name)) between 1 and 80),
  target_amount  numeric(18,2) not null check (target_amount > 0),
  currency       char(3) not null default 'EUR',
  deadline       date,
  visibility     text not null default 'shared' check (visibility in ('shared', 'personal')),
  owner_id       uuid references public.profiles_fh (id) on delete set null,
  created_by     uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists financial_goals_fh_household_idx
  on public.financial_goals_fh (household_id);

create table if not exists public.goal_contributions_fh (
  id         uuid primary key default gen_random_uuid(),
  goal_id    uuid not null references public.financial_goals_fh (id) on delete cascade,
  amount     numeric(18,2) not null check (amount > 0),
  date       date not null default CURRENT_DATE,
  note       text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists goal_contributions_fh_goal_idx
  on public.goal_contributions_fh (goal_id);

-- ---------------------------------------------------------------------
-- 7. Importacao revisavel (linhas so viram lancamento com confirmacao)
-- ---------------------------------------------------------------------
create table if not exists public.financial_imports_fh (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references public.households_fh (id) on delete cascade,
  filename        text not null,
  source          text not null check (source in ('csv', 'pdf')),
  status          text not null default 'pending'
                  check (status in ('pending', 'reviewing', 'imported', 'partially', 'discarded')),
  row_count       integer not null default 0,
  accepted_count  integer not null default 0,
  rejected_count  integer not null default 0,
  created_by      uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists financial_imports_fh_household_idx
  on public.financial_imports_fh (household_id);

create table if not exists public.financial_import_rows_fh (
  id            uuid primary key default gen_random_uuid(),
  import_id     uuid not null references public.financial_imports_fh (id) on delete cascade,
  line_no       integer not null,
  date          date,
  description   text,
  amount        numeric(18,2),
  currency      char(3) not null default 'EUR',
  category_id   uuid references public.categories_fh (id) on delete set null,
  status        text not null default 'pending'
                check (status in ('pending', 'accepted', 'rejected', 'duplicate')),
  duplicate_of  uuid references public.financial_transactions_fh (id) on delete set null,
  note          text,
  created_at    timestamptz not null default now(),
  unique (import_id, line_no)
);

create index if not exists financial_import_rows_fh_import_idx
  on public.financial_import_rows_fh (import_id);

-- ---------------------------------------------------------------------
-- 8. Auditoria de alteracoes relevantes
-- ---------------------------------------------------------------------
create table if not exists public.audit_logs_fh (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households_fh (id) on delete cascade,
  user_id      uuid not null references public.profiles_fh (id) on delete cascade,
  entity       text not null,
  entity_id    uuid,
  action       text not null,
  before       jsonb,
  after        jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists audit_logs_fh_household_idx
  on public.audit_logs_fh (household_id, created_at desc);

-- ---------------------------------------------------------------------
-- 8b. Chaves estrangeiras diferidas (tabelas referenciadas adiante)
--     Correcao de auditoria 2026-10-14: FK inline falharia com
--     `relation does not exist`, pois financial_recurrences_fh e
--     financial_import_rows_fh sao criadas DEPOIS de financial_transactions_fh.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'financial_transactions_fh_recurrence_id_fkey'
  ) then
    alter table public.financial_transactions_fh
      add constraint financial_transactions_fh_recurrence_id_fkey
      foreign key (recurrence_id)
      references public.financial_recurrences_fh (id)
      on delete set null;
  end if;

  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'financial_transactions_fh_import_row_id_fkey'
  ) then
    alter table public.financial_transactions_fh
      add constraint financial_transactions_fh_import_row_id_fkey
      foreign key (import_row_id)
      references public.financial_import_rows_fh (id)
      on delete set null;
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 9. Triggers de updated_at
-- ---------------------------------------------------------------------
drop trigger if exists t_financial_accounts_fh_updated on public.financial_accounts_fh;
create trigger t_financial_accounts_fh_updated
  before update on public.financial_accounts_fh
  for each row execute function public.set_updated_at_fh();

drop trigger if exists t_financial_transactions_fh_updated on public.financial_transactions_fh;
create trigger t_financial_transactions_fh_updated
  before update on public.financial_transactions_fh
  for each row execute function public.set_updated_at_fh();

drop trigger if exists t_financial_recurrences_fh_updated on public.financial_recurrences_fh;
create trigger t_financial_recurrences_fh_updated
  before update on public.financial_recurrences_fh
  for each row execute function public.set_updated_at_fh();

drop trigger if exists t_financial_transfers_fh_updated on public.financial_transfers_fh;
create trigger t_financial_transfers_fh_updated
  before update on public.financial_transfers_fh
  for each row execute function public.set_updated_at_fh();

drop trigger if exists t_exchange_operations_fh_updated on public.exchange_operations_fh;
create trigger t_exchange_operations_fh_updated
  before update on public.exchange_operations_fh
  for each row execute function public.set_updated_at_fh();

drop trigger if exists t_financial_goals_fh_updated on public.financial_goals_fh;
create trigger t_financial_goals_fh_updated
  before update on public.financial_goals_fh
  for each row execute function public.set_updated_at_fh();

drop trigger if exists t_financial_imports_fh_updated on public.financial_imports_fh;
create trigger t_financial_imports_fh_updated
  before update on public.financial_imports_fh
  for each row execute function public.set_updated_at_fh();

-- ---------------------------------------------------------------------
-- 10. Row Level Security
-- ---------------------------------------------------------------------
alter table public.financial_accounts_fh enable row level security;
alter table public.financial_transactions_fh enable row level security;
alter table public.financial_recurrences_fh enable row level security;
alter table public.financial_transfers_fh enable row level security;
alter table public.exchange_rates_fh enable row level security;
alter table public.exchange_operations_fh enable row level security;
alter table public.financial_goals_fh enable row level security;
alter table public.goal_contributions_fh enable row level security;
alter table public.financial_imports_fh enable row level security;
alter table public.financial_import_rows_fh enable row level security;
alter table public.audit_logs_fh enable row level security;

-- Contas, lancamentos, recorrencias, transferencias, operacoes e metas:
-- leitura respeita visibilidade pessoal; escrita pelo criador, responsavel
-- ou dono da casa. (Transferencias e operacoes nao tem visibilidade: sao da casa.)
drop policy if exists financial_accounts_fh_select on public.financial_accounts_fh;
create policy financial_accounts_fh_select on public.financial_accounts_fh
  for select to anon, authenticated
  using (public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = public.current_profile_id_fh() or created_by = public.current_profile_id_fh()));
drop policy if exists financial_accounts_fh_insert on public.financial_accounts_fh;
create policy financial_accounts_fh_insert on public.financial_accounts_fh
  for insert to anon, authenticated
  with check (public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = public.current_profile_id_fh()));
drop policy if exists financial_accounts_fh_update on public.financial_accounts_fh;
create policy financial_accounts_fh_update on public.financial_accounts_fh
  for update to anon, authenticated
  using (created_by = public.current_profile_id_fh() or owner_id = public.current_profile_id_fh()
    or public.is_household_owner_fh(household_id))
  with check (public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = public.current_profile_id_fh()));
drop policy if exists financial_accounts_fh_delete on public.financial_accounts_fh;
create policy financial_accounts_fh_delete on public.financial_accounts_fh
  for delete to anon, authenticated
  using (created_by = public.current_profile_id_fh() or owner_id = public.current_profile_id_fh()
    or public.is_household_owner_fh(household_id));

drop policy if exists financial_transactions_fh_select on public.financial_transactions_fh;
create policy financial_transactions_fh_select on public.financial_transactions_fh
  for select to anon, authenticated
  using (public.is_household_member_fh(household_id)
    and (owner_id = public.current_profile_id_fh() or created_by = public.current_profile_id_fh()
      or exists (select 1 from public.financial_accounts_fh a
        where a.id = account_id and a.visibility = 'shared')));
drop policy if exists financial_transactions_fh_insert on public.financial_transactions_fh;
create policy financial_transactions_fh_insert on public.financial_transactions_fh
  for insert to anon, authenticated
  with check (public.is_household_member_fh(household_id));
drop policy if exists financial_transactions_fh_update on public.financial_transactions_fh;
create policy financial_transactions_fh_update on public.financial_transactions_fh
  for update to anon, authenticated
  using (created_by = public.current_profile_id_fh() or owner_id = public.current_profile_id_fh()
    or public.is_household_owner_fh(household_id))
  with check (public.is_household_member_fh(household_id));
drop policy if exists financial_transactions_fh_delete on public.financial_transactions_fh;
create policy financial_transactions_fh_delete on public.financial_transactions_fh
  for delete to anon, authenticated
  using (created_by = public.current_profile_id_fh() or owner_id = public.current_profile_id_fh()
    or public.is_household_owner_fh(household_id));

drop policy if exists financial_recurrences_fh_select on public.financial_recurrences_fh;
create policy financial_recurrences_fh_select on public.financial_recurrences_fh
  for select to anon, authenticated
  using (public.is_household_member_fh(household_id));
drop policy if exists financial_recurrences_fh_insert on public.financial_recurrences_fh;
create policy financial_recurrences_fh_insert on public.financial_recurrences_fh
  for insert to anon, authenticated
  with check (public.is_household_member_fh(household_id));
drop policy if exists financial_recurrences_fh_update on public.financial_recurrences_fh;
create policy financial_recurrences_fh_update on public.financial_recurrences_fh
  for update to anon, authenticated
  using (created_by = public.current_profile_id_fh() or owner_id = public.current_profile_id_fh()
    or public.is_household_owner_fh(household_id))
  with check (public.is_household_member_fh(household_id));
drop policy if exists financial_recurrences_fh_delete on public.financial_recurrences_fh;
create policy financial_recurrences_fh_delete on public.financial_recurrences_fh
  for delete to anon, authenticated
  using (created_by = public.current_profile_id_fh() or owner_id = public.current_profile_id_fh()
    or public.is_household_owner_fh(household_id));

drop policy if exists financial_transfers_fh_select on public.financial_transfers_fh;
create policy financial_transfers_fh_select on public.financial_transfers_fh
  for select to anon, authenticated
  using (public.is_household_member_fh(household_id));
drop policy if exists financial_transfers_fh_insert on public.financial_transfers_fh;
create policy financial_transfers_fh_insert on public.financial_transfers_fh
  for insert to anon, authenticated
  with check (public.is_household_member_fh(household_id));
drop policy if exists financial_transfers_fh_update on public.financial_transfers_fh;
create policy financial_transfers_fh_update on public.financial_transfers_fh
  for update to anon, authenticated
  using (created_by = public.current_profile_id_fh() or public.is_household_owner_fh(household_id))
  with check (public.is_household_member_fh(household_id));
drop policy if exists financial_transfers_fh_delete on public.financial_transfers_fh;
create policy financial_transfers_fh_delete on public.financial_transfers_fh
  for delete to anon, authenticated
  using (created_by = public.current_profile_id_fh() or public.is_household_owner_fh(household_id));

drop policy if exists exchange_operations_fh_select on public.exchange_operations_fh;
create policy exchange_operations_fh_select on public.exchange_operations_fh
  for select to anon, authenticated
  using (public.is_household_member_fh(household_id));
drop policy if exists exchange_operations_fh_insert on public.exchange_operations_fh;
create policy exchange_operations_fh_insert on public.exchange_operations_fh
  for insert to anon, authenticated
  with check (public.is_household_member_fh(household_id));
drop policy if exists exchange_operations_fh_update on public.exchange_operations_fh;
create policy exchange_operations_fh_update on public.exchange_operations_fh
  for update to anon, authenticated
  using (created_by = public.current_profile_id_fh() or public.is_household_owner_fh(household_id))
  with check (public.is_household_member_fh(household_id));
drop policy if exists exchange_operations_fh_delete on public.exchange_operations_fh;
create policy exchange_operations_fh_delete on public.exchange_operations_fh
  for delete to anon, authenticated
  using (created_by = public.current_profile_id_fh() or public.is_household_owner_fh(household_id));

drop policy if exists financial_goals_fh_select on public.financial_goals_fh;
create policy financial_goals_fh_select on public.financial_goals_fh
  for select to anon, authenticated
  using (public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = public.current_profile_id_fh() or created_by = public.current_profile_id_fh()));
drop policy if exists financial_goals_fh_insert on public.financial_goals_fh;
create policy financial_goals_fh_insert on public.financial_goals_fh
  for insert to anon, authenticated
  with check (public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = public.current_profile_id_fh()));
drop policy if exists financial_goals_fh_update on public.financial_goals_fh;
create policy financial_goals_fh_update on public.financial_goals_fh
  for update to anon, authenticated
  using (created_by = public.current_profile_id_fh() or owner_id = public.current_profile_id_fh()
    or public.is_household_owner_fh(household_id))
  with check (public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = public.current_profile_id_fh()));
drop policy if exists financial_goals_fh_delete on public.financial_goals_fh;
create policy financial_goals_fh_delete on public.financial_goals_fh
  for delete to anon, authenticated
  using (created_by = public.current_profile_id_fh() or owner_id = public.current_profile_id_fh()
    or public.is_household_owner_fh(household_id));

-- Contribuicoes e linhas de importacao seguem a casa do registro-pai.
drop policy if exists goal_contributions_fh_select on public.goal_contributions_fh;
create policy goal_contributions_fh_select on public.goal_contributions_fh
  for select to anon, authenticated
  using (exists (select 1 from public.financial_goals_fh g
    where g.id = goal_id and public.is_household_member_fh(g.household_id)));
drop policy if exists goal_contributions_fh_insert on public.goal_contributions_fh;
create policy goal_contributions_fh_insert on public.goal_contributions_fh
  for insert to anon, authenticated
  with check (exists (select 1 from public.financial_goals_fh g
    where g.id = goal_id and public.is_household_member_fh(g.household_id)));
drop policy if exists goal_contributions_fh_update on public.goal_contributions_fh;
create policy goal_contributions_fh_update on public.goal_contributions_fh
  for update to anon, authenticated
  using (created_by = public.current_profile_id_fh()
    or exists (select 1 from public.financial_goals_fh g
      where g.id = goal_contributions_fh.goal_id
        and public.is_household_owner_fh(g.household_id)))
  with check (exists (select 1 from public.financial_goals_fh g
    where g.id = goal_contributions_fh.goal_id
      and public.is_household_member_fh(g.household_id)));
drop policy if exists goal_contributions_fh_delete on public.goal_contributions_fh;
create policy goal_contributions_fh_delete on public.goal_contributions_fh
  for delete to anon, authenticated
  using (created_by = public.current_profile_id_fh()
    or exists (select 1 from public.financial_goals_fh g
      where g.id = goal_contributions_fh.goal_id
        and public.is_household_owner_fh(g.household_id)));

drop policy if exists financial_imports_fh_select on public.financial_imports_fh;
create policy financial_imports_fh_select on public.financial_imports_fh
  for select to anon, authenticated
  using (public.is_household_member_fh(household_id));
drop policy if exists financial_imports_fh_insert on public.financial_imports_fh;
create policy financial_imports_fh_insert on public.financial_imports_fh
  for insert to anon, authenticated
  with check (public.is_household_member_fh(household_id));
drop policy if exists financial_imports_fh_update on public.financial_imports_fh;
create policy financial_imports_fh_update on public.financial_imports_fh
  for update to anon, authenticated
  using (created_by = public.current_profile_id_fh() or public.is_household_owner_fh(household_id))
  with check (public.is_household_member_fh(household_id));
drop policy if exists financial_imports_fh_delete on public.financial_imports_fh;
create policy financial_imports_fh_delete on public.financial_imports_fh
  for delete to anon, authenticated
  using (created_by = public.current_profile_id_fh() or public.is_household_owner_fh(household_id));

drop policy if exists financial_import_rows_fh_select on public.financial_import_rows_fh;
create policy financial_import_rows_fh_select on public.financial_import_rows_fh
  for select to anon, authenticated
  using (exists (select 1 from public.financial_imports_fh i
    where i.id = import_id and public.is_household_member_fh(i.household_id)));
drop policy if exists financial_import_rows_fh_insert on public.financial_import_rows_fh;
create policy financial_import_rows_fh_insert on public.financial_import_rows_fh
  for insert to anon, authenticated
  with check (exists (select 1 from public.financial_imports_fh i
    where i.id = import_id and public.is_household_member_fh(i.household_id)));
drop policy if exists financial_import_rows_fh_update on public.financial_import_rows_fh;
create policy financial_import_rows_fh_update on public.financial_import_rows_fh
  for update to anon, authenticated
  using (exists (select 1 from public.financial_imports_fh i
    where i.id = financial_import_rows_fh.import_id
      and (i.created_by = public.current_profile_id_fh() or public.is_household_owner_fh(i.household_id))))
  with check (exists (select 1 from public.financial_imports_fh i
    where i.id = financial_import_rows_fh.import_id
      and public.is_household_member_fh(i.household_id)));
drop policy if exists financial_import_rows_fh_delete on public.financial_import_rows_fh;
create policy financial_import_rows_fh_delete on public.financial_import_rows_fh
  for delete to anon, authenticated
  using (exists (select 1 from public.financial_imports_fh i
    where i.id = financial_import_rows_fh.import_id
      and (i.created_by = public.current_profile_id_fh() or public.is_household_owner_fh(i.household_id))));

-- Cotacoes de referencia: leitura global + da casa; historico imutavel
-- (sem policies de update/delete: linhas nunca sao alteradas).
drop policy if exists exchange_rates_fh_select on public.exchange_rates_fh;
create policy exchange_rates_fh_select on public.exchange_rates_fh
  for select to anon, authenticated
  using (household_id is null or public.is_household_member_fh(household_id));
drop policy if exists exchange_rates_fh_insert on public.exchange_rates_fh;
create policy exchange_rates_fh_insert on public.exchange_rates_fh
  for insert to anon, authenticated
  with check (household_id is not null and public.is_household_member_fh(household_id));

-- Auditoria: membros leem; cada usuario registra os proprios atos.
drop policy if exists audit_logs_fh_select on public.audit_logs_fh;
create policy audit_logs_fh_select on public.audit_logs_fh
  for select to anon, authenticated
  using (public.is_household_member_fh(household_id));
drop policy if exists audit_logs_fh_insert on public.audit_logs_fh;
create policy audit_logs_fh_insert on public.audit_logs_fh
  for insert to anon, authenticated
  with check (user_id = public.current_profile_id_fh() and public.is_household_member_fh(household_id));

commit;

-- ---------------------------------------------------------------------
-- Consultas de validacao (rodar apos a execucao do bloco acima)
-- ---------------------------------------------------------------------
-- 1) Tabelas *_fh (esperado: 24 — 13 das Fases 1-2 + 11 da Fase 3):
select table_name from information_schema.tables
 where table_schema = 'public' and table_name like '%_fh'
 order by table_name;

-- 2) RLS habilitado em todas (esperado: true em todas):
select relname, relrowsecurity
  from pg_class
 where relnamespace = 'public'::regnamespace
   and relname like '%_fh' and relkind = 'r'
 order by relname;

-- 3) Total de policies (esperado: 78 — 38 das Fases 1-2 + 40 da Fase 3):
select count(*) as total_policies from pg_policies
 where schemaname = 'public';

-- 4) Unicidade de idempotencia (esperado: 2 linhas):
select indexname from pg_indexes
 where schemaname = 'public'
   and indexname in ('financial_transactions_fh_period_uniq',
                     'financial_transactions_fh_import_row_id_key')
 order by indexname;

-- 5) FKs diferidas criadas (esperado: 2 linhas):
select constraint_name from information_schema.table_constraints
 where table_schema = 'public'
   and table_name = 'financial_transactions_fh'
   and constraint_name in ('financial_transactions_fh_recurrence_id_fkey',
                           'financial_transactions_fh_import_row_id_fkey')
 order by constraint_name;

-- 5) Rollback (somente se nada posterior tiver sido criado):
--    DROP TABLE IF EXISTS public.audit_logs_fh;
--    DROP TABLE IF EXISTS public.financial_import_rows_fh;
--    DROP TABLE IF EXISTS public.financial_imports_fh;
--    DROP TABLE IF EXISTS public.goal_contributions_fh;
--    DROP TABLE IF EXISTS public.financial_goals_fh;
--    DROP TABLE IF EXISTS public.exchange_operations_fh;
--    DROP TABLE IF EXISTS public.exchange_rates_fh;
--    DROP TABLE IF EXISTS public.financial_transfers_fh;
--    DROP TABLE IF EXISTS public.financial_recurrences_fh;
--    DROP TABLE IF EXISTS public.financial_transactions_fh;
--    DROP TABLE IF EXISTS public.financial_accounts_fh;

-- =====================================================================
-- FH-SQL-004 — Diario domestico + Storage privado
-- Tipo: migracao nova
-- Data: 2026-10-14
-- Fase: 4 — Diario domestico
-- Objetivo: feed privado e arquivo de memorias (posts + midia), 5 espacos
--           de fotos por usuario, catalogo de humores + registros
--           individuais, quadro de dicas, anuncios com leitura e fofocas.
--           Bucket privado `media_fh` com acesso por pasta da casa.
-- Dependencias: FH-SQL-001 a FH-SQL-003 aplicados.
--
-- Objetos criados (9 tabelas + bucket + policies de Storage):
--   posts_fh, post_media_fh, user_photos_fh, moods_fh, user_moods_fh,
--   tips_fh, announcements_fh, announcement_reads_fh, gossip_fh
--   bucket storage `media_fh` (privado) + 3 policies em storage.objects
--
-- Regras garantidas no esquema:
--   * Midia de posts vinculada por FK com cascade: apagar o post apaga seus
--     registros de midia (o arquivo no bucket e preservado para auditoria;
--     limpeza futura documentada, nunca silenciosa em massa).
--   * Slots (user_id, slot 1..5): substituir o slot troca o caminho sem
--     apagar o arquivo antigo — midia antiga usada em posts sobrevive.
--   * Humores do catalogo: globais (household NULL, via app) ou da casa.
--   * Leitura de anuncios por (announcement_id, user_id).
--   * Storage: caminhos `posts/<household-uuid>/...` e
--     `slots/<household-uuid>/...`; leitura/escrita/exclusao somente para
--     membros da casa dona da pasta. URLs assinadas geradas pelo app.
--
-- Fora deste bloco (decisao registrada no diario): comentarios, reacoes e
--   favoritos entram depois do nucleo (Mapa da Verdade, secao 3.5).
--
-- Instrucao: executar o bloco inteiro uma unica vez no Supabase SQL Editor.
-- Estado: [preparado] — aguardando execucao do usuario.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Posts e midia
-- ---------------------------------------------------------------------
create table if not exists public.posts_fh (
  id          uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households_fh (id) on delete cascade,
  author_id   uuid references public.profiles_fh (id) on delete set null,
  title       text check (title is null or char_length(btrim(title)) between 1 and 120),
  body        text not null check (char_length(btrim(body)) between 1 and 10000),
  memory_date date not null default CURRENT_DATE,
  category_id uuid references public.categories_fh (id) on delete set null,
  tags        text[] not null default '{}',
  visibility  text not null default 'shared' check (visibility in ('shared', 'personal')),
  owner_id    uuid references public.profiles_fh (id) on delete set null,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists posts_fh_household_idx on public.posts_fh (household_id);
create index if not exists posts_fh_memory_idx on public.posts_fh (memory_date desc);
create index if not exists posts_fh_tags_idx on public.posts_fh using gin (tags);

create table if not exists public.post_media_fh (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.posts_fh (id) on delete cascade,
  storage_path text not null,
  mime         text not null,
  size_bytes   integer not null check (size_bytes > 0),
  created_by   uuid,
  created_at   timestamptz not null default now()
);

create index if not exists post_media_fh_post_idx on public.post_media_fh (post_id);

-- ---------------------------------------------------------------------
-- 2. Espacos de fotos (5 por usuario)
-- ---------------------------------------------------------------------
create table if not exists public.user_photos_fh (
  user_id      uuid not null references public.profiles_fh (id) on delete cascade,
  slot         integer not null check (slot between 1 and 5),
  storage_path text not null,
  updated_at   timestamptz not null default now(),
  primary key (user_id, slot)
);

-- ---------------------------------------------------------------------
-- 3. Humores: catalogo + registros individuais
-- ---------------------------------------------------------------------
create table if not exists public.moods_fh (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid references public.households_fh (id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 40),
  emoji        text not null,
  color        text,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists moods_fh_household_uniq
  on public.moods_fh (household_id, name) where household_id is not null;
create unique index if not exists moods_fh_global_uniq
  on public.moods_fh (name) where household_id is null;

create table if not exists public.user_moods_fh (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles_fh (id) on delete cascade,
  household_id uuid not null references public.households_fh (id) on delete cascade,
  mood_id      uuid not null references public.moods_fh (id) on delete restrict,
  note         text check (note is null or char_length(note) <= 280),
  date         date not null default CURRENT_DATE,
  created_at   timestamptz not null default now()
);

create index if not exists user_moods_fh_user_idx
  on public.user_moods_fh (user_id, date desc);

-- ---------------------------------------------------------------------
-- 4. Dicas, anuncios (+leitura) e fofocas
-- ---------------------------------------------------------------------
create table if not exists public.tips_fh (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households_fh (id) on delete cascade,
  title        text not null check (char_length(btrim(title)) between 1 and 120),
  body         text not null check (char_length(btrim(body)) between 1 and 5000),
  category_id  uuid references public.categories_fh (id) on delete set null,
  visibility   text not null default 'shared' check (visibility in ('shared', 'personal')),
  owner_id     uuid references public.profiles_fh (id) on delete set null,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists tips_fh_household_idx on public.tips_fh (household_id);

create table if not exists public.announcements_fh (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households_fh (id) on delete cascade,
  title        text not null check (char_length(btrim(title)) between 1 and 120),
  body         text not null check (char_length(btrim(body)) between 1 and 5000),
  pinned       boolean not null default false,
  expires_at   timestamptz,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists announcements_fh_household_idx
  on public.announcements_fh (household_id);

create table if not exists public.announcement_reads_fh (
  announcement_id uuid not null references public.announcements_fh (id) on delete cascade,
  user_id         uuid not null references public.profiles_fh (id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create table if not exists public.gossip_fh (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households_fh (id) on delete cascade,
  title        text check (title is null or char_length(btrim(title)) between 1 and 120),
  body         text not null check (char_length(btrim(body)) between 1 and 5000),
  owner_id     uuid references public.profiles_fh (id) on delete set null,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists gossip_fh_household_idx on public.gossip_fh (household_id);

-- ---------------------------------------------------------------------
-- 5. Bucket privado de midia
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('media_fh', 'media_fh', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 6. Triggers de updated_at
-- ---------------------------------------------------------------------
drop trigger if exists t_posts_fh_updated on public.posts_fh;
create trigger t_posts_fh_updated
  before update on public.posts_fh
  for each row execute function public.set_updated_at_fh();

drop trigger if exists t_user_photos_fh_updated on public.user_photos_fh;
create trigger t_user_photos_fh_updated
  before update on public.user_photos_fh
  for each row execute function public.set_updated_at_fh();

drop trigger if exists t_moods_fh_updated on public.moods_fh;
create trigger t_moods_fh_updated
  before update on public.moods_fh
  for each row execute function public.set_updated_at_fh();

drop trigger if exists t_tips_fh_updated on public.tips_fh;
create trigger t_tips_fh_updated
  before update on public.tips_fh
  for each row execute function public.set_updated_at_fh();

drop trigger if exists t_announcements_fh_updated on public.announcements_fh;
create trigger t_announcements_fh_updated
  before update on public.announcements_fh
  for each row execute function public.set_updated_at_fh();

drop trigger if exists t_gossip_fh_updated on public.gossip_fh;
create trigger t_gossip_fh_updated
  before update on public.gossip_fh
  for each row execute function public.set_updated_at_fh();

-- ---------------------------------------------------------------------
-- 7. Row Level Security
-- ---------------------------------------------------------------------
alter table public.posts_fh enable row level security;
alter table public.post_media_fh enable row level security;
alter table public.user_photos_fh enable row level security;
alter table public.moods_fh enable row level security;
alter table public.user_moods_fh enable row level security;
alter table public.tips_fh enable row level security;
alter table public.announcements_fh enable row level security;
alter table public.announcement_reads_fh enable row level security;
alter table public.gossip_fh enable row level security;

drop policy if exists posts_fh_select on public.posts_fh;
create policy posts_fh_select on public.posts_fh
  for select to anon, authenticated
  using (public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = public.current_profile_id_fh() or created_by = public.current_profile_id_fh()));
drop policy if exists posts_fh_insert on public.posts_fh;
create policy posts_fh_insert on public.posts_fh
  for insert to anon, authenticated
  with check (public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = public.current_profile_id_fh()));
drop policy if exists posts_fh_update on public.posts_fh;
create policy posts_fh_update on public.posts_fh
  for update to anon, authenticated
  using (created_by = public.current_profile_id_fh() or owner_id = public.current_profile_id_fh()
    or public.is_household_owner_fh(household_id))
  with check (public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = public.current_profile_id_fh()));
drop policy if exists posts_fh_delete on public.posts_fh;
create policy posts_fh_delete on public.posts_fh
  for delete to anon, authenticated
  using (created_by = public.current_profile_id_fh() or owner_id = public.current_profile_id_fh()
    or public.is_household_owner_fh(household_id));

drop policy if exists post_media_fh_select on public.post_media_fh;
create policy post_media_fh_select on public.post_media_fh
  for select to anon, authenticated
  using (exists (select 1 from public.posts_fh p
    where p.id = post_id and public.is_household_member_fh(p.household_id)
    and (p.visibility = 'shared' or p.owner_id = public.current_profile_id_fh() or p.created_by = public.current_profile_id_fh())));
drop policy if exists post_media_fh_insert on public.post_media_fh;
create policy post_media_fh_insert on public.post_media_fh
  for insert to anon, authenticated
  with check (exists (select 1 from public.posts_fh p
    where p.id = post_id and public.is_household_member_fh(p.household_id)));
drop policy if exists post_media_fh_update on public.post_media_fh;
create policy post_media_fh_update on public.post_media_fh
  for update to anon, authenticated
  using (created_by = public.current_profile_id_fh()
    or exists (select 1 from public.posts_fh p
      where p.id = post_media_fh.post_id
        and public.is_household_owner_fh(p.household_id)))
  with check (exists (select 1 from public.posts_fh p
    where p.id = post_media_fh.post_id
      and public.is_household_member_fh(p.household_id)));
drop policy if exists post_media_fh_delete on public.post_media_fh;
create policy post_media_fh_delete on public.post_media_fh
  for delete to anon, authenticated
  using (created_by = public.current_profile_id_fh()
    or exists (select 1 from public.posts_fh p
      where p.id = post_media_fh.post_id
        and public.is_household_owner_fh(p.household_id)));

-- Fotos: cada usuario gerencia os proprios 5 espacos; a casa visualiza.
drop policy if exists user_photos_fh_select on public.user_photos_fh;
create policy user_photos_fh_select on public.user_photos_fh
  for select to anon, authenticated
  using (user_id = public.current_profile_id_fh()
    or exists (select 1 from public.profiles_fh me
      join public.profiles_fh other on other.household_id = me.household_id
      where me.id = public.current_profile_id_fh() and other.id = user_photos_fh.user_id
        and me.household_id is not null));
drop policy if exists user_photos_fh_insert on public.user_photos_fh;
create policy user_photos_fh_insert on public.user_photos_fh
  for insert to anon, authenticated
  with check (user_id = public.current_profile_id_fh());
drop policy if exists user_photos_fh_update on public.user_photos_fh;
create policy user_photos_fh_update on public.user_photos_fh
  for update to anon, authenticated
  using (user_id = public.current_profile_id_fh())
  with check (user_id = public.current_profile_id_fh());
drop policy if exists user_photos_fh_delete on public.user_photos_fh;
create policy user_photos_fh_delete on public.user_photos_fh
  for delete to anon, authenticated
  using (user_id = public.current_profile_id_fh());

-- Catalogo de humores: leitura global + da casa; escrita da casa.
drop policy if exists moods_fh_select on public.moods_fh;
create policy moods_fh_select on public.moods_fh
  for select to anon, authenticated
  using (household_id is null or public.is_household_member_fh(household_id));
drop policy if exists moods_fh_insert on public.moods_fh;
create policy moods_fh_insert on public.moods_fh
  for insert to anon, authenticated
  with check (household_id is not null and public.is_household_member_fh(household_id));
drop policy if exists moods_fh_update on public.moods_fh;
create policy moods_fh_update on public.moods_fh
  for update to anon, authenticated
  using (household_id is not null
    and (created_by = public.current_profile_id_fh() or public.is_household_owner_fh(household_id)))
  with check (household_id is not null
    and (created_by = public.current_profile_id_fh() or public.is_household_owner_fh(household_id)));
drop policy if exists moods_fh_delete on public.moods_fh;
create policy moods_fh_delete on public.moods_fh
  for delete to anon, authenticated
  using (household_id is not null
    and (created_by = public.current_profile_id_fh() or public.is_household_owner_fh(household_id)));

-- Registros de humor: visiveis na casa; escrita do proprio usuario.
drop policy if exists user_moods_fh_select on public.user_moods_fh;
create policy user_moods_fh_select on public.user_moods_fh
  for select to anon, authenticated
  using (public.is_household_member_fh(household_id));
drop policy if exists user_moods_fh_insert on public.user_moods_fh;
create policy user_moods_fh_insert on public.user_moods_fh
  for insert to anon, authenticated
  with check (user_id = public.current_profile_id_fh() and public.is_household_member_fh(household_id));
drop policy if exists user_moods_fh_update on public.user_moods_fh;
create policy user_moods_fh_update on public.user_moods_fh
  for update to anon, authenticated
  using (user_id = public.current_profile_id_fh())
  with check (user_id = public.current_profile_id_fh() and public.is_household_member_fh(household_id));
drop policy if exists user_moods_fh_delete on public.user_moods_fh;
create policy user_moods_fh_delete on public.user_moods_fh
  for delete to anon, authenticated
  using (user_id = public.current_profile_id_fh());

drop policy if exists tips_fh_select on public.tips_fh;
create policy tips_fh_select on public.tips_fh
  for select to anon, authenticated
  using (public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = public.current_profile_id_fh() or created_by = public.current_profile_id_fh()));
drop policy if exists tips_fh_insert on public.tips_fh;
create policy tips_fh_insert on public.tips_fh
  for insert to anon, authenticated
  with check (public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = public.current_profile_id_fh()));
drop policy if exists tips_fh_update on public.tips_fh;
create policy tips_fh_update on public.tips_fh
  for update to anon, authenticated
  using (created_by = public.current_profile_id_fh() or owner_id = public.current_profile_id_fh()
    or public.is_household_owner_fh(household_id))
  with check (public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = public.current_profile_id_fh()));
drop policy if exists tips_fh_delete on public.tips_fh;
create policy tips_fh_delete on public.tips_fh
  for delete to anon, authenticated
  using (created_by = public.current_profile_id_fh() or owner_id = public.current_profile_id_fh()
    or public.is_household_owner_fh(household_id));

drop policy if exists announcements_fh_select on public.announcements_fh;
create policy announcements_fh_select on public.announcements_fh
  for select to anon, authenticated
  using (public.is_household_member_fh(household_id));
drop policy if exists announcements_fh_insert on public.announcements_fh;
create policy announcements_fh_insert on public.announcements_fh
  for insert to anon, authenticated
  with check (public.is_household_member_fh(household_id));
drop policy if exists announcements_fh_update on public.announcements_fh;
create policy announcements_fh_update on public.announcements_fh
  for update to anon, authenticated
  using (created_by = public.current_profile_id_fh() or public.is_household_owner_fh(household_id))
  with check (public.is_household_member_fh(household_id));
drop policy if exists announcements_fh_delete on public.announcements_fh;
create policy announcements_fh_delete on public.announcements_fh
  for delete to anon, authenticated
  using (created_by = public.current_profile_id_fh() or public.is_household_owner_fh(household_id));

drop policy if exists announcement_reads_fh_select on public.announcement_reads_fh;
create policy announcement_reads_fh_select on public.announcement_reads_fh
  for select to anon, authenticated
  using (user_id = public.current_profile_id_fh());
drop policy if exists announcement_reads_fh_insert on public.announcement_reads_fh;
create policy announcement_reads_fh_insert on public.announcement_reads_fh
  for insert to anon, authenticated
  with check (user_id = public.current_profile_id_fh());
drop policy if exists announcement_reads_fh_delete on public.announcement_reads_fh;
create policy announcement_reads_fh_delete on public.announcement_reads_fh
  for delete to anon, authenticated
  using (user_id = public.current_profile_id_fh());

drop policy if exists gossip_fh_select on public.gossip_fh;
create policy gossip_fh_select on public.gossip_fh
  for select to anon, authenticated
  using (public.is_household_member_fh(household_id));
drop policy if exists gossip_fh_insert on public.gossip_fh;
create policy gossip_fh_insert on public.gossip_fh
  for insert to anon, authenticated
  with check (public.is_household_member_fh(household_id));
drop policy if exists gossip_fh_update on public.gossip_fh;
create policy gossip_fh_update on public.gossip_fh
  for update to anon, authenticated
  using (created_by = public.current_profile_id_fh() or owner_id = public.current_profile_id_fh()
    or public.is_household_owner_fh(household_id))
  with check (public.is_household_member_fh(household_id));
drop policy if exists gossip_fh_delete on public.gossip_fh;
create policy gossip_fh_delete on public.gossip_fh
  for delete to anon, authenticated
  using (created_by = public.current_profile_id_fh() or owner_id = public.current_profile_id_fh()
    or public.is_household_owner_fh(household_id));

-- ---------------------------------------------------------------------
-- 8. Policies do Storage (bucket media_fh, por pasta da casa)
-- ---------------------------------------------------------------------
drop policy if exists "media_fh_read" on storage.objects;
create policy "media_fh_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'media_fh'
    and public.is_household_member_fh(((storage.foldername(name))[2])::uuid));

drop policy if exists "media_fh_write" on storage.objects;
create policy "media_fh_write" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'media_fh'
    and public.is_household_member_fh(((storage.foldername(name))[2])::uuid));

drop policy if exists "media_fh_remove" on storage.objects;
create policy "media_fh_remove" on storage.objects
  for delete to anon, authenticated
  using (bucket_id = 'media_fh'
    and public.is_household_member_fh(((storage.foldername(name))[2])::uuid));

commit;

-- ---------------------------------------------------------------------
-- Consultas de validacao (rodar apos a execucao do bloco acima)
-- ---------------------------------------------------------------------
-- 1) Tabelas *_fh (esperado: 33 — 24 das Fases 1-3 + 9 da Fase 4):
select table_name from information_schema.tables
 where table_schema = 'public' and table_name like '%_fh'
 order by table_name;

-- 2) RLS habilitado em todas (esperado: true em todas):
select relname, relrowsecurity
  from pg_class
 where relnamespace = 'public'::regnamespace
   and relname like '%_fh' and relkind = 'r'
 order by relname;

-- 3) Total de policies em public (esperado: 113 — 78 das Fases 1-3 + 35 aqui):
select count(*) as total_policies from pg_policies
 where schemaname = 'public';

-- 4) Bucket privado + policies de Storage (esperado: 1 linha + 3 policies):
select id, name, public as is_public from storage.buckets where id = 'media_fh';
select policyname from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
   and policyname like 'media_fh%' order by policyname;

-- 5) Rollback (somente se nada posterior tiver sido criado):
--    DROP TABLE IF EXISTS public.gossip_fh;
--    DROP TABLE IF EXISTS public.announcement_reads_fh;
--    DROP TABLE IF EXISTS public.announcements_fh;
--    DROP TABLE IF EXISTS public.tips_fh;
--    DROP TABLE IF EXISTS public.user_moods_fh;
--    DROP TABLE IF EXISTS public.moods_fh;
--    DROP TABLE IF EXISTS public.user_photos_fh;
--    DROP TABLE IF EXISTS public.post_media_fh;
--    DROP TABLE IF EXISTS public.posts_fh;
--    DELETE FROM storage.buckets WHERE id = 'media_fh';

-- =====================================================================
-- FH-SQL-005 — IA (Groq) e webhooks de automacao (n8n)
-- Tipo: migracao nova
-- Data: 2026-10-14
-- Fase: 5 — IA e n8n
-- Objetivo: configuracao da chave Groq (só backend), conversas e mensagens,
--           memoria seletiva administravel, trilha de acoes da IA e webhooks
--           de automacao para o n8n.
-- Dependencias: FH-SQL-001 aplicado (casa, membros, perfis).
--
-- Objetos criados (6 tabelas, sem funcoes novas):
--   ai_config_fh, ai_conversations_fh, ai_messages_fh, ai_memories_fh,
--   ai_action_logs_fh, automation_webhooks_fh
--
-- Seguranca (inegociavel):
--   * A chave Groq NUNCA aparece neste arquivo nem em nenhuma tabela legivel
--     pelo frontend: ai_config_fh guarda apenas `encrypted_key` (AES-256-GCM,
--     chave em segredo da Edge Function) + `key_last4` para exibicao.
--     Somente as Edge Functions (service_role) leem essa tabela: NENHUMA
--     policy para anon/authenticated — acesso direto e bloqueado.
--   * Conversas sao pessoais (dono = criador). Memorias: leitura na casa,
--     escrita do proprio usuario (ou dono da casa). Logs: leitura na casa,
--     insercao do proprio usuario.
--   * Acoes sensiveis da IA passam por `ai_action_logs_fh` com status
--     proposed -> executed/denied: nada destrutivo executa sem confirmacao.
--   * Webhooks do n8n: leitura na casa; escrita só do dono da casa. A URL e
--     o endpoint de automacao da propria casa (sem segredo de terceiros).
--
-- Instrucao: executar o bloco inteiro uma unica vez no Supabase SQL Editor.
-- Estado: [preparado] — aguardando execucao do usuario.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Configuracao Groq global (somente backend le)
-- ---------------------------------------------------------------------
create table if not exists public.ai_config_fh (
  config_id     text primary key default 'global' check (config_id = 'global'),
  provider      text not null default 'groq',
  encrypted_key text,
  key_last4     char(4),
  model         text not null default 'llama-3.3-70b-versatile',
  updated_at    timestamptz not null default now()
);

drop trigger if exists t_ai_config_fh_updated on public.ai_config_fh;
create trigger t_ai_config_fh_updated
  before update on public.ai_config_fh
  for each row execute function public.set_updated_at_fh();

-- ---------------------------------------------------------------------
-- 2. Conversas e mensagens (pessoais)
-- ---------------------------------------------------------------------
create table if not exists public.ai_conversations_fh (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households_fh (id) on delete cascade,
  user_id      uuid not null references public.profiles_fh (id) on delete cascade,
  title        text not null default 'Conversa',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists ai_conversations_fh_user_idx
  on public.ai_conversations_fh (user_id, updated_at desc);

drop trigger if exists t_ai_conversations_fh_updated on public.ai_conversations_fh;
create trigger t_ai_conversations_fh_updated
  before update on public.ai_conversations_fh
  for each row execute function public.set_updated_at_fh();

create table if not exists public.ai_messages_fh (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations_fh (id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content         text not null,
  tool_calls      jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists ai_messages_fh_conversation_idx
  on public.ai_messages_fh (conversation_id, created_at);

-- ---------------------------------------------------------------------
-- 3. Memoria seletiva administravel
-- ---------------------------------------------------------------------
create table if not exists public.ai_memories_fh (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households_fh (id) on delete cascade,
  user_id      uuid references public.profiles_fh (id) on delete cascade,
  content      text not null check (char_length(btrim(content)) between 1 and 1000),
  active       boolean not null default true,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists ai_memories_fh_household_idx
  on public.ai_memories_fh (household_id);

drop trigger if exists t_ai_memories_fh_updated on public.ai_memories_fh;
create trigger t_ai_memories_fh_updated
  before update on public.ai_memories_fh
  for each row execute function public.set_updated_at_fh();

-- ---------------------------------------------------------------------
-- 4. Trilha de acoes da IA
-- ---------------------------------------------------------------------
create table if not exists public.ai_action_logs_fh (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references public.households_fh (id) on delete cascade,
  user_id         uuid not null references public.profiles_fh (id) on delete cascade,
  conversation_id uuid references public.ai_conversations_fh (id) on delete set null,
  tool            text not null,
  args            jsonb,
  result          jsonb,
  status          text not null default 'proposed'
                  check (status in ('proposed', 'executed', 'denied', 'error')),
  created_at      timestamptz not null default now()
);

create index if not exists ai_action_logs_fh_household_idx
  on public.ai_action_logs_fh (household_id, created_at desc);

-- ---------------------------------------------------------------------
-- 5. Webhooks de automacao (n8n)
-- ---------------------------------------------------------------------
create table if not exists public.automation_webhooks_fh (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households_fh (id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 60),
  url          text not null check (url like 'https://%'),
  events       text[] not null default '{digest}',
  active       boolean not null default true,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists t_automation_webhooks_fh_updated on public.automation_webhooks_fh;
create trigger t_automation_webhooks_fh_updated
  before update on public.automation_webhooks_fh
  for each row execute function public.set_updated_at_fh();

-- ---------------------------------------------------------------------
-- 6. Row Level Security
--    (ai_config_fh: SEM policies para anon/authenticated — só service_role.)
-- ---------------------------------------------------------------------
alter table public.ai_config_fh enable row level security;
alter table public.ai_conversations_fh enable row level security;
alter table public.ai_messages_fh enable row level security;
alter table public.ai_memories_fh enable row level security;
alter table public.ai_action_logs_fh enable row level security;
alter table public.automation_webhooks_fh enable row level security;

drop policy if exists ai_conversations_fh_select on public.ai_conversations_fh;
create policy ai_conversations_fh_select on public.ai_conversations_fh
  for select to anon, authenticated using (user_id = public.current_profile_id_fh());
drop policy if exists ai_conversations_fh_insert on public.ai_conversations_fh;
create policy ai_conversations_fh_insert on public.ai_conversations_fh
  for insert to anon, authenticated
  with check (user_id = public.current_profile_id_fh() and public.is_household_member_fh(household_id));
drop policy if exists ai_conversations_fh_update on public.ai_conversations_fh;
create policy ai_conversations_fh_update on public.ai_conversations_fh
  for update to anon, authenticated
  using (user_id = public.current_profile_id_fh()) with check (user_id = public.current_profile_id_fh());
drop policy if exists ai_conversations_fh_delete on public.ai_conversations_fh;
create policy ai_conversations_fh_delete on public.ai_conversations_fh
  for delete to anon, authenticated using (user_id = public.current_profile_id_fh());

drop policy if exists ai_messages_fh_select on public.ai_messages_fh;
create policy ai_messages_fh_select on public.ai_messages_fh
  for select to anon, authenticated
  using (exists (select 1 from public.ai_conversations_fh c
    where c.id = conversation_id and c.user_id = public.current_profile_id_fh()));
drop policy if exists ai_messages_fh_insert on public.ai_messages_fh;
create policy ai_messages_fh_insert on public.ai_messages_fh
  for insert to anon, authenticated
  with check (exists (select 1 from public.ai_conversations_fh c
    where c.id = conversation_id and c.user_id = public.current_profile_id_fh()));
drop policy if exists ai_messages_fh_update on public.ai_messages_fh;
create policy ai_messages_fh_update on public.ai_messages_fh
  for update to anon, authenticated
  using (exists (select 1 from public.ai_conversations_fh c
    where c.id = ai_messages_fh.conversation_id and c.user_id = public.current_profile_id_fh()))
  with check (exists (select 1 from public.ai_conversations_fh c
    where c.id = ai_messages_fh.conversation_id and c.user_id = public.current_profile_id_fh()));
drop policy if exists ai_messages_fh_delete on public.ai_messages_fh;
create policy ai_messages_fh_delete on public.ai_messages_fh
  for delete to anon, authenticated
  using (exists (select 1 from public.ai_conversations_fh c
    where c.id = ai_messages_fh.conversation_id and c.user_id = public.current_profile_id_fh()));

drop policy if exists ai_memories_fh_select on public.ai_memories_fh;
create policy ai_memories_fh_select on public.ai_memories_fh
  for select to anon, authenticated
  using (public.is_household_member_fh(household_id));
drop policy if exists ai_memories_fh_insert on public.ai_memories_fh;
create policy ai_memories_fh_insert on public.ai_memories_fh
  for insert to anon, authenticated
  with check (public.is_household_member_fh(household_id)
    and (user_id is null or user_id = public.current_profile_id_fh()));
drop policy if exists ai_memories_fh_update on public.ai_memories_fh;
create policy ai_memories_fh_update on public.ai_memories_fh
  for update to anon, authenticated
  using (created_by = public.current_profile_id_fh() or public.is_household_owner_fh(household_id))
  with check (public.is_household_member_fh(household_id));
drop policy if exists ai_memories_fh_delete on public.ai_memories_fh;
create policy ai_memories_fh_delete on public.ai_memories_fh
  for delete to anon, authenticated
  using (created_by = public.current_profile_id_fh() or public.is_household_owner_fh(household_id));

drop policy if exists ai_action_logs_fh_select on public.ai_action_logs_fh;
create policy ai_action_logs_fh_select on public.ai_action_logs_fh
  for select to anon, authenticated
  using (public.is_household_member_fh(household_id));
drop policy if exists ai_action_logs_fh_insert on public.ai_action_logs_fh;
create policy ai_action_logs_fh_insert on public.ai_action_logs_fh
  for insert to anon, authenticated
  with check (user_id = public.current_profile_id_fh() and public.is_household_member_fh(household_id));

drop policy if exists automation_webhooks_fh_select on public.automation_webhooks_fh;
create policy automation_webhooks_fh_select on public.automation_webhooks_fh
  for select to anon, authenticated
  using (public.is_household_member_fh(household_id));
drop policy if exists automation_webhooks_fh_insert on public.automation_webhooks_fh;
create policy automation_webhooks_fh_insert on public.automation_webhooks_fh
  for insert to anon, authenticated
  with check (public.is_household_owner_fh(household_id));
drop policy if exists automation_webhooks_fh_update on public.automation_webhooks_fh;
create policy automation_webhooks_fh_update on public.automation_webhooks_fh
  for update to anon, authenticated
  using (public.is_household_owner_fh(household_id))
  with check (public.is_household_owner_fh(household_id));
drop policy if exists automation_webhooks_fh_delete on public.automation_webhooks_fh;
create policy automation_webhooks_fh_delete on public.automation_webhooks_fh
  for delete to anon, authenticated
  using (public.is_household_owner_fh(household_id));

commit;

-- ---------------------------------------------------------------------
-- Consultas de validacao (rodar apos a execucao do bloco acima)
-- ---------------------------------------------------------------------
-- 1) Tabelas *_fh (esperado: 39 — 33 das Fases 1-4 + 6 da Fase 5):
select table_name from information_schema.tables
 where table_schema = 'public' and table_name like '%_fh'
 order by table_name;

-- 2) RLS habilitado em todas (esperado: true em todas):
select relname, relrowsecurity
  from pg_class
 where relnamespace = 'public'::regnamespace
   and relname like '%_fh' and relkind = 'r'
 order by relname;

-- 3) Total de policies em public (esperado: 131 = 113 + 18 novas:
--    conversas 4 + mensagens 4 + memorias 4 + logs 2 + webhooks 4; config 0):
select count(*) as total_policies from pg_policies
 where schemaname = 'public';

-- 3b) Detalhe por tabela da Fase 5:
select tablename, count(*) from pg_policies
 where schemaname = 'public'
   and tablename in ('ai_conversations_fh', 'ai_messages_fh', 'ai_memories_fh',
                     'ai_action_logs_fh', 'automation_webhooks_fh')
 group by tablename order by tablename;

-- 4) ai_config_fh SEM acesso direto (esperado: 0 policies p/ anon/authenticated):
select count(*) as config_policies from pg_policies
 where schemaname = 'public' and tablename = 'ai_config_fh';
-- Esperado: 0 (somente service_role, usado pelas Edge Functions).

-- 5) Rollback (somente se nada posterior tiver sido criado):
--    DROP TABLE IF EXISTS public.automation_webhooks_fh;
--    DROP TABLE IF EXISTS public.ai_action_logs_fh;
--    DROP TABLE IF EXISTS public.ai_memories_fh;
--    DROP TABLE IF EXISTS public.ai_messages_fh;
--    DROP TABLE IF EXISTS public.ai_conversations_fh;
--    DROP TABLE IF EXISTS public.ai_config_fh;

-- =====================================================================
-- FH-SQL-006 — Inscricoes de push por usuario (Fase 6)
-- Tipo: migracao nova
-- Data: 2026-10-14
-- Fase: 6 — Offline e refinamento
-- Objetivo: guardar endpoints de push (Web Push) por usuario para entrega
--           futura via backend/n8n. A entrega em si depende de chave VAPID
--           e worker de push no servidor (Fase 7 ou n8n).
-- Dependencias: profiles_fh.
--
-- Objetos: push_subscriptions_fh (user_id, endpoint unico, keys jsonb).
-- RLS: leitura/insercao/exclusao do proprio usuario (sem update: para
--      renovar, exclui e reinscreve).
--
-- Instrucao: executar o bloco inteiro uma unica vez no Supabase SQL Editor.
-- Estado: [preparado] — aguardando execucao do usuario.
-- =====================================================================

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

commit;

-- ---------------------------------------------------------------------
-- Consultas de validacao
-- ---------------------------------------------------------------------
-- 1) Tabela existe com RLS (esperado: 1 linha, relrowsecurity = true):
select relname, relrowsecurity from pg_class
 where relnamespace = 'public'::regnamespace and relname = 'push_subscriptions_fh';

-- 2) Policies (esperado: 3 — select/insert/delete):
select policyname from pg_policies
 where schemaname = 'public' and tablename = 'push_subscriptions_fh'
 order by policyname;

-- 3) Totais gerais (esperado: 40 tabelas *_fh, 134 policies em public):
select count(*) from information_schema.tables
 where table_schema = 'public' and table_name like '%_fh';

-- =====================================================================
-- FH-SQL-009 — Chave Groq global compartilhada (sem chave por casa)
-- Data: 2026-10-24
-- Objetivo: manter uma única configuração Groq para todos os perfis.
-- Dependências: ai_config_fh criada pelo FH-SQL-005.
-- Efeito: remove o vínculo por household_id e usa config_id = 'global'.
-- Migração de dados: se houver configurações antigas por casa, preserva a
--   linha atualizada mais recentemente e descarta as demais.
-- Rollback: não há rollback automático confiável após colapsar várias chaves.
-- Estado: [preparado] — aplicar se o banco já foi criado com a versão antiga.
--         O arquivo completo em banco limpo já termina neste formato.
-- =====================================================================

begin;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ai_config_fh'
      and column_name = 'household_id'
  ) then
    delete from public.ai_config_fh
    where household_id not in (
      select household_id from public.ai_config_fh
      order by updated_at desc, household_id
      limit 1
    );

    alter table public.ai_config_fh
      drop constraint if exists ai_config_fh_pkey;
    alter table public.ai_config_fh
      drop constraint if exists ai_config_fh_household_id_fkey;
    alter table public.ai_config_fh drop column household_id;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ai_config_fh'
      and column_name = 'config_id'
  ) then
    alter table public.ai_config_fh
      add column config_id text not null default 'global';
  end if;

  update public.ai_config_fh set config_id = 'global';
  alter table public.ai_config_fh
    alter column config_id set default 'global',
    alter column config_id set not null,
    drop constraint if exists ai_config_fh_pkey,
    drop constraint if exists ai_config_fh_config_id_check;
  alter table public.ai_config_fh
    add constraint ai_config_fh_pkey primary key (config_id),
    add constraint ai_config_fh_config_id_check check (config_id = 'global');
end;
$$;

commit;

-- Validacao FH-SQL-009: deve haver zero ou uma linha, e qualquer linha tem
-- config_id = 'global'. A chave nunca aparece nesta consulta.
select config_id, provider, key_last4, model, updated_at
from public.ai_config_fh;
select count(*) as total_policies from pg_policies
 where schemaname = 'public';
