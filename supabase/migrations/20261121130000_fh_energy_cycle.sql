-- FH-SQL-016: periodicidade da fatura de energia.
-- Duracao do ciclo de fatura em meses (1 = mensal, 2 = bimestral).
begin;

alter table public.energy_settings_fh
  add column if not exists cycle_months integer not null default 2;

alter table public.energy_settings_fh
  drop constraint if exists energy_settings_fh_cycle_months_check;

alter table public.energy_settings_fh
  add constraint energy_settings_fh_cycle_months_check
  check (cycle_months between 1 and 12);

commit;
