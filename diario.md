# Diário de Desenvolvimento — Financial Home 102026

Arquivo cumulativo de histórico e decisões do projeto.

**Regras deste arquivo:**
- O histórico é cumulativo. Entradas antigas nunca são apagadas.
- Diferencie sempre: `implementado`, `testado`, `pendente`, `bloqueado`.
- Nunca registre testes como aprovados sem tê-los executado de fato.
- Nunca registre senhas, tokens, chaves de API ou outros segredos.
- Quando uma decisão anterior mudar, registre a decisão antiga, a nova decisão e o motivo.

---

## Rodada 000 — Fase 0: Inspeção e planejamento

**Data:** 2026-10-11
**Fase:** 0 — Inspeção e planejamento (somente leitura + arquivos de controle)
**Objetivo:** Inspecionar o estado real do repositório, registrar o achado, criar os arquivos de controle e apresentar o plano de arquitetura para aprovação. Nenhuma funcionalidade é implementada nesta rodada.

### Estado inicial relevante

Localização confirmada: `C:\Lumitechia\financial-home102026` (workspace raiz).

| Item | Estado real observado |
|---|---|
| Conteúdo da pasta | Vazio, exceto `.git/` |
| Git | Repositório inicializado, branch `main`, **nenhum commit ainda** |
| Remote | `origin` = `https://github.com/rafael10elt/financial-home102026.git` |
| Remote (refs) | `git ls-remote origin` retornou vazio → repositório remoto sem commits |
| Código existente | Nenhum |
| `package.json` / lockfile | Ausente |
| Migrations / SQL | Ausente |
| `.env` / `.env.example` | Ausente |
| Config de deploy (Netlify) | Ausente |
| `Financial_Home_102026_Mapa_da_Verdade.pdf` | **Não encontrado** (busca na raiz, pasta pai e glob `**/*.pdf`) |
| `diario.md` | Inexistente → criado nesta rodada |
| `banco.sql` | Inexistente → criado nesta rodada |
| Ferramentas do ambiente | Node `v24.18.0`, npm `11.6.2`, Python `3.14.0`, Windows (`win32`), PowerShell |
| Testes | Nenhum (não há código) |

### Divergência identificada

**Divergência D-001 — Especificação de referência ausente.**
O prompt mestre determina ler `Financial_Home_102026_Mapa_da_Verdade.pdf` como fonte da verdade funcional. O arquivo não existe no workspace nem no diretório pai.

- *Impacto:* os requisitos desta rodada vêm exclusivamente do prompt mestre. Se o PDF contiver regras divergentes (especialmente sobre finanças, recorrência e permissões), será necessário reconciliar.
- *Correção proposta (mais segura):* seguir o prompt mestre como especificação provisória, registrar a ausência aqui (feito) e solicitar o PDF ao usuário. Quando disponibilizado, comparar item a item e registrar divergências antes de implementar a fase afetada.
- *Estado:* aguardando o usuário.

### Arquivos criados nesta rodada

- `diario.md` — este arquivo.
- `banco.sql` — livro cumulativo de SQL (criado apenas com cabeçalho e convenções; **nenhum SQL de execução** foi preparado ainda, pois não há esquema existente a inspecionar).

Nenhum arquivo existente foi sobrescritos (não havia arquivos).

### Funcionalidades implementadas

Nenhuma. Conforme regra da Fase 0.

### Decisões técnicas (propostas, aguardando aprovação)

Registradas no plano apresentado ao usuário nesta rodada (ver seção "Plano" da conversa). Nenhuma decisão é vinculante antes da aprovação explícita.

### Alterações SQL

Nenhum bloco `FH-SQL-*` criado. Nada foi executado no Supabase.

### Testes executados e resultados reais

- Verificação de conteúdo da pasta: apenas `.git/` — **confirmado**.
- `git status` → `No commits yet` — **confirmado**.
- `git ls-remote origin` → vazio, exit code 0 — **confirmado**.
- Busca por PDF (`Test-Path`, `Get-ChildItem -Filter *.pdf`, glob) → nenhum resultado — **confirmado**.
- `node --version` / `npm --version` → v24.18.0 / 11.6.2 — **confirmado**.

Nenhum teste de aplicação foi executado porque não há aplicação.

### Pendências, riscos e limitações conhecidas

1. **Bloqueio:** PDF `Financial_Home_102026_Mapa_da_Verdade.pdf` ausente.
2. Sem credenciais Supabase, Groq, Netlify ou n8n definidas; `.env.example` será criado na Fase 1 com placeholders.
3. Sem definição de usuários reais (e-mails/credenciais de Jéssica e Rafael) — necessária na Fase 1 para testar RLS com perfis distintos.
4. Repositório sem commits iniciais; primeiro commit será feito apenas quando solicitado/autorizado.
5. Não foi possível verificar disponibilidade/termos de APIs externas (Open-Meteo, Groq) nesta rodada; fica para a Fase 2/5.

### Configurações externas pendentes

Todas. Nenhuma feita.

### Próximas ações recomendadas

1. Usuário fornece o PDF do Mapa da Verdade (ou confirma prosseguir só com o prompt mestre).
2. Usuário aprova (ou ajusta) a arquitetura, estrutura de pastas e ordem de fases apresentadas.
3. Iniciar Fase 1 — Fundação.

---

## Rodada 001 — Fase 0 (conclusão): leitura do Mapa da Verdade e aprovação do plano

**Data:** 2026-10-11
**Fase:** 0 — Inspeção e planejamento (encerramento)
**Objetivo:** Ler o PDF fornecido pelo usuário, comparar com o plano apresentado e registrar a aprovação.

### Estado inicial relevante

- Usuário adicionou `Financial_Home_102026.pdf` na raiz do projeto (8 páginas, ~21,9 mil caracteres extraídos).
- Leitura feita por extração de texto com `pypdf` (o renderizador não aceita PDF diretamente); extração em arquivo temporário fora do repositório.

### Divergência D-001 — RESOLVIDA

- *Antes:* PDF ausente; requisitos vindos só do prompt mestre.
- *Agora:* PDF lido integralmente (Mapa da Verdade, versão inicial de 11/10/2026).
- *Comparação prompt mestre × PDF:* **sem contradições funcionais**. O PDF confirma as mesmas fases, as mesmas regras financeiras inegociáveis, a convenção `_fh`, a autoridade do `diario.md`/`banco.sql`, e acrescenta detalhes úteis que passam a valer como requisito:
  - §7 inventário de tabelas sugeridas (households_fh, household_members_fh, profiles_fh, user_settings_fh, dashboard_layouts_fh, user_photos_fh, …);
  - §12 "decisões que o agente pode tomar sem nova consulta" (biblioteca de componentes, Edge Functions vs Netlify, provedor de clima/câmbio, busca global, notificações internas antes de push);
  - §13 fora do escopo inicial (integrações bancárias pagas, gerenciador de senhas próprio, escuta contínua de microfone, sync irrestrita, apps nativos, enviar todo o histórico à IA);
  - §8: a chave Groq compartilhada anteriormente deve ser tratada como **potencialmente exposta** → troca simples de chave é obrigatória;
  - preferência por usuários iniciais "Jéssica e Rafael" sem IDs fixos no frontend.

### Decisão

Plano de arquitetura, estrutura de pastas, estratégia de auth/RLS, estratégia da chave Groq, estratégia de relógios/clima e ordem de fases (0→7) apresentados na rodada 000 foram **aprovados pelo usuário** em 11/10/2026 ("pode ler e estará aprovado"). A Fase 1 é autorizada.

### Arquivos alterados nesta rodada

- `diario.md` — esta entrada.
- `banco.sql` — nenhuma mudança (nenhum SQL novo).

### Testes executados e resultados reais

- Extração do PDF: 8 páginas, 21897 caracteres — **ok**.
- Nenhum teste de aplicação (sem código ainda).

### Pendências herdadas

1. Sem credenciais Supabase/Groq/Netlify/n8n (`.env.example` será criado na Fase 1 com placeholders).
2. Sem usuários reais criados para testar RLS com dois perfis.
3. Repositório ainda sem commits (commit somente quando solicitado).

### Próximas ações recomendadas

Iniciar Fase 1 — Fundação: scaffold React/TS/Vite/Tailwind, design system, auth Supabase, casa/membros, migrations + RLS em `banco.sql`, PWA base, documentação de ambiente.

---

---

## Rodada 002 — Fase 1: Fundação

**Data:** 2026-10-11
**Fase:** 1 — Fundação (estrutura, design system, autenticação, casa/membros, configurações, RLS/migrations, PWA base, ambiente documentado)
**Objetivo:** montar o esqueleto da aplicação com autenticação Supabase real, entidade de casa com RLS, preferências por usuário, PWA instalável e documentação de ambiente — sem nenhum dado fictício.

### Estado inicial relevante

- Repositório só com `.git/` (sem commits), `diario.md`, `banco.sql` e o PDF do Mapa da Verdade.
- Sem Supabase configurado (`.env` inexistente) e sem SQL executado.

### Arquivos criados nesta rodada

**Raiz / configuração:** `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`, `eslint.config.js`, `index.html`, `.gitignore`, `.env.example`, `netlify.toml`, `README.md`.

**Fonte (`src/`):**
- `main.tsx`, `vite-env.d.ts`, `styles/index.css`
- `app/` — `App.tsx` (rotas + guardas + tela de "não configurado"), `AppShell.tsx` (layout/navegação), `App.test.tsx`
- `auth/` — `context.ts`, `AuthProvider.tsx`
- `household/` — `context.ts`, `service.ts`, `HouseholdProvider.tsx`
- `preferences/` — `store.ts` (zustand + persist), `sync.ts`, `PreferencesHydrator.tsx`, `store.test.ts`
- `i18n/` — `pt-BR.ts`, `en.ts`, `translate.ts`, `context.ts`, `I18nProvider.tsx`, `index.ts`, `i18n.test.ts`
- `config/` — `env.ts`, `env.test.ts`
- `supabase/` — `client.ts`
- `lib/` — `cn.ts`, `clocks.ts` (relógios Brasília/Dublin), `clocks.test.ts`
- `ui/` — `Button.tsx`, `Input.tsx` (+`Field`), `Card.tsx`, `ConnectionStatus.tsx`, `PhasePlaceholder.tsx`
- `features/` — `auth/LoginPage.tsx`, `household/OnboardingPage.tsx`, `overview/OverviewPage.tsx`, `settings/SettingsPage.tsx`
- `test/setup.ts`

**PWA:** `public/manifest.webmanifest`, `public/sw.js`, `public/icons/icon.svg` + PNGs gerados por `scripts/gen-icons.mjs`.

**Banco:** `supabase/migrations/20261011120000_fh_foundation.sql` (espelho de `banco.sql` FH-SQL-001).

Nenhum arquivo existente foi sobrescrito.

### Funcionalidades implementadas

1. **Design system** — tokens de cor por variáveis CSS com tema claro/escuro (resolução de `system` antes do paint, script anti-flash em `index.html`), 4 tamanhos de fonte, componentes acessíveis (foco visível, `aria-*`, labels associadas).
2. **i18n** — pt-BR e en com dicionários tipados, interpolação e troca instantânea por usuário.
3. **Autenticação Supabase** — login, cadastro (com mapeamento de erros em pt), sessão persistente, logout que limpa `sessionStorage`, caches `fh.*` locais (preservando preferências) e avisa o service worker (`fh:clear-private`).
4. **Estado "não configurado"** — sem `.env` válido a app mostra a tela real de configuração (não simula dados). Teste automatizado garante que nenhum valor monetário fictício aparece.
5. **Casa e membros** — onboarding "criar casa" / "entrar com código", listagem de membros com papel (owner/member), código de convite visível ao owner com botão copiar.
6. **Preferências por usuário** — tema/fonte/idioma persistidos localmente (zustand persist), sincronizados para `user_settings_fh` quando autenticado, com estados pendente/sincronizando/erro e hidratação da nuvem.
7. **Relógios** — `src/lib/clocks.ts` formata Brasília/Dublin com fusos IANA via `Intl` (sem offset fixo); tests cobrem DST.
8. **PWA base** — manifest, ícones 192/512/maskable gerados localmente (sem dependências externas), service worker com cache apenas do shell (nunca intercepta `/rest/v1/` ou `/auth/v1/`).
9. **Documentação** — `README.md` com instalação, variáveis de ambiente, scripts, SQL manual e deploy; `.env.example` apenas com placeholders.

