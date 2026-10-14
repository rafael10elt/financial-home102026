-- FH-SQL-005 (espelho de banco.sql) - manter sincronizado com o livro banco.sql
-- Fonte autoritativa: banco.sql, secao FH-SQL-005

begin;

-- ---------------------------------------------------------------------
-- 1. Configuracao Groq por casa (somente backend le)
-- ---------------------------------------------------------------------
create table if not exists public.ai_config_fh (
  household_id  uuid primary key references public.households_fh (id) on delete cascade,
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
  user_id      uuid not null references auth.users (id) on delete cascade,
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
  user_id      uuid references auth.users (id) on delete cascade,
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
  user_id         uuid not null references auth.users (id) on delete cascade,
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
  for select to authenticated using (user_id = auth.uid());
drop policy if exists ai_conversations_fh_insert on public.ai_conversations_fh;
create policy ai_conversations_fh_insert on public.ai_conversations_fh
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_household_member_fh(household_id));
drop policy if exists ai_conversations_fh_update on public.ai_conversations_fh;
create policy ai_conversations_fh_update on public.ai_conversations_fh
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists ai_conversations_fh_delete on public.ai_conversations_fh;
create policy ai_conversations_fh_delete on public.ai_conversations_fh
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists ai_messages_fh_select on public.ai_messages_fh;
create policy ai_messages_fh_select on public.ai_messages_fh
  for select to authenticated
  using (exists (select 1 from public.ai_conversations_fh c
    where c.id = conversation_id and c.user_id = auth.uid()));
drop policy if exists ai_messages_fh_insert on public.ai_messages_fh;
create policy ai_messages_fh_insert on public.ai_messages_fh
  for insert to authenticated
  with check (exists (select 1 from public.ai_conversations_fh c
    where c.id = conversation_id and c.user_id = auth.uid()));
drop policy if exists ai_messages_fh_update on public.ai_messages_fh;
create policy ai_messages_fh_update on public.ai_messages_fh
  for update to authenticated
  using (exists (select 1 from public.ai_conversations_fh c
    where c.id = ai_messages_fh.conversation_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.ai_conversations_fh c
    where c.id = ai_messages_fh.conversation_id and c.user_id = auth.uid()));
drop policy if exists ai_messages_fh_delete on public.ai_messages_fh;
create policy ai_messages_fh_delete on public.ai_messages_fh
  for delete to authenticated
  using (exists (select 1 from public.ai_conversations_fh c
    where c.id = ai_messages_fh.conversation_id and c.user_id = auth.uid()));

drop policy if exists ai_memories_fh_select on public.ai_memories_fh;
create policy ai_memories_fh_select on public.ai_memories_fh
  for select to authenticated
  using (public.is_household_member_fh(household_id));
drop policy if exists ai_memories_fh_insert on public.ai_memories_fh;
create policy ai_memories_fh_insert on public.ai_memories_fh
  for insert to authenticated
  with check (public.is_household_member_fh(household_id)
    and (user_id is null or user_id = auth.uid()));
drop policy if exists ai_memories_fh_update on public.ai_memories_fh;
create policy ai_memories_fh_update on public.ai_memories_fh
  for update to authenticated
  using (created_by = auth.uid() or public.is_household_owner_fh(household_id))
  with check (public.is_household_member_fh(household_id));
drop policy if exists ai_memories_fh_delete on public.ai_memories_fh;
create policy ai_memories_fh_delete on public.ai_memories_fh
  for delete to authenticated
  using (created_by = auth.uid() or public.is_household_owner_fh(household_id));

drop policy if exists ai_action_logs_fh_select on public.ai_action_logs_fh;
create policy ai_action_logs_fh_select on public.ai_action_logs_fh
  for select to authenticated
  using (public.is_household_member_fh(household_id));
drop policy if exists ai_action_logs_fh_insert on public.ai_action_logs_fh;
create policy ai_action_logs_fh_insert on public.ai_action_logs_fh
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_household_member_fh(household_id));

drop policy if exists automation_webhooks_fh_select on public.automation_webhooks_fh;
create policy automation_webhooks_fh_select on public.automation_webhooks_fh
  for select to authenticated
  using (public.is_household_member_fh(household_id));
drop policy if exists automation_webhooks_fh_insert on public.automation_webhooks_fh;
create policy automation_webhooks_fh_insert on public.automation_webhooks_fh
  for insert to authenticated
  with check (public.is_household_owner_fh(household_id));
drop policy if exists automation_webhooks_fh_update on public.automation_webhooks_fh;
create policy automation_webhooks_fh_update on public.automation_webhooks_fh
  for update to authenticated
  using (public.is_household_owner_fh(household_id))
  with check (public.is_household_owner_fh(household_id));
drop policy if exists automation_webhooks_fh_delete on public.automation_webhooks_fh;
create policy automation_webhooks_fh_delete on public.automation_webhooks_fh
  for delete to authenticated
  using (public.is_household_owner_fh(household_id));

commit