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
| `GROQ_ENC_KEY` | IA | **somente backend** | chave global de criptografia (32 bytes) para proteger a chave Groq compartilhada |

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

Para atualizar um banco já existente e permitir que todos os membros da casa
editem os mesmos registros financeiros, execute somente o bloco `FH-SQL-014`
no final de `banco.sql` pelo SQL Editor do projeto Supabase ativo. Esse bloco
altera apenas as policies RLS financeiras e não modifica os dados existentes.

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

O assistente atua como governanta digital. Ao responder sobre dados salvos,
consulta por ferramentas autorizadas a agenda, finanças, diário, dicas, recados
e outros registros da casa. As buscas respeitam a casa da conversa e mostram
registros pessoais somente ao perfil correspondente; não há SQL livre nem
envio automático do banco inteiro. Os trechos necessários à resposta são
enviados à Groq para processamento.

Para a chave digitada em Configurações → IA, publique as funções e defina
`GROQ_ENC_KEY` (32 bytes em base64) como segredo antes de salvar. A chave Groq
é validada pela função e criptografada uma vez numa configuração global. Todos
os perfis e casas usam a mesma chave; só o dono da casa pode substituí-la.
`GROQ_API_KEY` é opcional como fallback global e não é lida do `.env` do frontend:

```powershell
supabase login
supabase link --project-ref SEU-PROJECT-REF
# Gere uma única vez e guarde em local seguro, fora do Git:
openssl rand -base64 32
# Só configure se GROQ_ENC_KEY ainda não existir no projeto. Se já existir,
# mantenha exatamente o mesmo valor para continuar lendo a chave criptografada:
supabase secrets set GROQ_ENC_KEY="<base64-de-32-bytes>"
# SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY
# já existem no ambiente das funções automaticamente.
supabase functions deploy groq-chat
supabase functions deploy groq-config
```

Se o banco já foi criado com a versão anterior, execute somente o bloco
`FH-SQL-009` no fim de `banco.sql`; ele consolida as configurações por casa
na chave mais recentemente atualizada. Em banco limpo, o SQL completo já cria
o formato global. `GROQ_ENC_KEY` é uma chave técnica separada da chave Groq;
mantenha-a guardada, pois sem ela a chave criptografada não poderá ser lida.

Depois disso, o dono da casa define a chave em
Configurações → "Chave Groq (IA)": a chave é validada contra a API Groq
**antes** de ser salva (criptografada em `ai_config_fh`). Todos os perfis
passam a usá-la; substituí-la nessa tela atualiza a chave para todos.

**Chave exposta anteriormente:** se a chave Groq compartilhada no início do
projeto ainda estiver ativa em algum lugar, gere uma nova no painel da Groq
e troque pela tela de configurações (a antiga pode ser revogada na Groq).

### Respostas, confirmações e erros

As respostas do chat renderizam Markdown seguro (títulos, listas, negrito,
links e tabelas compactas) para manter resumos e listas legíveis em celular.
A governanta deve priorizar texto direto, valores formatados e observações
baseadas em dados reais, sem expor IDs técnicos. Ações propostas são revisadas
num modal antes de executar; erros e confirmações relevantes aparecem também
como toast.

Para atualizar o prompt e as regras de resposta na função, execute na raiz:

```powershell
supabase functions deploy groq-chat
```

### Verificação final local

Na validação desta rodada, estes comandos foram executados:

```powershell
npm test -- --maxWorkers=1 --fileParallelism=false
npm run lint
npm run build
npm audit
```

Antes de liberar uma versão, ainda confirme manualmente no ambiente de produção:

- publique `groq-chat` e valide uma consulta e um resumo com dados conhecidos;
- entre com os dois perfis e verifique permissões e visibilidade pessoal;
- confira as migrações pendentes no Supabase e faça/valide um backup antes de
  alterações destrutivas;
- publique no Netlify e verifique instalação PWA, comportamento offline e
  telas mobile.

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

## Fluxos recentes

- O campo de modelo em Configurações → IA é uma lista de modelos Groq
  compatíveis com ferramentas. Para substituir somente o modelo já salvo,
  escolha uma opção e use **Salvar modelo**; o backend usa a chave criptografada
  e faz uma chamada de chat com ferramenta antes de gravar a alteração.
- Em Finanças → Categorias, gerencie categorias da casa e os estabelecimentos
  associados (por exemplo, Mercado → Tesco). Em banco existente, execute somente
  o bloco **FH-SQL-010** ao fim de `banco.sql` antes de usar a versão nova.
- Na Visão geral, os atalhos fixos abrem um lançamento de despesa ou o assistente.