### Decisões técnicas e justificativas

- **Tailwind CSS v4 + `@tailwindcss/vite`** em vez de v3: sem `tailwind.config.js`, tokens declarados no CSS (Mapa §12 deixa a escolha livre).
- **Sem shadcn/Radix nesta fase**: componentes próprios e pequenos evitam dependência pesada antes de existir UI real; troca é barata se necessário.
- **Funções `SECURITY DEFINER` para criar/entrar na casa**: evitam recursão de RLS em `household_members_fh` e impedem escrita direta em membros (não há policy de INSERT nessa tabela).
- **`gen_random_bytes(6)` para o join code** (12 hex em caixa alta) → requer `pgcrypto`, incluído no FH-SQL-001.
- **Service worker minimalista**: só shell + fallback offline; fila de sincronização real fica na Fase 6.
- **Chunk único de ~535 kB**: `@supabase/supabase-js` puxa o peso; code splitting fica para Fase 6 (desempenho). Avisado pelo build, não é erro.

### Alterações SQL relacionadas

- **FH-SQL-001** preparado em `banco.sql` (espelhado em `supabase/migrations/20261011120000_fh_foundation.sql`): tabelas `households_fh`, `household_members_fh`, `profiles_fh`, `user_settings_fh`; funções `set_updated_at_fh`, `current_household_id_fh`, `is_household_member_fh`, `handle_new_user_fh`, `create_household_fh`, `join_household_by_code_fh`; trigger em `auth.users`; 8 policies RLS; consultas de validação; rollback documentado.
- **Estado: [preparado]. NÃO executado no Supabase** (nenhuma autorização de execução foi dada).

### Testes executados e resultados reais

| Comando | Resultado |
|---|---|
| `npm run lint` | **0 erros, 0 avisos** |
| `npm run typecheck` | **ok** (após corrigir `baseUrl` deprecado no TS 6 e 2 erros de tipo no store) |
| `npm test` | **13 testes em 5 arquivos — todos passaram** (relógios/DST, i18n cobertura+interpolação, merge de preferências, env, render "não configurado") |
| `npm run build` | **ok** — `dist/index.html` 1,79 kB; CSS 14,07 kB; JS 534,67 kB (gzip 156,18 kB) com aviso de chunk >500 kB |
| Smoke `vite preview` | `/` 200, `/manifest.webmanifest` 200, `/sw.js` 200 |
| Verificação de bundle | string de "Supabase não configurado" presente; `.env` **não existe** (nenhum segredo versionado) |

Correções feitas durante a rodada: imports relativos em `src/ui` e `src/app`; `baseUrl` deprecado; `set-state-in-effect` (ESLint) refatorado em `HouseholdProvider`/`SettingsPage` (defer via `queueMicrotask` + estado derivado); `matchMedia` ausente no jsdom (polyfill no setup); teste de placeholders refatorado para cobrir chaves com parâmetros.

### Pendências, riscos e limitações conhecidas

1. **Bloqueado pelo usuário:** executar `FH-SQL-001` no Supabase e criar `.env` com URL/anon key. Sem isso a app mostra "não configurado".
2. **RLS não validada na prática**: policies escritas mas sem execução/consulta de validação. Depois de rodar o SQL, é obrigatório o teste manual com 3 usuários descrito no bloco.
3. Ainda não há testes de RLS automatizados (exigem banco real ou mocks de API).
4. E-mail de confirmação do Supabase: se ativado, o cadastro informa "confirme o e-mail" (comportamento correto, mas depende da configuração do projeto).
5. Bundle acima de 500 kB (ver acima).
6. Sem CI/CD e sem commit (commit só quando solicitado).

### Configurações externas pendentes

- Supabase: criar projeto, rodar FH-SQL-001, preencher `.env`, definir senhas/ confirmação de e-mail.
- Netlify/GitHub/n8n/Groq: não iniciados (Fases 5/7).

### Próximas ações recomendadas

1. **Usuário:** criar projeto Supabase → executar `FH-SQL-001` → criar `.env` → `npm run dev` → validar login + criar casa + entrar com código em um segundo navegador/perfil.
2. **Agente (após confirmação):** Fase 2 — Overview com relógios (já com base testada), clima de Dublin, eventos/tarefas/lembretes e notificações internas.

---

## Rodada 003 — Correção do FH-SQL-001 (erro 42601 no Supabase)

**Data:** 2026-10-14
**Fase:** 1 — Fundação (correção de migração, sem código de app alterado)
**Objetivo:** corrigir o erro de sintaxe reportado pelo usuário ao executar o FH-SQL-001 no Supabase SQL Editor.

### Estado inicial relevante

- Usuário colou o bloco FH-SQL-001 no Supabase SQL Editor e recebeu:
  `ERROR: 42601: syntax error at or near "public"` — `LINE 166: create or replace public.set_updated_at_fh()`.

### Diagnóstico (causa raiz confirmada)

1. **Erro real:** faltava a palavra-chave `FUNCTION` nas 6 criações de função
   (`create or replace public.x()` em vez de `create or replace function public.x()`).
   O parser do Postgres para exatamente em `public`, como mostra o erro. Falha minha na redação do bloco.
2. **Problema secundário:** o bloco continha 96 caracteres corrompidos U+FFFD nos comentários
   (visíveis no print como `Fun��es`), gerados na minha cadeia de escrita do arquivo.
   Eram apenas comentários (não causam erro de sintaxe), mas foram eliminados por higiene
   e para não gerar dúvida na revisão.

### Decisão

Correção feita **no próprio FH-SQL-001** (não em bloco de compensação), com justificativa explícita:
o bloco **nunca foi aplicado** — o erro abortou a transação (`begin;` sem `commit` alcançado),
logo nada foi criado no banco e não há histórico aplicado a preservar.
A reexecução integral é idempotente e segura
(`IF NOT EXISTS` / `OR REPLACE` / `DROP ... IF EXISTS` em todos os objetos).

### Arquivos alterados

- `banco.sql` — bloco FH-SQL-001 reescrito: `FUNCTION` adicionado nas 6 funções,
  comentários normalizados para ASCII puro, nota de revisão registrada no cabeçalho do bloco.
  Estado: [preparado] — ainda não executado com sucesso no Supabase.
- `supabase/migrations/20261011120000_fh_foundation.sql` — espelho regenerado a partir do
  `banco.sql` (ASCII puro, sem U+FFFD, 6 pares de `$$` balanceados — verificado).
- Nenhum arquivo de código da aplicação foi alterado.

### Testes executados e resultados reais

- Verificação por script: 0 ocorrências de U+FFFD em `banco.sql`; 6/6 criações de função
  com a palavra-chave `FUNCTION`; espelho sem caracteres não-ASCII — **ok**.
- Revisão manual das demais construções do bloco (defaults com `auth.uid()`, FK para
  `auth.users`, trigger em `auth.users`, policies com `to authenticated`, `revoke`/`grant`,
  `EXECUTE FUNCTION` nos triggers): nenhuma outra sintaxe inválida identificada.
- **Não foi possível executar o SQL aqui** (sem acesso ao projeto Supabase do usuário).
  A validação real depende da execução pelo usuário + consultas de validação do bloco.

### Pendências

1. **Usuário:** colar o bloco FH-SQL-001 corrigido no Supabase SQL Editor e executar
   (pode simplesmente reexecutar o bloco inteiro; é idempotente).
   Depois rodar as 4 consultas de validação que estão no final do bloco.
2. Se `create extension pgcrypto` falhar por permissão (improvável no Supabase, onde a
   extensão já vem instalada), me avise com a mensagem exata.

### Próximas ações recomendadas

Após execução bem-sucedida: marcar FH-SQL-001 como [executado-pelo-usuário], criar `.env`,
validar login + casa com 2 perfis, e então autorizar a Fase 2.

---

## Rodada 004 — FH-SQL-001 executado pelo usuário (validação 3 confirmada)

**Data:** 2026-10-14
**Fase:** 1 — Fundação (validação de banco, sem código alterado)
**Objetivo:** confirmar o resultado da execução do bloco corrigido no Supabase.

### Evidência recebida

Print do SQL Editor mostrando a consulta de validação nº 3
(`select tablename, policyname from pg_policies ...`) com **8 rows**:

| tablename | policyname |
|---|---|
| household_members_fh | household_members_fh_select |
| households_fh | households_fh_delete |
| households_fh | households_fh_select |
| households_fh | households_fh_update |
| profiles_fh | profiles_fh_insert |
| profiles_fh | profiles_fh_select |
| profiles_fh | profiles_fh_update |
| user_settings_fh | user_settings_fh_all |

**Resultado: exatamente o esperado** (8 policies: 3 households, 1 members, 3 profiles, 1 settings).
Isso prova que o bloco executou até o `commit` sem erro — tabelas, funções, triggers e RLS criados.

### Arquivos alterados

- `banco.sql` — índice e linha de estado do FH-SQL-001 atualizados para
  `[executado-pelo-usuario em 2026-10-14]` (apenas anotação de estado; conteúdo SQL intacto).

### Pendências

1. Validações nº 1, 2 e 4 do bloco ainda não confirmadas (tabelas, flag RLS e teste manual
   com 2 usuários + 1 usuário sem código).
2. `.env` ainda não criado; login na app ainda não testado.

### Próximas ações recomendadas

1. **Usuário:** rodar as validações nº 1, 2 e 4 → criar `.env` → `npm run dev` →
   testar login + criar casa + entrar com código em 2 perfis.
2. **Agente (após confirmação):** Fase 2.

---

## Rodada 005 — Fase 2: Overview e agenda

**Data:** 2026-10-14
**Fase:** 2 — Overview e agenda
**Objetivo:** painel com relógios, clima de Dublin, atalhos e widgets reordenáveis;
eventos/tarefas/lembretes como entidades distintas com recorrência controlada;
calendário com filtros; centro de notificações internas.

### Estado inicial relevante

- Usuário autorizou avançar ("Prossiga com o desenvolvimento do projeto").
- Repo com 2 commits no ar, working tree limpo; `.env` ainda inexistente
  (integração Supabase segue não exercitável localmente).
- FH-SQL-001 executado pelo usuário (só validação 3 confirmada).

### Arquivos criados

- `src/agenda/recurrence.ts` + `recurrence.test.ts` — expansão pura de recorrências.
- `src/weather/client.ts` + `client.test.ts` — Open-Meteo com cache e estados.
- `src/agenda/dueNotifications.ts` + `dueNotifications.test.ts` — gerador idempotente.
- `src/data/agenda.ts` — schemas zod + helpers de escrita.
- `src/agenda/useAgenda.ts` — hook de dados (categorias, eventos, tarefas,
  lembretes, regras, exceções, notificações).
- `src/hooks/useNow.ts`, `src/ui/Modal.tsx`, `src/ui/ClocksWidget.tsx`,
  `src/ui/WeatherWidget.tsx`.
- `src/features/agenda/AgendaPage.tsx`, `ItemDialog.tsx`, `CalendarView.tsx`.
- `src/features/notifications/NotificationsPage.tsx`.
- `src/features/overview/OverviewPage.tsx` — reescrito com registro de widgets.
- `supabase/migrations/20261014120000_fh_agenda.sql` — espelho do FH-SQL-002.
- Dependência nova: `zod`.

