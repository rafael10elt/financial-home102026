-- FH-SQL-017: descricao opcional em lancamentos financeiros.
-- Permite salvar lancamentos sem descricao (texto vazio).
begin;

alter table public.financial_transactions_fh
  alter column description set default '';

alter table public.financial_transactions_fh
  drop constraint if exists financial_transactions_fh_description_check;

alter table public.financial_transactions_fh
  add constraint financial_transactions_fh_description_check
  check (char_length(btrim(description)) between 0 and 200);

commit;
