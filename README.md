# Financial Home 102026

PWA privado de organização doméstica, financeira e pessoal para duas pessoas.

Documentos de controle (obrigatórios e cumulativos):

- `diario.md` — histórico de desenvolvimento, decisões e resultados reais de teste.
- `banco.sql` — livro cumulativo de SQL para execução manual no Supabase.
- `Financial_Home_102026.pdf` — Mapa da Verdade (requisitos de referência).

## Requisitos

- Node.js 20+ (testado com Node 24) e npm 11+.
- Projeto Supabase (Postgres + Storage). Não é preciso configurar Supabase Auth.
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
| `VITE_SUPABASE_ANON_KEY` | sim | frontend | chave pública do projeto; políticas RLS aceitam o perfil selecionado pelo app |
| `VITE_PROFILES` | não | frontend | nomes separados por vírgula na tela de seleção; padrão `Jéssica,Rafael` |
| `GROQ_API_KEY` | depois (F5) | **somente backend** | chave Groq; nunca com prefixo `VITE_` |
| `GROQ_ENC_KEY` | opcional (F5) | **somente backend** | chave de criptografia de 32 bytes para armazenar chave Groq por casa |

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
2. Para uma instalação nova, cole e execute o conteúdo completo do `banco.sql`.
   O arquivo cria o esquema, as políticas RLS e os perfis Jéssica e Rafael.
3. Rode as consultas de validação descritas no próprio arquivo.

Nada é executado automaticamente no Supabase pelo projeto.

### Entrada por perfil

Na tela inicial, escolha um nome. O app consulta a linha correspondente em
`profiles_fh` e guarda o UUID localmente; não chama Supabase Auth. O SQL inicial
cria Jéssica e Rafael. Para adicionar perfis, insira uma linha em `profiles_fh`
e adicione o nome em `VITE_PROFILES`.

Depois de apagar o banco, rode o arquivo `banco.sql` inteiro uma única vez.
Não é necessário habilitar provedores, criar usuários ou executar um SQL extra.
Confira se `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` apontam para o mesmo
projeto em que o SQL foi executado. Para instalação/recriação, use `banco.sql`;
os arquivos antigos em `supabase/migrations/` ainda descrevem o fluxo anterior
com Supabase Auth e não devem ser aplicados neste setup simplificado.

**Atenção:** esse método é identificação simples, não autenticação segura. O
navegador envia o UUID do perfil em `x-profile-id`, e o banco usa esse valor nas
políticas RLS; qualquer pessoa pode alterá-lo e assumir outro perfil. Use apenas
na rede e no grupo interno pretendidos, sem dados que exijam controle de acesso.

## Deploy (Netlify)

- Build: `npm run build`
- Publish: `dist`
- SPA redirect: configurado em `netlify.toml`
- Variáveis de produção: configure no painel do Netlify (não versionadas).

## IA com Groq (Edge Functions do Supabase)

O chat e a chave Groq exigem duas Edge Functions implantadas. Sem elas, a
tela do assistente mostra o estado real de "backend indisponível" — nada é
simulado.

O chat já está implementado. Para usar a chave global guardada no `.env`, copie-a
para os segredos das Edge Functions (o Vite nunca envia `GROQ_API_KEY` ao
navegador) e publique as funções:

```powershell
supabase login
supabase link --project-ref SEU-PROJECT-REF
supabase secrets set GROQ_API_KEY="COLE_A_CHAVE_GROQ_AQUI"
supabase functions deploy groq-chat
supabase functions deploy groq-config
```

Execute também o bloco `FH-SQL-005` em `banco.sql` se ainda não tiver aplicado
as tabelas do assistente. A chave configurada como segredo do projeto é
compartilhada pelas casas atendidas por essas funções; a chave salva pela tela
Configurações → IA é por casa e fica criptografada no banco.

Para armazenar uma chave por casa na interface, além do `FH-SQL-005` e das
funções publicadas, configure `GROQ_ENC_KEY` como segredo de 32 bytes:

```bash
# Gerar a chave de criptografia (guarde em local seguro, fora do Git)
openssl rand -base64 32

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