### Arquivos alterados

- `src/i18n/pt-BR.ts`, `en.ts` — ~90 chaves novas (cobertura verificada por teste).
- `src/app/App.tsx` — rotas reais `/agenda` e `/notificacoes`.
- `src/app/AppShell.tsx` — sino de notificações com contagem de não lidas.
- `src/weather/client.ts` — `loadCachedWeather()` sem parâmetro; `mapWmoCode`
  rejeita códigos fora de 0–99 (correção vinda de teste que falhou de propósito).
- `banco.sql` — bloco FH-SQL-002 (estado [preparado]).

### Funcionalidades implementadas

1. **Relógios** Brasília/Dublin ao vivo (fuso IANA, sem API).
2. **Clima de Dublin**: atual + sensação + umidade + vento + chuva, horárias de
   hoje, 5 dias, timestamp de atualização, refresh manual, cache 30 min,
   estados fresco/desatualizado/indisponível, atribuição Open-Meteo CC-BY 4.0.
   Termos verificados em 2026-10-14: uso privado sem chave é permitido
   (limites 10k/dia, 5k/hora, 600/min).
3. **Eventos/tarefas/lembretes**: CRUD com categoria, visibilidade,
   responsável, prioridade (tarefas), dia inteiro (eventos); recorrência
   diária/semanal/mensal/anual com intervalo, dias da semana, término por data
   ou quantidade; pular/adiar ocorrência sem tocar na série; concluir/reabrir
   tarefas; dispensar lembretes; exclusão com confirmação.
4. **Calendário** mensal (semana começa segunda) com marcas de dias com itens
   e detalhe do dia selecionado; filtros por pessoa, categoria e visibilidade.
5. **Notificações internas**: sino com contagem, lista, ler individual/todas,
   gerador de vencidos/próximos idempotente (dedupe_key, no máximo 1 vez/6h),
   preferências (ativo, antecedência em horas, resumo diário) persistidas na
   conta. Push do navegador fica para a Fase 6 (avisado na tela).
6. **Overview**: widgets relógios, clima, ações rápidas (?novo=tarefa|evento|
   lembrete), agenda de hoje, tarefas abertas + placeholders honestos das
   Fases 3/4; ordem persistida na conta (`dashboard_layouts_fh`) e local;
   reordenação por botões acessíveis.

### Decisões técnicas e justificativas

- `categories_fh` compartilhada por domínio (coluna `domain`) em vez de uma
  tabela por domínio: evita duplicação agenda/finanças/diário (governança §14
  do Mapa: decisão registrada aqui).
- `recurrence_exceptions_fh` genérica em vez de `task_occurrences_fh` do
  inventário: pular/adiar é idêntico nos 3 tipos; recorrências financeiras
  ficam separadas na Fase 3 (idempotência por período + estados financeiros).
- Expansão de recorrência em datas civis (meio-dia UTC), nunca em instantes:
  imune a DST; teste atravessa a virada de 29/03/2026 sem deslocar dias.
- Categorias-padrão garantidas pelo app (upsert idempotente) em vez de seeds
  com acento no SQL: zero risco de codificação no editor web.
- Horários da agenda exibidos no fuso do dispositivo (documentado; por-evento
  fica para refinamento futuro). Exceção: clima e relógios usam fusos fixos.
- Regras novas do react-hooks v7 (`set-state-in-effect`, `purity`) exigiram
  deferir setStates para microtasks/callbacks e derivar o diálogo de ação
  rápida do parâmetro de rota durante a renderização.
- Bundle 681 kB (zod somou): code-splitting fica para a Fase 6.

### Alterações SQL relacionadas

- **FH-SQL-002** em `banco.sql` (9 tabelas, 1 função `is_household_owner_fh`,
  30 policies novas, triggers, validações 1–5, rollback).
  **Estado: [preparado] — NÃO executado no Supabase.**
- Espelho em `supabase/migrations/20261014120000_fh_agenda.sql` (verificado:
  ASCII+UTF-8 válido, sem U+FFFD, `$$` balanceados).

### Testes executados e resultados reais

| Comando | Resultado |
|---|---|
| `npm run lint` | **0 erros, 0 avisos** |
| `npm run typecheck` | **ok** |
| `npm test` | **38 testes / 8 arquivos — todos passaram** (10 novos: recorrência, clima, avisos) |
| `npm run build` | **ok** — JS 681,45 kB (gzip 196,77 kB), aviso de chunk >500 kB |
| Smoke `vite preview` | `/` 200 |
| Integridade de codificação | 0 U+FFFD em `src/`, `banco.sql`, `diario.md` (2 U+FFFD intencionais na rodada 003, documentando o print do usuário) |

Correções durante a rodada: `mapWmoCode(999)` (função aceitava, teste exigiu
`unknown` — corrigida a função, não o teste); caminhos relativos errados em
5 arquivos; `CategoryInput` como `z.input`; 7 erros de lint de efeitos;
dupla codificação UTF-8 em 3 arquivos causada por roundtrip via bash —
reparada por reversão byte a byte e verificada por codepoint
(**lição: nunca usar bash para conteúdo de arquivo com não-ASCII**).

### Pendências, riscos e limitações

1. **Bloqueado pelo usuário:** executar FH-SQL-002; criar `.env`; testar login,
   casa, agenda e notificações com 2 perfis (RLS da Fase 2 não validada).
2. Sem `.env`, telas de agenda/notificações mostram erro real de "não
   configurado" após login? Não — sem `.env` o app nem chega ao login (tela de
   configuração). Correto e honesto.
3. Push do navegador, resumo diário por worker e som: Fase 6.
4. Dicas/anúncios/fofocas: Fase 4. Finanças no Overview: Fase 3.

### Próximas ações recomendadas

1. **Usuário:** executar FH-SQL-002 → validações 1–4 do bloco → `.env` →
   `npm run dev` → testar agenda/notificações com 2 perfis.
2. **Agente (após confirmação):** Fase 3 — Finanças.

---

## Rodada 006 — Fase 3: Finanças domésticas

**Data:** 2026-10-14
**Fase:** 3 — Finanças
**Objetivo:** contas, lançamentos com estados, recorrências que nascem pendentes
e idempotentes, transferências fora do consolidado, metas virtuais, câmbio com
taxa efetiva × cotação de referência, importação CSV/PDF revisável e auditoria.

### Estado inicial relevante

- Usuário pediu para prosseguir ("Prossiga para a proxima etapa") ainda sem
  `.env` e sem executar o FH-SQL-002 — mesma estratégia honesta da Fase 2:
  lógica pura testada, integração exibindo estados reais.

### Arquivos criados

- `src/finance/money.ts` + teste — centavos inteiros, zero float.
- `src/finance/exchange.ts` + teste — taxa efetiva × referência com proveniência.
- `src/finance/reports.ts` + teste — consolidação, agrupamentos, saldo de conta.
- `src/finance/frecurrence.ts` + teste — `period_key` por frequência.
- `src/finance/csv.ts` + teste — parse, sniff, mapeamento, duplicatas.
- `src/finance/pdf.ts` + teste — pdfjs dinâmico + heurística de linhas.
- `src/finance/useFinance.ts` — hook de dados + geração idempotente + auditoria.
- `src/features/finance/FinancePage.tsx` — 7 abas (resumo, lançamentos,
  recorrências, transferências, metas, câmbio, importação).
- `src/features/finance/FinanceDialogs.tsx`, `financeForm.ts` (+ teste),
  `ImportWizard.tsx`.
- `supabase/migrations/20261014130000_fh_finance.sql` — espelho do FH-SQL-003.
- Dependências novas: `zod` (validação), `pdfjs-dist` (só via import dinâmico).

### Arquivos alterados

- `src/i18n/pt-BR.ts`, `en.ts` — ~100 chaves `fin.*` (paridade coberta por teste).
- `src/app/App.tsx` — rota real `/financas`.
- `src/features/overview/OverviewPage.tsx` — widget de resumo financeiro real
  (mês atual em EUR, flag de estimativa) no lugar do placeholder da Fase 3.
- `banco.sql` — bloco FH-SQL-003 (estado [preparado]).

### Funcionalidades implementadas

1. **Contas** individuais/compartilhadas com saldo inicial; saldo = abertura +
   confirmados ± transferências (pendentes separados).
2. **Lançamentos** com categoria, pessoa, conta, data e estados
   previsto/pendente/pago/recebido/cancelado; "vencido" derivado na UI;
   confirmação com `paid_at` + auditoria; exclusão com confirmação + auditoria.
3. **Recorrências** que geram SOMENTE pendentes até o fim do próximo mês;
   unicidade `(recurrence_id, period_key)` torna retry seguro; pausar/retomar.
4. **Transferências** em tabela própria (fora do consolidado), com conversão
   e taxa opcional entre moedas distintas.
5. **Metas virtuais** com barra de progresso e contribuições (não tocam contas).
6. **Câmbio**: operações reais com taxa efetiva calculada; cotações de
   referência manuais com fonte; conversões marcadas como estimativa;
   histórico de cotações imutável (sem update/delete no banco).
7. **Importação**: CSV (separador autodetectado, formato de data, mapeamento
   de colunas, prévia editável, detecção de duplicatas como sugestão,
   confirmação explícita, linhas viram pendentes ligadas por `import_row_id`
   único) + PDF (texto embutido via pdfjs dinâmico; escaneado/OCR avisado como
   Fase 5, nunca silencioso).
8. **Relatórios**: consolidado em EUR, por categoria/pessoa/conta, previsto ×
   realizado, falha alta quando falta cotação (nunca inventa conversão).

### Decisões técnicas e justificativas

- Parcelamento como colunas (`installment_group/number/total`) em vez de
  tabela dedicada: atributo do lançamento gerado; documentado aqui.
- Categorias financeiras reutilizam `categories_fh` (`domain='finance'`,
  `kind` income/expense); padrões incluem "Job 1 — Jess/Rafa" (Mapa §3.2).
- `status` em português no banco (`previsto/pendente/pago/recebido/cancelado`)
  conforme o glossário do Mapa (§1.1: pendente = não confirmado).
- Pagamentos parciais: NÃO implementados nesta fase (Mapa permite
  "se implementados"); registrado como evolução futura.
- pdfjs via `import()` dinâmico: primeiro code-splitting real do projeto;
  worker via CDN com fallback de erro honesto.
- `Quote` reexportado de `reports.ts` para os widgets.
- Regra `error-boundaries` do ESLint exigiu separar cálculo puro do JSX no
  widget de resumo (função `computeSummary` fora do try/catch de render).

### Alterações SQL relacionadas

- **FH-SQL-003** (11 tabelas, 0 funções novas, 40 policies, triggers,
  validações 1–5, rollback). **Estado: [preparado] — NÃO executado.**
- Validação 4 confere os índices de idempotência, incluindo o nome automático
  `financial_transactions_fh_import_row_id_key` da constraint `unique`.

### Testes executados e resultados reais

| Comando | Resultado |
|---|---|
| `npm run lint` | **0 erros, 0 avisos** |
| `npm run typecheck` | **ok** |
| `npm test` | **73 testes / 15 arquivos — todos passaram** (35 novos) |
| `npm run build` | **ok** — aviso de chunk >500 kB (code-splitting total na Fase 6) |
| Smoke `vite preview` | `/` 200 |
| Codificação | 0 U+FFFD em `src/` |

Correções durante a rodada: contagem de policies no bloco (42→40, total 78);
`mapWmoCode` não — (Fase 2); `Quote` não exportado; `parseDate` com
`no-useless-assignment`; JSX em try/catch; `fast-refresh` (novo
`financeForm.ts`); `;[, a, b]` substituído por parser por ramos.

### Pendências, riscos e limitações

