-- FH-SQL-003 (espelho de banco.sql) - manter sincronizado com o livro banco.sql
-- Fonte autoritativa: banco.sql, secao FH-SQL-003

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
  owner_id         uuid references auth.users (id) on delete set null,
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
  owner_id            uuid references auth.users (id) on delete set null,
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
  owner_id         uuid references auth.users (id) on delete set null,
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
  owner_id       uuid references auth.users (id) on delete set null,
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
  user_id      uuid not null references auth.users (id) on delete cascade,
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
  for select to authenticated
  using (public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = auth.uid() or created_by = auth.uid()));
drop policy if exists financial_accounts_fh_insert on public.financial_accounts_fh;
create policy financial_accounts_fh_insert on public.financial_accounts_fh
  for insert to authenticated
  with check (public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = auth.uid()));
drop policy if exists financial_accounts_fh_update on public.financial_accounts_fh;
create policy financial_accounts_fh_update on public.financial_accounts_fh
  for update to authenticated
  using (created_by = auth.uid() or owner_id = auth.uid()
    or public.is_household_owner_fh(household_id))
  with check (public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = auth.uid()));
drop policy if exists financial_accounts_fh_delete on public.financial_accounts_fh;
create policy financial_accounts_fh_delete on public.financial_accounts_fh
  for delete to authenticated
  using (created_by = auth.uid() or owner_id = auth.uid()
    or public.is_household_owner_fh(household_id));

drop policy if exists financial_transactions_fh_select on public.financial_transactions_fh;
create policy financial_transactions_fh_select on public.financial_transactions_fh
  for select to authenticated
  using (public.is_household_member_fh(household_id)
    and (owner_id = auth.uid() or created_by = auth.uid()
      or exists (select 1 from public.financial_accounts_fh a
        where a.id = account_id and a.visibility = 'shared')));
drop policy if exists financial_transactions_fh_insert on public.financial_transactions_fh;
create policy financial_transactions_fh_insert on public.financial_transactions_fh
  for insert to authenticated
  with check (public.is_household_member_fh(household_id));
drop policy if exists financial_transactions_fh_update on public.financial_transactions_fh;
create policy financial_transactions_fh_update on public.financial_transactions_fh
  for update to authenticated
  using (created_by = auth.uid() or owner_id = auth.uid()
    or public.is_household_owner_fh(household_id))
  with check (public.is_household_member_fh(household_id));
drop policy if exists financial_transactions_fh_delete on public.financial_transactions_fh;
create policy financial_transactions_fh_delete on public.financial_transactions_fh
  for delete to authenticated
  using (created_by = auth.uid() or owner_id = auth.uid()
    or public.is_household_owner_fh(household_id));

drop policy if exists financial_recurrences_fh_select on public.financial_recurrences_fh;
create policy financial_recurrences_fh_select on public.financial_recurrences_fh
  for select to authenticated
  using (public.is_household_member_fh(household_id));
drop policy if exists financial_recurrences_fh_insert on public.financial_recurrences_fh;
create policy financial_recurrences_fh_insert on public.financial_recurrences_fh
  for insert to authenticated
  with check (public.is_household_member_fh(household_id));
drop policy if exists financial_recurrences_fh_update on public.financial_recurrences_fh;
create policy financial_recurrences_fh_update on public.financial_recurrences_fh
  for update to authenticated
  using (created_by = auth.uid() or owner_id = auth.uid()
    or public.is_household_owner_fh(household_id))
  with check (public.is_household_member_fh(household_id));
drop policy if exists financial_recurrences_fh_delete on public.financial_recurrences_fh;
create policy financial_recurrences_fh_delete on public.financial_recurrences_fh
  for delete to authenticated
  using (created_by = auth.uid() or owner_id = auth.uid()
    or public.is_household_owner_fh(household_id));

drop policy if exists financial_transfers_fh_select on public.financial_transfers_fh;
create policy financial_transfers_fh_select on public.financial_transfers_fh
  for select to authenticated
  using (public.is_household_member_fh(household_id));
