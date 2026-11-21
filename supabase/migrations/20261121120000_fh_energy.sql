-- FH-SQL-015: medidor de energia elétrica por casa.
-- Uma linha por casa com tarifa, leituras e histórico de consumo (kWh).
begin;

create table if not exists public.energy_settings_fh (
  household_id    uuid primary key references public.households_fh (id) on delete cascade,
  currency        text not null default 'EUR' check (char_length(currency) = 3),
  price_per_kwh   numeric(12,6) not null default 0 check (price_per_kwh >= 0),
  fixed_fee       numeric(12,2) not null default 0 check (fixed_fee >= 0),
  initial_reading numeric(12,3) not null default 0 check (initial_reading >= 0),
  current_reading numeric(12,3) not null default 0 check (current_reading >= 0),
  cycle_start     date not null default current_date,
  readings        jsonb not null default '[]'::jsonb
                  check (jsonb_typeof(readings) = 'array'),
  updated_at      timestamptz not null default now()
);

alter table public.energy_settings_fh enable row level security;
grant select, insert, update, delete on public.energy_settings_fh to anon, authenticated;

drop policy if exists energy_settings_fh_select on public.energy_settings_fh;
create policy energy_settings_fh_select on public.energy_settings_fh
  for select to anon, authenticated
  using (public.is_household_member_fh(household_id));

drop policy if exists energy_settings_fh_insert on public.energy_settings_fh;
create policy energy_settings_fh_insert on public.energy_settings_fh
  for insert to anon, authenticated
  with check (public.is_household_member_fh(household_id));

drop policy if exists energy_settings_fh_update on public.energy_settings_fh;
create policy energy_settings_fh_update on public.energy_settings_fh
  for update to anon, authenticated
  using (public.is_household_member_fh(household_id))
  with check (public.is_household_member_fh(household_id));

drop policy if exists energy_settings_fh_delete on public.energy_settings_fh;
create policy energy_settings_fh_delete on public.energy_settings_fh
  for delete to anon, authenticated
  using (public.is_household_member_fh(household_id));

drop trigger if exists t_energy_settings_fh_updated on public.energy_settings_fh;
create trigger t_energy_settings_fh_updated
  before update on public.energy_settings_fh
  for each row execute function public.set_updated_at_fh();

commit;