1. **Bloqueado pelo usuário:** executar FH-SQL-002 e FH-SQL-003; criar `.env`;
   testar finanças com 2 perfis (RLS da Fase 3 não validada na prática).
2. Worker do pdfjs via CDN: em produção offline-first o ideal é empacotar o
   worker local (Fase 6, junto do SW de produção).
3. Sem provedor automático de cotação (adaptador manual por ora); Fase 5 pode
   plugar API gratuita via backend.
4. Pagamentos parciais e anexos de comprovante: futuro (anexos na Fase 4 com
   Storage).

### Próximas ações recomendadas

1. **Usuário:** executar FH-SQL-002 + FH-SQL-003 → validações → `.env` →
   `npm run dev` → testar com 2 perfis.
2. **Agente (após confirmação):** Fase 4 — Diário doméstico.

---

## Rodada 007 — Fase 4: Diário doméstico

**Data:** 2026-10-14
**Fase:** 4 — Diário doméstico
**Objetivo:** feed privado e arquivo pesquisável de memórias, 5 espaços de
fotos por usuário, humores, dicas, anúncios com leitura e fofocas, com
Storage privado e URLs assinadas.

### Estado inicial relevante

- Usuário pediu para prosseguir ("Prossiga") ainda sem `.env` e sem executar
  FH-SQL-002/003 — mesma estratégia honesta: lógica pura testada, integração
  com estados reais.

### Arquivos criados

- `src/diary/feed.ts` + teste — busca, tags, validação de upload, caminhos.
- `src/diary/useDiary.ts` — hook (posts, mídia, slots, humores, dicas,
  anúncios, fofocas, URLs assinadas com cache).
- `src/features/diary/DiaryPage.tsx` — 7 abas.
- `src/features/diary/DiaryDialogs.tsx` — post/dica/anúncio/fofoca/humor.
- `supabase/migrations/20261014140000_fh_diary.sql` — espelho do FH-SQL-004.

### Arquivos alterados

- `src/i18n/pt-BR.ts`, `en.ts` — chaves `diary.*` (paridade coberta por teste).
- `src/app/App.tsx` — rota real `/diario`.
- `src/features/overview/OverviewPage.tsx` — widget `mood` (humor de hoje);
  layouts antigos ganham o widget ao final (sanitização preserva a ordem).
- `banco.sql` — bloco FH-SQL-004 (estado [preparado]).

### Funcionalidades implementadas

1. **Publicações** com título, texto, data da memória, tags normalizadas,
   visibilidade pessoal no banco; fotos por upload (JPG/PNG/WebP/GIF ≤5 MB)
   com registros em `post_media_fh`.
2. **Memórias**: busca sem acento (título+corpo) + filtros de tags (todas),
   período; ordenação recentes-primeiro; índice GIN em tags.
3. **Fotos**: 5 slots por usuário; substituir troca o caminho sem apagar o
   arquivo antigo (posts que o usam sobrevivem); fotos do parceiro visíveis
   na casa.
4. **Humor**: catálogo compartilhado (padrões via upsert, com emoji) +
   1 registro/dia por usuário (regravar substitui o do dia) com nota opcional;
   histórico e widget no Overview.
5. **Dicas** com visibilidade; **anúncios** com fixar/expiração/lidos por
   usuário (`announcement_reads_fh` — tabela além do inventário, exigida pelo
   "estado de leitura"); **fofocas** com aviso leve de escopo.
6. **Storage**: bucket privado `media_fh`; pastas `posts/<casa>/` e
   `slots/<casa>/`; policies por pasta; app gera URLs assinadas de 1h com
   cache; tipos validados antes do upload.
7. Aviso honesto de que comentários/reações/favoritos vêm depois do núcleo.

### Decisões técnicas e justificativas

- `announcement_reads_fh` além do inventário do Mapa: "estado de leitura"
  exige a tabela; registrado aqui (§14 do Mapa).
- Comentários/reações/favoritos ADIADOS conforme o próprio Mapa (§3.5:
  "depois do núcleo") — não é corte, é a ordem especificada.
- Humores individuais visíveis na casa (o Overview exige "humor atual");
  privacidade pessoal continua valendo para posts/dicas via visibility.
- `user_photos_fh_select` usa join de perfis da mesma casa (sem IDs fixos).
- Cast `(...)[2]::uuid` nas policies de Storage: caminho fora do padrão nega
  acesso (nulo não é membro de casa alguma).

### Alterações SQL relacionadas

- **FH-SQL-004** (9 tabelas + bucket + 3 policies de Storage, 35 policies em
  public, triggers, validações 1–5, rollback).
  **Estado: [preparado] — NÃO executado.**

### Testes executados e resultados reais

| Comando | Resultado |
|---|---|
| `npm run lint` | **0 erros, 0 avisos** |
| `npm run typecheck` | **ok** |
| `npm test` | **81 testes / 16 arquivos — todos passaram** (8 novos) |
| `npm run build` | **ok** |
| Smoke `vite preview` | `/` 200 |
| Codificação | 0 U+FFFD em `src/` |

Correções durante a rodada: contagem de policies (31→35, total 113); join
`moods_fh!inner` tipado como array; `useCallback` com IIFE (cache movido para
o módulo); `Date.now` em render (estado inicial); `exhaustive-deps` do sino.

### Pendências, riscos e limitações

1. **Bloqueado pelo usuário:** executar FH-SQL-002/003/004; criar `.env`;
   criar bucket ocorre via SQL (incluído); testar diário com 2 perfis
   (RLS + Storage não validados na prática).
2. Comentários/reações/favoritos: após o núcleo (teste de aceite futuro).
3. Limpeza de arquivos órfãos no bucket: futura, nunca automática em massa.

### Próximas ações recomendadas

1. **Usuário:** executar FH-SQL-002 + FH-SQL-003 + FH-SQL-004 → validações →
   `.env` → `npm run dev` → testar com 2 perfis.
2. **Agente (após confirmação):** Fase 5 — IA (Groq) e n8n.

---

## Rodada 008 — Fase 5: IA com Groq e n8n

**Data:** 2026-10-14
**Fase:** 5 — IA e n8n
**Objetivo:** assistente server-side com tools autorizadas e confirmação em
ações sensíveis, chave Groq configurável sem exposição, memória seletiva,
voz e gancho real para o n8n.

### Estado inicial relevante

- Usuário pediu para prosseguir ("Prossiga") ainda sem `.env`, sem SQL
  executado e sem CLI Supabase/Deno neste ambiente (verificado: ausentes).
  Edge Functions ficam como código + deploy documentado, não executadas aqui.

### Arquivos criados

- `supabase/functions/_shared/crypto.ts` (AES-256-GCM) e `auth.ts` (JWT→RLS).
- `supabase/functions/groq-config/index.ts` — status/set/test/remove da chave.
- `supabase/functions/groq-chat/index.ts` — loop de tools + confirmações.
- `src/assistant/tools.ts` (+ teste), `digest.ts` (+ teste), `useAssistant.ts`,
  `useVoice.ts`.
- `src/features/assistant/AssistantPage.tsx` — abas Conversa/Memória/Automações.
- `src/features/settings/GroqKeySection.tsx` — chave mascarada, teste, remoção.
- `supabase/migrations/20261014150000_fh_ai.sql` — espelho do FH-SQL-005.

### Arquivos alterados

- `src/i18n/pt-BR.ts`, `en.ts` — chaves `ai.*`.
- `src/app/App.tsx` + `AppShell.tsx` — rota `/assistente` e navegação.
- `src/features/settings/SettingsPage.tsx` — seção da chave Groq.
- `README.md` — deploy das Edge Functions, segredos, troca de chave, n8n.
- `eslint.config.js` — `supabase/functions` ignorado (código Deno).
- `banco.sql` — bloco FH-SQL-005 (estado [preparado]).

### Funcionalidades implementadas

1. **Chat real via backend**: histórico pessoal no banco; sem chave ou sem
   função implantada, estados honestos (sem simulação de resposta).
2. **13 tools allow-list**, executadas com o JWT do usuário (RLS = usuário):
   leitura de agenda/finanças/metas/humor; criação rotineira direta
   (lançamento financeiro nasce PENDENTE); update/delete financeiro retornam
   `needs_confirmation` com prévia em cartão.
3. **Confirmação**: proposta gravada em `ai_action_logs_fh` (proposed) →
   usuário confirma na UI → backend revalida e executa (executed/error).
   Nada destrutivo executa sem esse ciclo.
4. **Chave Groq**: campo de senha, validada contra a API antes de salvar,
   AES-256-GCM em `ai_config_fh` (tabela sem acesso direto: 0 policies),
   `key_last4` + modelo visíveis, teste de conexão com erros mapeados
   (inválida/cota/modelo/indisponível), remoção e troca sem código.
   Somente o dono da casa (owner-only no backend, não só na UI).
5. **Memória seletiva**: ver, adicionar, editar, ativar/desativar, excluir;
   separada do histórico; injetada como contexto (limite 20, nunca o banco).
6. **Voz**: síntese + reconhecimento com detecção de suporte, microfone
   manual com indicador, sem escuta permanente.
7. **n8n**: webhooks por casa (owner-only), resumo JSON montado no frontend
   (só totais, sem segredos), copiar + envio manual com HTTP real exibido.
   App segue 100% funcional sem n8n.

### Decisões técnicas e justificativas

- Edge Functions (Deno) em vez de Netlify Functions: ficam junto do banco e
  usam o JWT do Supabase Auth nativamente (Mapa §12 permite escolher).
- `ai_config_fh` sem policies: nem `key_last4` via leitura direta — tudo passa
  pela função (o status exibe só máscara).
- `set` valida a chave na Groq antes de persistir: nunca guardamos chave ruim.
- Modelo configurável por casa (padrão `llama-3.3-70b-versatile`); `test`
  confirma que o modelo existe na conta.
- `mood_log` resolve o nome no catálogo (sem IDs inventados pelo modelo).
- Sem tool de SQL/lote/exclusão em massa na v1 (fora do escopo seguro).
- Deno não validado aqui (sem CLI): código revisado por leitura; deploy +
  verificação ficam com o usuário (documentado no README).

### Alterações SQL relacionadas

- **FH-SQL-005** (6 tabelas, 18 policies, triggers, validações 1–5, rollback).
  **Estado: [preparado] — NÃO executado.**

### Testes executados e resultados reais

| Comando | Resultado |
|---|---|
| `npm run lint` | **0 erros, 0 avisos** |
| `npm run typecheck` | **ok** |
| `npm test` | **86 testes / 18 arquivos — todos passaram** (5 novos) |
| `npm run build` | **ok** |
| Smoke `vite preview` | `/` 200 |
| Codificação | 0 U+FFFD em `src/` e `supabase/` |
| Edge Functions | **NÃO executadas** (sem CLI/projeto aqui); deploy documentado |

Correções durante a rodada: contagem de policies no bloco; `Quote` reexport;
`useCallback` com IIFE; refs em render; `no-useless-assignment` em parses.

### Nota sobre codificação (lição registrada)

Durante a rodada, a saída do console (codepage Windows) exibiu `�` e `ǭ` em
vários pontos, sugerindo corrupção. Verificação por codepoints provou que os
arquivos estavam intactos ("NÃO" = U+004E U+00C3 U+004F). Regra mantida:
confiar em verificação por bytes/codepoints, nunca em renderização do console;
e nunca usar bash para conteúdo de arquivo com não-ASCII (lição da Fase 2).

### Pendências, riscos e limitações

1. **Bloqueado pelo usuário:** executar FH-SQL-002→005; `.env`; Supabase CLI +
   `supabase functions deploy` + `GROQ_ENC_KEY`; definir chave na UI; testar
   chat, confirmação, memória e voz com 2 perfis.
2. Voz depende do navegador (Chrome/Edge OK; Firefox parcial) — avisado na UI.
3. Nenhuma chave de API foi manuseada nesta rodada (a anterior, citada no
   Mapa §8, segue tratada como exposta: troca pela UI após o deploy).

