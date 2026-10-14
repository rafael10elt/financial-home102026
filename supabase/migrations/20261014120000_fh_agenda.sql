-- FH-SQL-002 (espelho de banco.sql) - manter sincronizado com o livro banco.sql
-- Fonte autoritativa: banco.sql, secao FH-SQL-002

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
      and h.created_by = auth.uid()
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
  owner_id            uuid references auth.users (id) on delete set null,
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
  owner_id            uuid references auth.users (id) on delete set null,
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
  owner_id            uuid references auth.users (id) on delete set null,
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
  user_id      uuid not null references auth.users (id) on delete cascade,
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
  user_id          uuid primary key references auth.users (id) on delete cascade,
  enabled          boolean not null default true,
  digest_enabled   boolean not null default false,
  lead_time_hours  integer not null default 24 check (lead_time_hours >= 0),
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6. Layout de widgets por usuário
-- ---------------------------------------------------------------------
create table if not exists public.dashboard_layouts_fh (
  user_id    uuid primary key references auth.users (id) on delete cascade,
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
  to authenticated
  using (household_id is null or public.is_household_member_fh(household_id));

drop policy if exists categories_fh_insert on public.categories_fh;
create policy categories_fh_insert on public.categories_fh
  for insert
  to authenticated
  with check (
    household_id is not null
    and public.is_household_member_fh(household_id)
  );

drop policy if exists categories_fh_update on public.categories_fh;
create policy categories_fh_update on public.categories_fh
  for update
  to authenticated
  using (
    household_id is not null
    and (created_by = auth.uid() or public.is_household_owner_fh(household_id))
  )
  with check (
    household_id is not null
    and (created_by = auth.uid() or public.is_household_owner_fh(household_id))
  );

drop policy if exists categories_fh_delete on public.categories_fh;
create policy categories_fh_delete on public.categories_fh
  for delete
  to authenticated
  using (
    household_id is not null
    and (created_by = auth.uid() or public.is_household_owner_fh(household_id))
  );

-- Regras de recorrência: escopo da casa; escrita pelo criador ou dono da casa.
drop policy if exists recurrence_rules_fh_select on public.recurrence_rules_fh;
create policy recurrence_rules_fh_select on public.recurrence_rules_fh
  for select
  to authenticated
  using (public.is_household_member_fh(household_id));

drop policy if exists recurrence_rules_fh_insert on public.recurrence_rules_fh;
create policy recurrence_rules_fh_insert on public.recurrence_rules_fh
  for insert
  to authenticated
  with check (public.is_household_member_fh(household_id));

drop policy if exists recurrence_rules_fh_update on public.recurrence_rules_fh;
create policy recurrence_rules_fh_update on public.recurrence_rules_fh
  for update
  to authenticated
  using (created_by = auth.uid() or public.is_household_owner_fh(household_id))
  with check (created_by = auth.uid() or public.is_household_owner_fh(household_id));

drop policy if exists recurrence_rules_fh_delete on public.recurrence_rules_fh;
create policy recurrence_rules_fh_delete on public.recurrence_rules_fh
  for delete
  to authenticated
  using (created_by = auth.uid() or public.is_household_owner_fh(household_id));

-- Exceções: seguem a casa da regra-pai.
drop policy if exists recurrence_exceptions_fh_select on public.recurrence_exceptions_fh;
create policy recurrence_exceptions_fh_select on public.recurrence_exceptions_fh
  for select
  to authenticated
  using (
    exists (
      select 1 from public.recurrence_rules_fh r
      where r.id = rule_id and public.is_household_member_fh(r.household_id)
    )
  );

drop policy if exists recurrence_exceptions_fh_insert on public.recurrence_exceptions_fh;
create policy recurrence_exceptions_fh_insert on public.recurrence_exceptions_fh
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.recurrence_rules_fh r
      where r.id = rule_id and public.is_household_member_fh(r.household_id)
    )
  );

drop policy if exists recurrence_exceptions_fh_update on public.recurrence_exceptions_fh;
create policy recurrence_exceptions_fh_update on public.recurrence_exceptions_fh
  for update
  to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.recurrence_rules_fh r
      where r.id = recurrence_exceptions_fh.rule_id
        and public.is_household_owner_fh(r.household_id)
    )
  )
  with check (
    created_by = auth.uid()
    or exists (
      select 1 from public.recurrence_rules_fh r
      where r.id = recurrence_exceptions_fh.rule_id
        and public.is_household_owner_fh(r.household_id)
    )
  );

