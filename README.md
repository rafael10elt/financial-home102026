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

## Convenções

- Objetos de banco personalizados terminam em `_fh`.
- Recorrências financeiras sempre nascem **pendentes** e são idempotentes.
- Dados pessoais são protegidos por RLS, não apenas ocultos na interface.