### Próximas ações recomendadas

1. **Usuário:** SQL → `.env` → deploy das funções → chave → testes manuais.
2. **Agente (após confirmação):** Fase 6 — Offline e refinamento.

---

## Rodada 009 — Fase 6: Offline e refinamento

**Data:** 2026-10-14
**Fase:** 6 — Offline e refinamento
**Objetivo:** rascunhos offline com sincronização idempotente e conflitos
explícitos, push quando suportado, code-splitting, worker PDF local,
acessibilidade (foco, contraste, reduced-motion).

### Estado inicial relevante

- Usuário pediu para prosseguir ("Prossiga") ainda sem `.env` e sem SQL
  executado — estratégia honesta mantida: motor de sync testado com mocks.

### Arquivos criados

- `src/offline/outbox.ts` (+ teste) — store persistente, `executeOp`,
  `syncOutbox`, `resolveConflict`.
- `src/offline/useOnline.ts` — online/offline + auto-sync.
- `src/offline/usePush.ts` — Web Push com estados honestos.
- `src/features/settings/SyncSection.tsx` — fila, conflitos, push.
- `src/styles/tokens.test.ts` — contraste WCAG AA dos dois temas.
- `supabase/migrations/20261014160000_fh_push.sql` — espelho FH-SQL-006.

### Arquivos alterados

- `src/i18n/pt-BR.ts`, `en.ts` — chaves `sync.*`.
- `src/app/App.tsx` — `React.lazy` por rota + `Suspense`.
- `src/app/AppShell.tsx` — badge da outbox, indicador de sync, guarda de
  logout (confirma se há pendentes; rascunhos são apagados ao sair).
- `src/auth/AuthProvider.tsx` — (sem mudança: `fh.outbox.v1` já cai na
  limpeza `fh.*`, preservando só preferências).
- `src/features/agenda/AgendaPage.tsx` — criar tarefa/lembrete/evento
  offline enfileira; alternar tarefa offline enfileira update; aviso
  "salvo offline"; recorrência exige conexão (recusada com mensagem).
- `src/features/diary/DiaryPage.tsx` + `DiaryDialogs.tsx` — criar
  post/dica/fofoca offline enfileira (post: só texto; fotos quando online).
- `src/agenda/useAgenda.ts` — `updated_at` nos tipos (base de conflito).
- `src/ui/Modal.tsx` — armadilha de foco (Tab circula, Esc fecha).
- `src/styles/index.css` — `prefers-reduced-motion`.
- `src/finance/pdf.ts` — worker local empacotado (offline) com reserva CDN.
- `banco.sql` — bloco FH-SQL-006 (estado [preparado]).

### Funcionalidades e limites implementados

1. **Outbox** com estados pendente/sincronizando/sincronizado/conflito/falha,
   IDs únicos gerados no cliente, FIFO, até 5 tentativas, poda de
   sincronizados após 7 dias.
2. **Idempotência**: criações inserem com o ID da operação (retry após queda
   de rede = unicidade violada = sucesso, sem duplicar); updates comparam
   `updated_at` (servidor mais novo = conflito com resolução mine/theirs).
3. **Escopo**: só criações seguras + updates de tarefas/posts. Finanças
   exigem conexão (mensagem explícita); mídia exige conexão.
4. **Push**: permissão, inscrição e persistência no banco quando há VAPID;
   sem suporte/sem chave/negado = estados honestos. Entrega depende de
   backend (Fase 7/n8n) — nada afirma entrega.
5. **Performance**: rotas em chunks (Agenda 27 kB, Finance 54 kB, Diary 21 kB,
   Assistant 18 kB, pdf 430 kB lazy, worker 1,26 MB asset local); inicial
   cai de ~681 kB para ~619 kB (supabase-js continua dominante).
6. **Acessibilidade**: foco preso no Modal, reduced-motion, contraste AA
   testado nos dois temas (10 pares).

### Decisões técnicas e justificativas

- Outbox em `localStorage` (zustand persist), não IndexedDB: operações são
  JSON pequenos; simplicidade auditável vence aqui.
- Logout apaga a outbox (dado privado) COM aviso prévio e confirmação quando
  há pendentes — equilíbrio entre privacidade e perda de dados.
- `sync.*` com 21 chaves; paridade pt/en coberta pelo teste de i18n.
- `VITE_VAPID_PUBLIC_KEY` documentada no `.env.example`? Não — sem backend
  ainda; entra na Fase 7 com o worker de push do servidor.

### Alterações SQL relacionadas

- **FH-SQL-006** (`push_subscriptions_fh` + 3 policies, validações 1–3).
  **Estado: [preparado] — NÃO executado.**

### Testes executados e resultados reais

| Comando | Resultado |
|---|---|
| `npm run lint` | **0 erros, 0 avisos** |
| `npm run typecheck` | **ok** |
| `npm test` | **107 testes / 20 arquivos — todos passaram** (21 novos) |
| `npm run build` | **ok** — chunks por rota confirmados no `dist/` |
| Smoke `vite preview` | `/` 200 |
| Codificação | 0 U+FFFD em `src/` |

Correções durante a rodada: mock de update encadeado no teste; `table`
redeclarada; `void env` residual; `Quote` já resolvido na Fase 5.

### Pendências, riscos e limitações

1. **Bloqueado pelo usuário:** executar FH-SQL-002→006; `.env`; CLI + deploy;
   chave Groq; testes com 2 perfis (sync real e RLS não validados na prática).
2. Sincronização agressiva (tempo real entre dispositivos) fica para o futuro
   com Realtime; o modelo atual é pull (abrir/voltar o sinal/1 vez por tela).
3. Push entrega: Fase 7 ou n8n com chave VAPID privada.

### Próximas ações recomendadas

1. **Usuário:** SQL → `.env` → deploy → chave → testes manuais das Fases 1–6.
2. **Agente (após confirmação):** Fase 7 — Verificação final.

---

## Rodada 010 — Fase 7: Verificação final (parte 1 — auditoria)

**Data:** 2026-10-14
**Fase:** 7 — Verificação final
**Objetivo:** bateria final, auditoria estática de SQL/RLS, varredura de
segredos e revisão de documentos.

### Achados da auditoria (com correção)

1. **BUG REAL — FKs forward-reference no FH-SQL-003:** `financial_transactions_fh`
   referenciava `financial_recurrences_fh` e `financial_import_rows_fh`, criadas
   DEPOIS no mesmo bloco (`relation does not exist` na execução). Corrigido:
   colunas simples + `ALTER TABLE ... ADD CONSTRAINT` condicional na seção 8b,
   com validação 5 nova. Bloco nunca aplicado → correção in-place justificada.
   Espelho `20261014130000_fh_finance.sql` regenerado.
2. **Verificação global de forward-references** (script: toda `references`
   aponta para tabela criada antes): **0 violações** após a correção.
3. **Recontagem de policies**: 8+30+40+35+18+3 = **134**; tabelas 4+9+11+9+6+1
   = **40**. Confere com as validações dos blocos.
4. **Varredura de segredos**: 1 achado — `.env.example` versionado continha
   URL + JWT anon de aparência real (e DIVERGENTES entre si). Ação: trocados
   por placeholders. **Nenhuma tentativa de contato com esse projeto foi feita.**
   Nota: anon key é pública por desenho (vai no bundle); a proteção real é o
   RLS. `.env` não existe. Demais matches: hashes do `package-lock.json`.
5. **`.env.example`**: adicionado `VITE_VAPID_PUBLIC_KEY` (opcional) e corrigido
   comentário da `FH_GROQ_ENC_KEY` para base64 (igual à implementação).
6. **Limitação aceita**: `goal_contributions_fh` legível por qualquer membro
   mesmo se a meta for pessoal (contexto da meta segue protegido). Risco baixo
   para 2 pessoas; evolução documentada, não falha oculta.

### Bateria final (resultados reais)

| Comando | Resultado |
|---|---|
| `npm run lint` | **0 erros, 0 avisos** |
| `npm run typecheck` | **ok** |
| `npm test` | **107 testes / 20 arquivos — todos passaram** |
| `npm run build` | **ok** (chunks por rota confirmados) |
| Codificação | 0 U+FFFD em `src/`, `supabase/`, `banco.sql` |

---

## Rodada 010 (parte 2) — Matriz dos 23 critérios de aceite

Legenda: ✅ implementado + testado em código · ⚠️ parcial · ❌ bloqueado (falta ambiente do usuário).

| # | Critério | Estado |
|---|---|---|
| 1 | Dois usuários autenticam e encerram sessão | ❌ código pronto, sem `.env` |
| 2 | RLS + backend protegem dados pessoais | ❌ SQL pronto; só FH-001 tocou o banco (1 validação) |
| 3 | Relógios Brasília/Dublin corretos | ✅ testado, sem backend |
| 4 | Fusos/DST respeitados | ✅ testado |
| 5 | Clima real + falha tratada | ⚠️ testado com mock; chamada real nunca feita |
| 6 | Agenda com permissões e recorrências | ❌ bloqueado (banco) |
| 7 | Recorrências financeiras nascem pendentes | ✅ testado |
| 8 | Retry não duplica | ✅ constraints + testes |
| 9 | Transferências fora do consolidado | ✅ testado |
| 10 | Efetiva × referência | ✅ testado |
| 11 | Importação exige revisão | ✅ testado (CSV + PDF parse) |
| 12 | IA consulta dados reais com permissões | ❌ precisa deploy + chave |
| 13 | IA confirma ações sensíveis | ❌ precisa deploy |
| 14 | Chave Groq nunca exposta | ✅ arquitetura; validação final no deploy |
| 15 | Chave substituível pelas configurações | ❌ precisa deploy |
| 16 | Offline sincroniza sem duplicatas | ✅ testado com mocks |
| 17 | Conflitos e erros visíveis | ⚠️ implementado, não exercitado |
| 18 | Preferências persistem | ❌ precisa `.env` |
| 19 | PWA instalável + cache limpo no logout | ⚠️ manifest/SW prontos; instalação real nunca testada |
| 20 | `diario.md` e `banco.sql` atualizados | ✅ em todas as rodadas |
| 21 | Nenhum SQL sem autorização | ✅ regra cumprida |
| 22 | Build + testes passam, documentados | ✅ 107/107 + build ok |
| 23 | Docs de setup/deploy/recuperação | ⚠️ README completo, deploy real nunca executado |

**Resumo: 11 ✅ · 5 ⚠️ · 7 ❌ (todos os ❌ dependem do ambiente do usuário).**
Nenhuma fase pode ser marcada como *validada* — apenas como *implementada* —
até a lista de ações manuais abaixo ser cumprida.

### Próximas ações recomendadas

1. **Usuário:** executar a lista mestre de configuração (resposta do agente
   nesta rodada — inclui SQL 002→006, `.env`, deploy, chave e testes manuais).
2. **Agente (quando o ambiente existir):** revalidação assistida fase a fase
   e marcação dos critérios como confirmados por evidência.

---

## Rodada 011 — Suporte ao teste de isolamento RLS

**Data:** 2026-10-14
**Fase:** 1/7 — validação assistida (sem código de app alterado)
**Objetivo:** destravar o usuário na validação de isolamento do RLS.

### Ocorrido

- Minha instrução anterior usava placeholders (`UUID-A`, `COLE-O-CODIGO-AQUI`)
  sem deixar claro que precisavam ser substituídos — o usuário colou
  literalmente e recebeu `22P02: invalid input syntax for type uuid`.
  Falha de instrução minha, sem impacto no banco (erro antes de qualquer escrita).

### Arquivo criado

