-- =====================================================================
-- TESTE DE ISOLAMENTO DO RLS — script único e idempotente
-- ---------------------------------------------------------------------
-- Pré-requisito: bloco FH-SQL-001 já executado (policies + funções).
-- Cria 3 usuários de teste (senha de todos: Teste123!), faz A criar a casa,
-- B entrar com o código e C ficar de fora — e mostra o que cada um enxerga.
-- Pode rodar quantas vezes quiser: a etapa 0 limpa a tentativa anterior.
--
-- COMO USAR: cole o arquivo INTEIRO no Supabase SQL Editor e clique em Run.
-- Não edite nada: não há placeholders, os UUIDs são resolvidos por e-mail.
-- =====================================================================

create extension if not exists pgcrypto;

-- 0) Limpeza da tentativa anterior (idempotência)
delete from auth.users
 where email in ('teste-a@financial.home', 'teste-b@financial.home', 'teste-c@financial.home');
delete from public.households_fh
 where name = 'Casa Teste Isolamento'
   and id not in (select household_id from public.household_members_fh);

-- 1) Cria os 3 usuários (o trigger gera os perfis sozinho)
-- NOTA: o `id` é gerado aqui porque esta versão do GoTrue não tem default.
insert into auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data
)
values
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'teste-a@financial.home',
    crypt('Teste123!', gen_salt('bf')), now(), '{"display_name":"Teste A"}'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'teste-b@financial.home',
    crypt('Teste123!', gen_salt('bf')), now(), '{"display_name":"Teste B"}'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'teste-c@financial.home',
    crypt('Teste123!', gen_salt('bf')), now(), '{"display_name":"Teste C"}')
-- Sem alvo no ON CONFLICT: vale para qualquer constraint (o e-mail pode ter
-- índice único parcial nesta versão do GoTrue). A etapa 0 já limpa antes.
on conflict do nothing;

-- Confirmação: esperado 3 linhas (se der 0, algo falhou na criação)
select email, id from auth.users
 where email like 'teste-%@financial.home'
 order by email;

-- 2) A cria a casa (personificando A)
begin;
select set_config('request.jwt.claims',
  json_build_object(
    'sub', (select id::text from auth.users where email = 'teste-a@financial.home'),
    'role', 'authenticated'
  )::text, true);
select public.create_household_fh('Casa Teste Isolamento');
-- Esperado abaixo: 1 linha com o código da casa
select id, name, join_code from public.households_fh;
commit;

-- 3) B entra com o código (personificando B).
-- Bloco DO único: lê o código e faz o join sem depender de temp table
-- (alguns editores isolam transações e a temp table some no caminho).
DO $$
DECLARE
  v_code text;
  v_b text;
BEGIN
  SELECT id::text INTO v_b FROM auth.users WHERE email = 'teste-b@financial.home';
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
  SELECT join_code INTO v_code FROM public.households_fh LIMIT 1;
  PERFORM public.join_household_by_code_fh(v_code);
END
$$;

-- 3b) Prova: B enxerga a casa (personificando B)
begin;
select set_config('request.jwt.claims',
  json_build_object(
    'sub', (select id::text from auth.users where email = 'teste-b@financial.home'),
    'role', 'authenticated'
  )::text, true);
-- Esperado abaixo: 1 linha (Casa Teste Isolamento)
select id, name from public.households_fh;
rollback;

-- 4) C (sem código) NÃO deve ver nada — é isto que prova o isolamento
begin;
select set_config('request.jwt.claims',
  json_build_object(
    'sub', (select id::text from auth.users where email = 'teste-c@financial.home'),
    'role', 'authenticated'
  )::text, true);
-- Esperado abaixo: 0 linhas
select * from public.households_fh;
rollback;

-- 5) Perfis criados automaticamente pelo trigger (esperado: 3 linhas,
--    A e B com household preenchido, C com household nulo)
select u.email, p.display_name, p.household_id
  from auth.users u
  join public.profiles_fh p on p.id = u.id
 where u.email like 'teste-%@financial.home'
 order by u.email;

-- =====================================================================
-- LIMPEZA (opcional, rode depois do teste para apagar o cenário):
-- delete from auth.users
--  where email in ('teste-a@financial.home', 'teste-b@financial.home', 'teste-c@financial.home');
-- delete from public.households_fh
--  where name = 'Casa Teste Isolamento'
--    and id not in (select household_id from public.household_members_fh);
-- =====================================================================
