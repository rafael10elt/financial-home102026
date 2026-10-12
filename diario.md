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