- `supabase/tests/rls-isolamento.sql` — script único e idempotente que: cria
  3 usuários via `auth.users` (bcrypt com `crypt`/`gen_salt`, e-mail confirmado,
  `instance_id` zero-UUID padrão); A cria a casa; B entra com o código
  (resolvido por e-mail via temp table, sem copiar nada); C verifica 0 linhas;
  confere os perfis do trigger. Limpeza incluída (etapa 0 + bloco opcional).
  Verificado: 0 U+FFFD. Não é migração — não entra no `banco.sql`.

### Pendências

1. Usuário executa o script e informa os 5 resultados (3, 1+código, 1, 0, 3).
2. Se C enxergar 1 linha: furo no RLS — investigar com prioridade máxima.

### Adendo 2026-10-14 — etapa 3 não concluiu (B com household NULL)

Evidência no print do usuário (etapa 5): A com casa, B e C com NULL.
Diagnóstico: o join de B via temp table `tmp_codigo` não persistiu entre as
transações nesse editor. Correção no `supabase/tests/rls-isolamento.sql`:
etapa 3 reescrita como bloco `DO $$` único (lê o código e faz o join sem
depender de temp table) + etapa 3b de prova (B enxerga 1 linha). A etapa 2
passou a exibir `id, name, join_code` direto, sem temp table.
## Rodada 012 — Entrada simplificada por perfil

**Data:** 2026-10-24
**Objetivo:** reduzir atrito na entrada e aproveitar a autenticação/RLS e os
módulos existentes, sem expor tabelas ao papel `anon`.

### Alterações

- `src/features/auth/LoginPage.tsx`: substituída a entrada por e-mail/senha por
  cartões de seleção de perfil. A lista é configurável em `VITE_PROFILES`
  (padrão: Jéssica,Rafael); cada cartão mostra iniciais em avatar colorido.
- `src/auth/AuthProvider.tsx`: seleção cria uma sessão Supabase anônima com
  `display_name` no metadata. Sessões são mantidas separadas por perfil no
  navegador, preservando `auth.uid()` individual; atualizar o perfil selecionado
  segue usando as policies existentes com papel `authenticated`.
- `.env.example` e `README.md`: documentadas a lista de perfis e a necessidade
  de ativar Anonymous Sign-Ins no painel Supabase (Authentication → Sign In /
  Providers). A chave anon continua pública e protegida pelas policies RLS.
- `src/app/AppShell.tsx`: layout passa a ocupar a largura útil do notebook e
  continua fluido em telas estreitas.

### Banco / configuração externa

- Nenhum DDL é necessário; `banco.sql` permanece sem alteração. O trigger de
  perfil já usa `raw_user_meta_data.display_name` e as sessões anônimas usam o
  papel `authenticated` após o login anônimo.
- A ativação do provedor é feita no Dashboard, não por SQL. Sem essa ativação,
  a seleção mostrará o erro do Supabase.
- Esta entrada é identificação de conveniência, não autenticação forte: qualquer
  pessoa com acesso ao navegador pode escolher qualquer perfil. Perder os dados
  locais pode exigir selecionar novamente e associar a nova sessão à casa.
- Os avatares desta primeira etapa usam iniciais; fotos reais dependem de definir
  imagens para cada perfil. Sem nomes/fotos confirmados pelo usuário, não foram
  inventadas imagens pessoais.

### Verificação e pendências

- `npm run build`: concluído com sucesso (TypeScript + Vite). Vite emitiu aviso
  já conhecido de chunk principal acima de 500 kB; PDFs e telas pesadas seguem
  em chunks separados onde configurado. Nenhum teste foi executado nesta rodada.
- Validar no ambiente Supabase: ativar Anonymous Sign-Ins; escolher cada perfil
  em navegadores/perfis independentes; criar/entrar na casa; conferir autoria,
  isolamento RLS e troca de perfil no mesmo navegador.
- Sugestão realista: manter uma rotina de backup e recuperação das sessões; o
  modo sem senha não oferece recuperação de conta se o armazenamento local for
  apagado. Para duas pessoas no mesmo notebook, a troca de perfil é conveniente,
  mas não impede que uma veja os dados da outra.

## Rodada 013 — Sessões por perfil, convite, tema e uso seguro do Groq

**Data:** 2026-10-24
**Objetivo:** corrigir a perda aparente da casa ao sair, explicar/mostrar o
código de convite, dar acesso rápido ao tema e encaminhar `GROQ_API_KEY` pelo
backend seguro.

### Correções e melhorias

- `src/auth/AuthProvider.tsx`: sair e alternar perfis agora encerram a sessão
  somente localmente (`scope: 'local'`). O logout global anterior revogava no
  Supabase o refresh token guardado do perfil; ao escolhê-lo novamente podia
  nascer outro `auth.uid()` sem vínculo à casa. Não foi executada ação remota.
- `src/app/AppShell.tsx`: o dono vê o código da casa no cabeçalho e pode copiá-lo.
  O segundo perfil deve escolher seu nome, inserir o código e entrar na mesma
  casa. A consulta existente carrega casa e membros pelo Supabase após entrar.
- `src/features/household/OnboardingPage.tsx`: o tema também fica acessível no
  onboarding, onde o cabeçalho principal ainda não é montado.
- `src/preferences/ThemeToggle.tsx`: alterna claro/escuro, grava no armazenamento
  local e sincroniza para `user_settings_fh` do usuário autenticado.
- `supabase/functions/groq-chat` e `groq-config`: aceitam `GROQ_API_KEY` como
  segredo global da Edge Function, sem expô-la ao navegador; chave criptografada
  da casa continua tendo prioridade. O README documenta publicação e uso.
- `banco.sql` ganhou FH-SQL-007, SELECT somente leitura para confirmar casas,
  membros, nomes e código no SQL Editor. É diagnóstico, não DDL nem migração.

### Estado real / ações externas

- O código de criação chama `create_household_fh` (transação que insere casa,
  membro owner e perfil) e atualiza o estado consultando o banco. A consulta
  FH-SQL-007 ainda precisa ser rodada no projeto Supabase do usuário para
  confirmar a linha persistida; o ambiente local não tem acesso administrativo
  ao SQL Editor nem foi usado para alterar o projeto.
- Para aderir à casa já criada após a sessão antiga ter sido revogada, o SQL
  FH-SQL-007 mostra o código; o perfil atual pode então entrar com esse código.
  Isso mantém a casa e os registros existentes no banco.
- Para o chat Groq funcionar na hospedagem, aplicar FH-SQL-005 se ainda não
  aplicado, definir o segredo `GROQ_API_KEY` no projeto Supabase e publicar
  `groq-chat`/`groq-config`. O arquivo `.env` local não injeta segredos nas Edge
  Functions. Nenhum segredo é prefixado com `VITE_`.
- A chave Groq apareceu em saída da leitura local do `.env` nesta rodada. Por
  segurança, revogue-a na Groq e gere outra antes de enviá-la ao Supabase.

### Verificação pendente

- `npm run build`: passou (TypeScript + Vite); aviso existente de chunk principal
  acima de 500 kB. Nenhuma suíte de testes foi executada.
- Executar FH-SQL-007 no SQL Editor e confirmar que mostra a casa e seus membros.
- Testar alternância Jéssica/Rafael em um mesmo navegador e verificar persistência
  do `auth.uid()`, membresia e preferência de tema por usuário.

## Rodada 014 — Persistência da casa e padrão de modais/toasts

**Data:** 2026-10-24
**Objetivo:** investigar a casa que parecia desaparecer após sair e estabelecer
modais para confirmações e toasts para notificações.

### Diagnóstico e mudanças

- A criação usa `create_household_fh`; o logout usa `scope: 'local'`. A sessão
  por perfil podia ser sobrescrita durante uma troca, pois o listener de auth
  gravava o token atual no perfil selecionado enquanto `setSession` trocava a
  identidade. `AuthProvider` agora suspende essa gravação durante a troca,
  preserva explicitamente a sessão anterior e grava a sessão restaurada/criada
  no perfil correto.
- `HouseholdProvider` antes convertia erro ao consultar casa em estado `none`;
  a UI voltava a oferecer “Criar casa”, ocultando uma falha de rede/RLS como se
  não houvesse casa. Agora erro de consulta tem estado distinto e tela com ação
  para tentar novamente. Criação/entrada só são confirmadas após uma nova
  consulta encontrar a casa no Supabase.
- Adicionado `ToastProvider` global e toasts de erro/sucesso nos fluxos de perfil,
  casa, convite e saída. A saída usa modal; a tela sem casa também permite trocar
  perfil com confirmação em modal. Removido o uso de `window.confirm`.
- A preferência visual do usuário foi mantida; este ajuste não exige alteração
  de banco nem execução de SQL.

### Verificação

- `npm run build`: passou (TypeScript + Vite). Permanece o aviso do chunk inicial
  acima de 500 kB; nenhum teste foi executado.
- Supabase remoto não foi consultado nesta rodada. Para verificar a persistência
  real, executar a consulta somente leitura FH-SQL-007 do `banco.sql` no projeto
  conectado e conferir a casa, o dono e o vínculo de Rafael.
- Após a atualização, se ainda aparecer “não foi possível verificar”, a tela
  mostrará o erro concreto da consulta em vez de sugerir criar outra casa.

## Rodada 015 — Carregamento confiável e prevenção de casas duplicadas

**Data:** 2026-10-24  
**Objetivo:** corrigir a situação em que o navegador oferece criar novamente,
apesar de já existir uma casa associada ao perfil no Supabase.

### Diagnóstico e mudanças

- As capturas do Supabase mostram uma casa, um membro `owner` e o perfil Rafael
  apontando para o mesmo `household_id`. A persistência da casa está confirmada;
  a tela de onboarding indica que o navegador não está recuperando/consultando
  essa associação com a identidade correta.
- `src/auth/AuthProvider.tsx`: a resposta assíncrona de `getSession()` não pode
  mais substituir uma sessão mais recente já recebida por `onAuthStateChange`.
  Isso fecha uma corrida na restauração/inicialização do login por perfil.
- `src/household/HouseholdProvider.tsx`: antes de criar, reconsulta a casa do
  perfil. Se encontrar vínculo, impede a inserção duplicada e mantém a casa
  existente; se a consulta falhar, também interrompe a criação e informa o erro.

### Banco e verificação

- Nenhuma alteração de schema é necessária; `banco.sql` não mudou e não é
  necessário executar SQL no Supabase para este ajuste.
- `npm run build`: passou (TypeScript + Vite); permanece o aviso do chunk inicial
  acima de 500 kB. Após atualizar o navegador, selecionar
  Rafael no mesmo navegador em que a sessão foi usada deve recuperar o vínculo.
  Se ainda não houver vínculo para a sessão ativa, o formulário de criação não
  deve duplicar a casa sem antes concluir a verificação.

## Rodada 016 — Busca pelo perfil e gerenciamento da casa

**Data:** 2026-10-24  
**Objetivo:** usar o código de convite com clareza e apresentar os dados da casa
em Configurações.

### Mudanças

- `src/household/service.ts`: a recuperação da casa agora consulta primeiro a
  associação em `household_members_fh` e depois `profiles_fh.household_id`, que
  as capturas mostram preenchido. Isso reduz dependência de encontrar a casa pela
  autoria e cobre o vínculo singular salvo no perfil.
- `src/features/settings/HouseholdSettingsSection.tsx`: nova seção em
  Configurações mostra nome, código de convite, membros e papéis; o código pode
  ser copiado com toast e o criador pode renomear a casa por modal.
- A estrutura atual relaciona cada perfil a uma casa ativa (`profiles_fh` tem um
  `household_id`). A nova seção administra a casa do perfil atual; várias casas
  selecionáveis por perfil exigiriam ampliar o modelo e revisar o escopo de todos
  os módulos que filtram dados por casa.

### Banco e verificação

- Nenhuma alteração de banco necessária; `banco.sql` não mudou.
- `npm run build`: passou (TypeScript + Vite); permanece o aviso do chunk inicial
  acima de 500 kB. Não há comando SQL a executar.

