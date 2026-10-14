# Financial Home 102026

PWA privado de organização doméstica, financeira e pessoal para duas pessoas.

Documentos de controle (obrigatórios e cumulativos):

- `diario.md` — histórico de desenvolvimento, decisões e resultados reais de teste.
- `banco.sql` — livro cumulativo de SQL para execução manual no Supabase.
- `Financial_Home_102026.pdf` — Mapa da Verdade (requisitos de referência).

## Requisitos

- Node.js 20+ (testado com Node 24) e npm 11+.
- Projeto Supabase (gratuito) para autenticação e banco.
- Conta Netlify + GitHub para deploy (Fase 7).

## Instalação

```bash
npm install
cp .env.example .env      # preencha com os dados do seu projeto Supabase
npm run dev
```

Sem `.env` válido a aplicação abre mostrando o estado real
("Supabase não configurado") — ela **não** simula dados.

## Variáveis de ambiente

| Variável | Obrigatória | Onde vive | Descrição |
|---|---|---|---|
| `VITE_SUPABASE_URL` | sim | frontend | URL do projeto Supabase (pública) |
| `VITE_SUPABASE_ANON_KEY` | sim | frontend | chave `anon` pública, protegida por RLS |
| `GROQ_API_KEY` | depois (F5) | **somente backend** | chave Groq; nunca com prefixo `VITE_` |
| `FH_GROQ_ENC_KEY` | depois (F5) | **somente backend** | chave de criptografia da chave Groq |

Nenhum segredo é aceito no bundle do frontend.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | typecheck + build de produção (`dist/`) |
| `npm run preview` | serve o build de produção |
| `npm run typecheck` | verifica tipos sem gerar saída |
| `npm run lint` | ESLint |
| `npm test` | testes (Vitest) |
| `node scripts/gen-icons.mjs` | regenera os ícones PNG da PWA |

## Banco de dados

1. Abra o Supabase SQL Editor.
2. Revise o bloco `FH-SQL-001` em `banco.sql`.
3. Execute o bloco inteiro **uma única vez**.
4. Rode as consultas de validação descritas no próprio bloco.
5. (Opcional) `supabase/migrations/` espelha os blocos para uso com CLI.

Nada é executado automaticamente no Supabase pelo projeto.

## Deploy (Netlify)

- Build: `npm run build`
- Publish: `dist`
- SPA redirect: configurado em `netlify.toml`
- Variáveis de produção: configure no painel do Netlify (não versionadas).

## IA com Groq (Edge Functions do Supabase)

O chat e a chave Groq exigem duas Edge Functions implantadas. Sem elas, a
tela do assistente mostra o estado real de "backend indisponível" — nada é
simulado.

Pré-requisitos: [Supabase CLI](https://supabase.com/docs/guides/cli),
`FH-SQL-005` executado, e uma chave de criptografia de 32 bytes:

```bash
# Gerar a chave de criptografia (guarde em local seguro, fora do Git)
openssl rand -base64 32

# Login + vínculo ao projeto
supabase login
supabase link --project-ref SEU-PROJECT-REF

# Segredos (nunca no repositório)
supabase secrets set GROQ_ENC_KEY="<base64-de-32-bytes>"
# SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY
# já existem no ambiente das funções automaticamente.

# Implantar
supabase functions deploy groq-chat
supabase functions deploy groq-config
```

Depois disso, o dono da casa define a chave em
Configurações → "Chave Groq (IA)": a chave é validada contra a API Groq
**antes** de ser salva (criptografada em `ai_config_fh`). A troca é feita
pela mesma tela, sem editar código.

**Chave exposta anteriormente:** se a chave Groq compartilhada no início do
projeto ainda estiver ativa em algum lugar, gere uma nova no painel da Groq
e troque pela tela de configurações (a antiga pode ser revogada na Groq).

## Automações (n8n)

O app funciona sem o n8n. Para conectar:

1. No n8n, crie um workflow com trigger **Webhook** (POST, JSON).
2. Na tela Assistente → Automações, salve a URL do webhook (somente o dono
   da casa).
3. Use "Enviar resumo agora" para testar — o app mostra o HTTP real.
4. O payload `digest.json` contém totais e próximos vencimentos (sem segredos);
   use "Copiar resumo JSON" para montar o workflow.

## Convenções

- Objetos de banco personalizados terminam em `_fh`.
- Recorrências financeiras sempre nascem **pendentes** e são idempotentes.
- Dados pessoais são protegidos por RLS, não apenas ocultos na interface.