drop policy if exists financial_transfers_fh_insert on public.financial_transfers_fh;
create policy financial_transfers_fh_insert on public.financial_transfers_fh
  for insert to authenticated
  with check (public.is_household_member_fh(household_id));
drop policy if exists financial_transfers_fh_update on public.financial_transfers_fh;
create policy financial_transfers_fh_update on public.financial_transfers_fh
  for update to authenticated
  using (created_by = auth.uid() or public.is_household_owner_fh(household_id))
  with check (public.is_household_member_fh(household_id));
drop policy if exists financial_transfers_fh_delete on public.financial_transfers_fh;
create policy financial_transfers_fh_delete on public.financial_transfers_fh
  for delete to authenticated
  using (created_by = auth.uid() or public.is_household_owner_fh(household_id));

drop policy if exists exchange_operations_fh_select on public.exchange_operations_fh;
create policy exchange_operations_fh_select on public.exchange_operations_fh
  for select to authenticated
  using (public.is_household_member_fh(household_id));
drop policy if exists exchange_operations_fh_insert on public.exchange_operations_fh;
create policy exchange_operations_fh_insert on public.exchange_operations_fh
  for insert to authenticated
  with check (public.is_household_member_fh(household_id));
drop policy if exists exchange_operations_fh_update on public.exchange_operations_fh;
create policy exchange_operations_fh_update on public.exchange_operations_fh
  for update to authenticated
  using (created_by = auth.uid() or public.is_household_owner_fh(household_id))
  with check (public.is_household_member_fh(household_id));
drop policy if exists exchange_operations_fh_delete on public.exchange_operations_fh;
create policy exchange_operations_fh_delete on public.exchange_operations_fh
  for delete to authenticated
  using (created_by = auth.uid() or public.is_household_owner_fh(household_id));

drop policy if exists financial_goals_fh_select on public.financial_goals_fh;
create policy financial_goals_fh_select on public.financial_goals_fh
  for select to authenticated
  using (public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = auth.uid() or created_by = auth.uid()));
drop policy if exists financial_goals_fh_insert on public.financial_goals_fh;
create policy financial_goals_fh_insert on public.financial_goals_fh
  for insert to authenticated
  with check (public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = auth.uid()));
drop policy if exists financial_goals_fh_update on public.financial_goals_fh;
create policy financial_goals_fh_update on public.financial_goals_fh
  for update to authenticated
  using (created_by = auth.uid() or owner_id = auth.uid()
    or public.is_household_owner_fh(household_id))
  with check (public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = auth.uid()));
drop policy if exists financial_goals_fh_delete on public.financial_goals_fh;
create policy financial_goals_fh_delete on public.financial_goals_fh
  for delete to authenticated
  using (created_by = auth.uid() or owner_id = auth.uid()
    or public.is_household_owner_fh(household_id));

-- Contribuicoes e linhas de importacao seguem a casa do registro-pai.
drop policy if exists goal_contributions_fh_select on public.goal_contributions_fh;
create policy goal_contributions_fh_select on public.goal_contributions_fh
  for select to authenticated
  using (exists (select 1 from public.financial_goals_fh g
    where g.id = goal_id and public.is_household_member_fh(g.household_id)));
drop policy if exists goal_contributions_fh_insert on public.goal_contributions_fh;
create policy goal_contributions_fh_insert on public.goal_contributions_fh
  for insert to authenticated
  with check (exists (select 1 from public.financial_goals_fh g
    where g.id = goal_id and public.is_household_member_fh(g.household_id)));
drop policy if exists goal_contributions_fh_update on public.goal_contributions_fh;
create policy goal_contributions_fh_update on public.goal_contributions_fh
  for update to authenticated
  using (created_by = auth.uid()
    or exists (select 1 from public.financial_goals_fh g
      where g.id = goal_contributions_fh.goal_id
        and public.is_household_owner_fh(g.household_id)))
  with check (exists (select 1 from public.financial_goals_fh g
    where g.id = goal_contributions_fh.goal_id
      and public.is_household_member_fh(g.household_id)));