## Rodada 017 — Contas permanentes por perfil e migração do Anonymous Auth

**Data:** 2026-10-24  
**Objetivo:** substituir identidades anônimas descartáveis por contas estáveis
para que a seleção de perfil recupere sempre o mesmo `auth.uid()`.

### Decisão e implementação

- `src/auth/AuthProvider.tsx`: nomes são convertidos em e-mails sintéticos
  estáveis (`jessica@financial.home`, `rafael@financial.home`). A senha é derivada
  com SHA-256 de uma semente estável e slug do perfil; a seleção tenta
  `signInWithPassword` primeiro e faz `signUp` apenas quando as credenciais ainda
  não existem. Sessões continuam sob gerenciamento nativo do Supabase; foram
  removidos `signInAnonymously` e caches JSON `fh.auth.profile.*`.
- `src/features/auth/LoginPage.tsx`: os cartões continuam sendo o único passo
  necessário para escolher um perfil; carregamento e erros seguem visíveis.
- `.env.example`, `src/vite-env.d.ts` e `README.md`: documentam
  `VITE_PROFILE_AUTH_SECRET`, que deve permanecer idêntico. Como é frontend, não
  é segredo. A solução mantém RLS por `auth.uid()`, mas o seletor sem senha não
  autentica a pessoa: qualquer usuário do app pode derivar as credenciais e
  assumir qualquer perfil. Limite aceito para este uso interno de baixa segurança.
- `banco.sql`: FH-SQL-008 fornece prévia e DELETE opcional somente para contas
  Anonymous Auth sem casa, sem membership e que não criaram uma casa; FH-SQL-009
  permite promover uma conta permanente já associada à casa antiga. Não executei
  nenhum SQL no Supabase. O DELETE é comentado e exige revisão dos candidatos.

### Migração e configuração necessárias

- No Supabase, habilitar o provedor Email e desabilitar confirmação de e-mail
  para as contas sintéticas (não recebem mensagens). Anonymous Sign-Ins deixa de
  ser necessário, mas usuários legados não são apagados automaticamente.
- As contas permanentes terão UUIDs novos. Entre com os perfis novos e associe-os
  à casa existente pelo código. Se o antigo dono era anônimo, execute FH-SQL-009
  após a entrada, substituindo o ID da casa e e-mail permanente. Só então revise
  os candidatos FH-SQL-008 e, se apropriado, execute seu DELETE.
- `banco.sql` ganhou FH-SQL-008/009; não há alteração de schema nem policy RLS.

### Verificação

- `npm run build`: passou (TypeScript + Vite); permanece o aviso de chunk maior
  que 500 kB. Nenhuma suíte de testes foi executada.
- Pendente no projeto Supabase: confirmar Email habilitado e confirmação
  desabilitada; testar criação/entrada das duas contas e validar UUID único estável.

## Rodada 018 — Orientação para provedor Email desativado

**Data:** 2026-10-24

- A captura do navegador mostra `Email logins are disabled` (HTTP 422), erro de
  configuração do Supabase Auth, não erro de schema criado por `banco.sql`.
- `src/auth/AuthProvider.tsx`: a mensagem agora orienta a habilitar Email em
  Authentication → Sign In / Providers.
- `README.md`: documenta habilitar Email e desligar Confirm email para as contas
  internas que usam endereços sintéticos. Não requer SQL.
- `npm run build`: passou (TypeScript + Vite); permanece o aviso do chunk
  inicial acima de 500 kB. Nenhuma alteração de banco foi feita.

## Rodada 019 — Identificação local em profiles_fh (sem Supabase Auth)

**Data:** 2026-10-24

- Pedido: simplificar a entrada, removendo a dependência de Supabase Auth e
  preparar `banco.sql` para recriação integral do banco.
- `src/auth/AuthProvider.tsx` e `src/supabase/client.ts`: selecionar os perfis
  permanentes Jéssica/Rafael de `profiles_fh`; guardar o UUID no navegador e
  enviá-lo como `x-profile-id`. Não são criados usuários/sessões de Supabase
  Auth. Logout limpa identificação e dados temporários e preserva preferências.
- `banco.sql`: perfis fixos com UUIDs estáveis; FKs apontam para
  `profiles_fh`; helper `current_profile_id_fh()` lê o cabeçalho; funções de
  casa e policies RLS aceitam o papel `anon`. Nenhum Auth provider precisa ser
  habilitado. O arquivo completo é para executar uma vez em um projeto/banco
  limpo depois de apagar as tabelas do app.
- Funções Edge usam o mesmo cabeçalho para identificar o perfil. As rotas
  Supabase Functions ainda passam o anon key público para o gateway.
- Limite conhecido: qualquer pessoa com acesso ao app pode forjar `x-profile-id`
  e assumir Jéssica ou Rafael. Isso atende à baixa segurança pedida, mas não deve
  ser usado para dados que precisem de controle de acesso real.
- `.env.example`: removidos valores de chave que não devem estar no modelo
  versionado. Se a chave Groq mostrada anteriormente nesse arquivo estiver
  ativa, revogue-a e gere uma nova na Groq; não registrar o valor novo no Git.
- `README.md`: instruções claras de instalação limpa; nenhum SQL separado é
  necessário além do `banco.sql` completo.
- Verificação: `npm run build` passou (TypeScript + Vite); aviso existente de
  chunk inicial acima de 500 kB. Nenhum SQL foi executado no Supabase. O usuário
  deve executar o arquivo completo no SQL Editor depois de limpar o banco.

## Rodada 020 — Feedback e falhas na configuração Groq

**Data:** 2026-10-24

- A captura mostra a configuração sem chave e o Assistente informando que a
  Edge Function está indisponível. O formulário não mostrava feedback útil em
  falhas HTTP/rede ao salvar e iniciava a consulta de status durante o render.
- `src/features/settings/GroqKeySection.tsx`: status agora é carregado em
  `useEffect`; salvar, testar e remover tratam falhas e exibem toasts, além de
  mensagens na tela. HTTP 404 indica função ausente; 401/403 aponta rejeição
  pelo Supabase. Sucesso de salvar confirma validação antes de persistir.
- Sem alterações no schema e sem SQL a executar. A Edge Function
  `groq-config` precisa estar implantada para salvar a chave; para conversar
  com o modelo, implante também `groq-chat` e configure `GROQ_ENC_KEY` caso
  salve uma chave por casa.
- Verificação: `npm run build` passou (TypeScript + Vite); aviso existente de
  chunk inicial acima de 500 kB. Não foi possível verificar a implantação
  remota das Edge Functions deste workspace.

## Rodada 021 — Clima de 24 horas e Groq global como governanta

**Data:** 2026-10-24

- Referência consultada: Mapa da Verdade PDF, especialmente §2.3 (visão
  horária do clima e fuso Europe/Dublin), §3.6 (assistente com ferramentas
  autorizadas, precisão e confirmação de ações sensíveis), §8 (segredos e
  dados pessoais), §10 e §14 (fases e avanço por evidência).
- `src/ui/WeatherWidget.tsx`: removido o limite visual das primeiras oito horas;
  grade responsiva apresenta todos os pontos horários retornados para hoje,
  usa hora local de Dublin e esmaece os horários anteriores. Hora atual recebe
  destaque e a visualização atualiza a cada minuto.
- `ai_config_fh` em `banco.sql`: uma linha global (`config_id = 'global'`) em vez
  de uma configuração por casa. FH-SQL-009 migra bancos já criados, preservando
  a configuração atualizada mais recentemente; no banco vazio o esquema já
  nasce global. É SQL de migração preparado, ainda não executado.
- `supabase/functions/groq-config` e `groq-chat`: salvam/validam/testam uma
  chave criptografada global, usada por todos os perfis. Somente o dono da casa
  pode substituir a chave; os demais perfis podem consultar o status e usar o
  chat. `GROQ_ENC_KEY` continua necessária como segredo backend para criptografia.
- `supabase/functions/groq-chat`: persona atualizada para governanta digital e
  ferramenta `household_search` adicionada para registros recentes ou busca
  por palavra em agenda, finanças, diário, recados, dicas e outras áreas. As
  consultas filtram a casa, respeitam registros pessoais do perfil e limitam
  campos/quantidade. Não há SQL arbitrário. Dados necessários à resposta são
  enviados à Groq; o banco inteiro não é despejado automaticamente.
- Revisão adicional de privacidade: humores ficam restritos ao perfil ativo;
  fofocas e registros com `owner_id` são privados por padrão; transferências
  só aparecem quando as duas contas são visíveis.
- `README.md`: configuração agora descreve a chave global, a migração e o
  escopo de acesso do assistente.
- SQL para o banco existente: executar somente o bloco **FH-SQL-009** no fim
  de `banco.sql`. Publicar novamente `groq-config` e `groq-chat` para aplicar
  o backend atualizado. Não executei comandos remotos.
- Verificação: `npm run build` passou (TypeScript + Vite); permanece aviso de
  chunk inicial maior que 500 kB. Nenhuma suíte de testes foi executada.
- Próxima etapa no mapa: Fase 7, revalidação final assistida e comprovação
  manual das integrações, depois de aplicar FH-SQL-009 e publicar as funções.

## Rodada 022 — Modelos Groq, categorias e atalhos móveis

**Data:** 2026-10-24

- Captura recebida mostra que o campo aceitava um ID inexistente/indisponível
  (`meta-llama/llama-4-scout-17b-16e-instruct`). O modelo agora é selecionado
  entre opções atuais com suporte a ferramentas; o backend faz chamada real de
  chat + ferramenta para validar e permite atualizar só o modelo usando a chave
  criptografada já salva. Também trocado `max_tokens` pelo parâmetro atual
  `max_completion_tokens` no chat.
- `FinanceCategoryPanel`: nova aba Finanças → Categorias para criar, editar e
  remover categorias e estabelecimentos ligados (ex.: Mercado → Tesco). As
  ações usam modais de confirmação e toasts; os padrões só são criados quando
  a casa ainda não tem categorias, para respeitar exclusões feitas pelo usuário.
- `financial_merchants_fh` e `financial_transactions_fh.merchant_id`: esquema,
  RLS e migração idempotente **FH-SQL-010** adicionados a `banco.sql`. Lançamentos
  existentes continuam válidos e sem estabelecimento.
- Visão Geral ganhou botões flutuantes para despesa rápida e chat da IA. O
  lançamento usa o mesmo diálogo de Finanças, com estado pendente por padrão.
- Navegação mobile agora quebra em linhas em vez de rolar horizontalmente;
  cartões financeiros e itens de listas refluem em telas estreitas, e o viewport
  corta overflow horizontal acidental.
- Próxima ação no Supabase: se o banco já existe, rodar somente FH-SQL-010 e
  publicar novamente `groq-config` e `groq-chat`. Nenhuma alteração remota foi
  aplicada nesta rodada.

## Rodada 023 — Foco dos modais, salvamento de formulários e foto do perfil

**Data:** 2026-10-24

- Corrigida a armadilha de foco dos modais: callbacks recriados em cada render
  faziam o efeito focar de novo o primeiro botão (o X de fechar). O foco inicial
  agora prioriza campos editáveis e o listener de teclado fica estável.
- Lançamentos novos começam com despesa e categoria Alimentação (ou a primeira
  categoria de despesa existente caso Alimentação tenha sido removida); isso
  também funciona quando as categorias chegam depois da abertura do diálogo.
- Corrigido `parseAmountInput` para aceitar valores numéricos vindos do banco.
  O erro observado (`raw.trim is not a function`) abortava o envio do diálogo
  antes de chamar o update. Financeiro, Diário, Agenda e edições de memória e
  automação da IA verificam se o update realmente alterou/devolveu uma linha e
  exibem erro quando RLS ou um registro ausente impede a gravação.