drop policy if exists recurrence_exceptions_fh_delete on public.recurrence_exceptions_fh;
create policy recurrence_exceptions_fh_delete on public.recurrence_exceptions_fh
  for delete
  to authenticated
  using (
    created_by = auth.uid()
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
  to authenticated
  using (
    public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = auth.uid() or created_by = auth.uid())
  );

drop policy if exists events_fh_insert on public.events_fh;
create policy events_fh_insert on public.events_fh
  for insert
  to authenticated
  with check (
    public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = auth.uid())
  );

drop policy if exists events_fh_update on public.events_fh;
create policy events_fh_update on public.events_fh
  for update
  to authenticated
  using (
    created_by = auth.uid()
    or owner_id = auth.uid()
    or public.is_household_owner_fh(household_id)
  )
  with check (
    public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = auth.uid())
  );

drop policy if exists events_fh_delete on public.events_fh;
create policy events_fh_delete on public.events_fh
  for delete
  to authenticated
  using (
    created_by = auth.uid()
    or owner_id = auth.uid()
    or public.is_household_owner_fh(household_id)
  );

drop policy if exists tasks_fh_select on public.tasks_fh;
create policy tasks_fh_select on public.tasks_fh
  for select
  to authenticated
  using (
    public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = auth.uid() or created_by = auth.uid())
  );

drop policy if exists tasks_fh_insert on public.tasks_fh;
create policy tasks_fh_insert on public.tasks_fh
  for insert
  to authenticated
  with check (
    public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = auth.uid())
  );

drop policy if exists tasks_fh_update on public.tasks_fh;
create policy tasks_fh_update on public.tasks_fh
  for update
  to authenticated
  using (
    created_by = auth.uid()
    or owner_id = auth.uid()
    or public.is_household_owner_fh(household_id)
  )
  with check (
    public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = auth.uid())
  );

drop policy if exists tasks_fh_delete on public.tasks_fh;
create policy tasks_fh_delete on public.tasks_fh
  for delete
  to authenticated
  using (
    created_by = auth.uid()
    or owner_id = auth.uid()
    or public.is_household_owner_fh(household_id)
  );

drop policy if exists reminders_fh_select on public.reminders_fh;
create policy reminders_fh_select on public.reminders_fh
  for select
  to authenticated
  using (
    public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = auth.uid() or created_by = auth.uid())
  );

drop policy if exists reminders_fh_insert on public.reminders_fh;
create policy reminders_fh_insert on public.reminders_fh
  for insert
  to authenticated
  with check (
    public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = auth.uid())
  );

drop policy if exists reminders_fh_update on public.reminders_fh;
create policy reminders_fh_update on public.reminders_fh
  for update
  to authenticated
  using (
    created_by = auth.uid()
    or owner_id = auth.uid()
    or public.is_household_owner_fh(household_id)
  )
  with check (
    public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = auth.uid())
  );

drop policy if exists reminders_fh_delete on public.reminders_fh;
create policy reminders_fh_delete on public.reminders_fh
  for delete
  to authenticated
  using (
    created_by = auth.uid()
    or owner_id = auth.uid()
    or public.is_household_owner_fh(household_id)
  );

-- Notificações: estritamente pessoais (destinatário).
drop policy if exists notifications_fh_select on public.notifications_fh;
create policy notifications_fh_select on public.notifications_fh
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists notifications_fh_insert on public.notifications_fh;
create policy notifications_fh_insert on public.notifications_fh
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists notifications_fh_update on public.notifications_fh;
create policy notifications_fh_update on public.notifications_fh
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists notifications_fh_delete on public.notifications_fh;
create policy notifications_fh_delete on public.notifications_fh
  for delete
  to authenticated
  using (user_id = auth.uid());

-- Preferências de notificação e layout: estritamente pessoais.
drop policy if exists notification_preferences_fh_all on public.notification_preferences_fh;
create policy notification_preferences_fh_all on public.notification_preferences_fh
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists dashboard_layouts_fh_all on public.dashboard_layouts_fh;
create policy dashboard_layouts_fh_all on public.dashboard_layouts_fh
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 9. Permissões de execução da função auxiliar
-- ---------------------------------------------------------------------
revoke all on function public.is_household_owner_fh(uuid) from public, anon;
grant execute on function public.is_household_owner_fh(uuid) to authenticated;

commit