drop policy if exists goal_contributions_fh_delete on public.goal_contributions_fh;
create policy goal_contributions_fh_delete on public.goal_contributions_fh
  for delete to authenticated
  using (created_by = auth.uid()
    or exists (select 1 from public.financial_goals_fh g
      where g.id = goal_contributions_fh.goal_id
        and public.is_household_owner_fh(g.household_id)));

drop policy if exists financial_imports_fh_select on public.financial_imports_fh;
create policy financial_imports_fh_select on public.financial_imports_fh
  for select to authenticated
  using (public.is_household_member_fh(household_id));
drop policy if exists financial_imports_fh_insert on public.financial_imports_fh;
create policy financial_imports_fh_insert on public.financial_imports_fh
  for insert to authenticated
  with check (public.is_household_member_fh(household_id));
drop policy if exists financial_imports_fh_update on public.financial_imports_fh;
create policy financial_imports_fh_update on public.financial_imports_fh
  for update to authenticated
  using (created_by = auth.uid() or public.is_household_owner_fh(household_id))
  with check (public.is_household_member_fh(household_id));
drop policy if exists financial_imports_fh_delete on public.financial_imports_fh;
create policy financial_imports_fh_delete on public.financial_imports_fh
  for delete to authenticated
  using (created_by = auth.uid() or public.is_household_owner_fh(household_id));

drop policy if exists financial_import_rows_fh_select on public.financial_import_rows_fh;
create policy financial_import_rows_fh_select on public.financial_import_rows_fh
  for select to authenticated
  using (exists (select 1 from public.financial_imports_fh i
    where i.id = import_id and public.is_household_member_fh(i.household_id)));
drop policy if exists financial_import_rows_fh_insert on public.financial_import_rows_fh;
create policy financial_import_rows_fh_insert on public.financial_import_rows_fh
  for insert to authenticated
  with check (exists (select 1 from public.financial_imports_fh i
    where i.id = import_id and public.is_household_member_fh(i.household_id)));
drop policy if exists financial_import_rows_fh_update on public.financial_import_rows_fh;
create policy financial_import_rows_fh_update on public.financial_import_rows_fh
  for update to authenticated
  using (exists (select 1 from public.financial_imports_fh i
    where i.id = financial_import_rows_fh.import_id
      and (i.created_by = auth.uid() or public.is_household_owner_fh(i.household_id))))
  with check (exists (select 1 from public.financial_imports_fh i
    where i.id = financial_import_rows_fh.import_id
      and public.is_household_member_fh(i.household_id)));
drop policy if exists financial_import_rows_fh_delete on public.financial_import_rows_fh;
create policy financial_import_rows_fh_delete on public.financial_import_rows_fh
  for delete to authenticated
  using (exists (select 1 from public.financial_imports_fh i
    where i.id = financial_import_rows_fh.import_id
      and (i.created_by = auth.uid() or public.is_household_owner_fh(i.household_id))));

-- Cotacoes de referencia: leitura global + da casa; historico imutavel
-- (sem policies de update/delete: linhas nunca sao alteradas).
drop policy if exists exchange_rates_fh_select on public.exchange_rates_fh;
create policy exchange_rates_fh_select on public.exchange_rates_fh
  for select to authenticated
  using (household_id is null or public.is_household_member_fh(household_id));
drop policy if exists exchange_rates_fh_insert on public.exchange_rates_fh;
create policy exchange_rates_fh_insert on public.exchange_rates_fh
  for insert to authenticated
  with check (household_id is not null and public.is_household_member_fh(household_id));

-- Auditoria: membros leem; cada usuario registra os proprios atos.
drop policy if exists audit_logs_fh_select on public.audit_logs_fh;
create policy audit_logs_fh_select on public.audit_logs_fh
  for select to authenticated
  using (public.is_household_member_fh(household_id));
drop policy if exists audit_logs_fh_insert on public.audit_logs_fh;
create policy audit_logs_fh_insert on public.audit_logs_fh
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_household_member_fh(household_id));

commit