- No Diário → Fotos, cada imagem própria pode ser marcada como avatar da tela
  de entrada. O cartão de perfil mostra a foto selecionada; a imagem permanece
  no bucket privado e o navegador cria URL assinada usando o perfil local.
- Banco: coluna opcional `profiles_fh.login_photo_slot` e migração idempotente
  **FH-SQL-011** adicionadas ao `banco.sql`. Em banco existente, executar
  somente esse bloco. Nenhuma alteração remota foi executada.
- Próximo passo: aplicar FH-SQL-011 no SQL Editor do Supabase; após isso a
  escolha de avatar fica persistida para o perfil em todos os navegadores.

## Rodada 024 — Respostas legíveis da IA e verificação final local

**Data:** 2026-10-24

- A captura mostrava tabelas Markdown, delimitadores de negrito e UUIDs expostos
  como texto cru. O chat agora renderiza Markdown seguro com suporte GitHub
  Flavored Markdown, listas, títulos, blocos de código, links e tabelas contidas
  na largura da mensagem.
- Prompt da governanta reforça resposta direta, parágrafos/listas curtos,
  formatação de moeda e data, insights limitados aos dados observados e
  proibição de expor IDs, JSON bruto ou formato de ferramentas. Tabelas são
  desencorajadas em respostas para evitar leitura ruim em celulares.
- Erros de chat geram toast além da mensagem contextual; ações sensíveis têm
  toast de aviso e exigem confirmação em modal, com toast de resultado. Memórias
  e webhooks também usam modais de exclusão e toasts de sucesso/erro.
- O context de toasts foi separado do componente para remover o último aviso do
  lint e facilitar sua reutilização.
- Etapa 7 do Mapa da Verdade: suíte existente passou (20 arquivos, 107 testes),
  lint passou sem erros (após refatorar o contexto de toast), build passou e
  `npm audit` reportou zero vulnerabilidades. A build mantém aviso de chunk
  inicial >500 kB; o bundle do PDF é o principal candidato para code splitting.
- `undici`, dependência de desenvolvimento transitiva do jsdom, foi atualizada
  dentro da faixa compatível após o audit inicial detectar versão vulnerável.
- `README.md` registra formato das respostas, confirmação/toasts, comandos de
  validação e checklist de publicação/backup.
- Nenhum comando Supabase, SQL remoto ou deploy foi executado. Não houve mudança
  de banco nesta rodada. Para aplicar o novo prompt, publicar
  `supabase functions deploy groq-chat`; validar no Supabase e Netlify continua
  pendente até a publicação/validação manual do ambiente.
- Próximo passo da Fase 7: publicar a Edge Function, validar os fluxos com os
  dois perfis em produção, confirmar backup recuperável e revisar PWA/offline.
# 2026-10-24 — Filtros por intervalo e sincronização automática de recorrências

- Resumo financeiro: substituído o seletor “Este mês / Tudo” por datas inicial e final, com início padrão no primeiro dia do mês atual e término em hoje. O consolidado respeita as duas datas escolhidas.
- Recorrências: criação e edição agora sincronizam automaticamente os lançamentos pendentes até 12 meses à frente. O botão manual continua disponível para repetir a sincronização sem duplicar períodos.
- Edição: o botão “Editar recorrência” abre o mesmo formulário preenchido com os dados atuais. Mudanças ajustam somente pendências futuras. Pausar remove pendências futuras; excluir remove todos os lançamentos ainda pendentes/previstos da regra. Itens pagos/recebidos permanecem no histórico e são desvinculados ao excluir a regra.
- Confirmações e erros dessas ações usam modal/toast conforme o padrão solicitado.
- Banco: sem alteração de schema ou política RLS; não é necessário executar SQL no Supabase.
- Limite atual: as operações de sincronização usam chamadas Supabase sequenciais, portanto uma falha de rede no meio pode deixar parte da sincronização pendente. A unicidade de `(recurrence_id, period_key)` mantém seguro repetir pelo botão “Gerar pendentes”.
# 2026-10-24 — Limpar período e apagar conversas do Assistente

- Finanças: intervalo abre no mês-calendário atual (primeiro ao último dia); botão “Limpar” restaura essas datas após alterações.
- Assistente: adicionada seleção individual/múltipla e seleção total das conversas recentes do perfil atual, além de “Apagar todas”. A exclusão pede confirmação em modal, remove mensagens em cascata pela relação existente e mostra toast com o resultado. A ação “todas” é limitada ao perfil conectado e segue RLS.
- Banco: nenhuma alteração necessária; não executar SQL no Supabase.
- Verificação: `npm run build` concluído com sucesso; permanece o aviso conhecido de arquivos acima de 500 kB.
# 2026-10-24 — Identidade visual atualizada

- As três artes atuais em `public/icons` foram conectadas: `icon-192.png` na tela de perfil e no cabeçalho do sistema, além de favicon e ícone Apple; os ícones 192, 512 e maskable 512 ficam declarados no manifesto PWA.
- Service worker atualizado para pré-cache desses assets e novo nome de cache (`fh-shell-v2`) para atualizar instalações existentes.
- Banco: sem mudanças; não executar SQL no Supabase.
# 2026-10-24 — Refinamento visual da tela de seleção de perfil

- Reorganizada a entrada em layout centralizado: logotipo isolado no topo, título e instrução centralizados e texto de apoio alinhado ao centro.
- Removidos os cartões quadrados visíveis ao redor das fotos dos perfis. Avatares circulares maiores e nomes centralizados, com área de toque responsiva, estados de hover e foco acessíveis.
- No mobile, o seletor mantém duas colunas compactas, com espaços e tamanhos reduzidos para evitar quebra ou rolagem desnecessária.
# 2026-10-24 — Tema escuro como padrão

- Preferência inicial do tema alterada de “Sistema” para “Escuro” no armazenamento e no script anti-flash do HTML, para evitar que a primeira renderização apareça clara.
- Preferências explícitas previamente salvas continuam preservadas.
# 2026-10-24 — Dashboard financeiro, widgets e cotações automáticas

- Resumo de Finanças agora oferece widgets de indicadores, comparação realizado/previsto, donut de despesas pagas por categoria, contas, resultados por categoria/pessoa e câmbio.
- Donut e barras usam valores do intervalo escolhido e têm legendas/valores para explicar o conjunto dos dados; categorias além das seis principais são agrupadas em “Outras categorias”. Widgets podem ser ocultados e reordenados com controles acessíveis; a configuração é persistida em `localStorage` por `user.id`, separada para cada perfil no navegador.
- Câmbio automático via Frankfurter, em EUR para GBP/BRL/USD; dados ficam em cache local por 12 horas, atualizam ao abrir o painel e podem ser atualizados manualmente. As cotações automáticas são usadas na consolidação se não houver uma cotação manual para o mesmo par.
- Limite da fonte: a API gratuita fornece taxas de referência diárias, não feed de mercado em tempo real. O widget mostra a data da referência e atribui a fonte. Nenhuma chave ou tabela nova é necessária.
- Banco: sem mudanças; não executar SQL no Supabase.
- Verificação: `npm run build` concluído com sucesso; permanece o aviso conhecido sobre chunks acima de 500 kB.
# 2026-10-24 — Widgets configuráveis na Visão geral

- Personalização da Visão geral ampliada: seleção de widgets visíveis, reordenação, restauração dos padrões e persistência por perfil no navegador. A sincronização existente em `dashboard_layouts_fh` permanece compatível, incluindo layouts antigos em formato de lista.
- Adicionado widget opcional de câmbio automático EUR → GBP/BRL/USD, reutilizando fonte/cache Frankfurter já usado no resumo financeiro. O câmbio fica oculto por padrão na Visão geral e pode ser ativado pelo modal “Widgets”.
- Confirmações de personalização exibidas por toast; sem alteração de schema, não executar SQL no Supabase.
- Verificação: `npm run build` concluído com sucesso; aviso existente de chunks >500 kB permanece.

# 2026-10-24 — Clima, sessões MNQ, lista de mercado e arraste de widgets

- Clima: a previsão Open-Meteo agora solicita nascer e pôr do sol. O widget mostra os horários de Dublin e calcula o tempo restante de luz ou até o próximo amanhecer, sem reinterpretar o fuso do navegador.
- Visão geral: adicionados widgets de sessões MNQ (horário Europe/Dublin) e lista rápida compartilhada de mercado. A sessão considera Power Hour antes de RTH, mostra a próxima janela entre Londres/pré-mercado/abertura de NY e lembra o limite das 20h55. O calendário de sessões é indicativo em dias úteis e não contempla feriados.
- Lista de mercado: itens são adicionados com Enter/botão, marcados como comprados e removidos em lote após confirmação modal. Toasts informam inclusão, remoção e erros. Ambos os perfis da casa leem os mesmos itens; atualização periódica a cada 12 segundos.
- Personalização: setas substituídas por reordenação via drag-and-drop HTML5; checkboxes de visibilidade mantidos. Ordem e visibilidade continuam salvas por perfil no Supabase (`dashboard_layouts_fh`) e em `localStorage` como fallback.
- Banco: adicionada a tabela `grocery_items_fh`, índices, trigger e políticas RLS limitadas aos membros da casa. Para banco existente, executar uma vez no SQL Editor o bloco `FH-SQL-012` no final de `banco.sql`; não é necessário apagar os dados ou recriar o banco.
- Verificação: `npm run build` concluído após a integração; aviso existente de chunks acima de 500 kB permanece.

# 2026-10-24 — Quadro de tarefas da casa

- A rota “Quadro”, antes placeholder, agora mostra tarefas em três colunas: A fazer, Em andamento e Concluídas. Os cartões usam as mesmas tarefas da Agenda, com criação/edição, prioridade, responsável, categoria e prazo. É possível mudar a etapa arrastando no desktop ou pelo seletor (também funciona em telas touch).
- O status “Em andamento” foi adicionado ao modelo local; Overview, Agenda e contagem de vencimentos incluem tarefas em andamento. Itens cancelados continuam fora do quadro.
- A movimentação de status passa por `set_task_status_fh`: membros podem mover tarefas compartilhadas; tarefas pessoais continuam restritas a responsável/criador/dono. Edição e exclusão continuam limitadas pelas policies de tarefa já existentes.
- O Mapa da Verdade define Fase 4 como Diário e não especifica este quadro de tarefas como entrega da fase. O Quadro do menu foi desenvolvido como extensão coerente da Agenda, sem substituir o quadro de dicas/anúncios/fofocas que já está no Diário.
- Banco: FH-SQL-013 amplia a constraint de `tasks_fh.status` e cria a função RPC segura `set_task_status_fh`. Em banco existente, execute uma vez o bloco FH-SQL-013 ao final de `banco.sql`; não apagar dados. A migração correspondente está em `supabase/migrations/20261024170000_fh_board.sql`. SQL remoto não foi executado.
- Verificação: `npm run build` passou. Não foram executados testes automatizados nesta rodada. O aviso existente de bundle acima de 500 kB permanece.

## Pendências atuais do projeto

- **Supabase:** executar FH-SQL-013 antes de mover tarefas para “Em andamento”; em seguida validar com os dois perfis as tarefas compartilhadas, pessoais e as permissões de edição/exclusão. Validar também as migrações previamente preparadas que ainda não tenham sido aplicadas no banco ativo.
- **Assistente/produção:** publicar ou confirmar a publicação da Edge Function `groq-chat` e testar consulta, resumo e ações com dados conhecidos nos dois perfis.
- **PWA/offline:** validar instalação, cache privado/logout, conectividade e fila de sincronização em dispositivos reais; o quadro não enfileira mudanças offline e requer conexão para salvar etapas.
- **Entrega final:** publicar no Netlify, revisar mobile/acessibilidade, fazer backup recuperável e completar testes de RLS por chamadas diretas à API. O build local, sozinho, não confirma esses itens.
