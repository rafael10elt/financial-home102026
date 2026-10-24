// groq-chat — assistente da casa.
// Fluxo: mensagem -> Groq (com tools) -> executa rotina direta / propõe
// confirmação para ação sensível -> responde. Não executa SQL arbitrário;
// usa somente as tools abaixo, com escopo da casa validado no backend.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decryptText } from '../_shared/crypto.ts'
import { HttpError, jsonResponse, requireUser, serviceClient } from '../_shared/auth.ts'

type ChatBody =
  | { conversation_id: string; message: string }
  | { conversation_id: string; confirm_action_id: string }

type ToolDef = {
  name: string
  description: string
  sensitive: boolean
  parameters: Record<string, unknown>
}

const TOOLS: ToolDef[] = [
  {
    name: 'agenda_today',
    description: 'Lista eventos de hoje e próximos 7 dias da casa.',
    sensitive: false,
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'tasks_open',
    description: 'Lista tarefas abertas (opcional: somente vencidas).',
    sensitive: false,
    parameters: {
      type: 'object',
      properties: { overdue_only: { type: 'boolean' } },
    },
  },
  {
    name: 'finance_summary',
    description: 'Totais do mês atual por moeda e estado, mais pendentes e vencidos.',
    sensitive: false,
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'finance_pending',
    description: 'Lista lançamentos previstos/pendentes.',
    sensitive: false,
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'goals_progress',
    description: 'Metas com total guardado e objetivo.',
    sensitive: false,
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'moods_recent',
    description: 'Últimos humores registrados na casa.',
    sensitive: false,
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'household_search',
    description: 'Pesquisa registros salvos na casa por palavra ou frase, incluindo agenda, finanças, diário, dicas, recados e fofocas. Retorna somente registros compartilhados ou pessoais do perfil ativo.',
    sensitive: false,
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Palavra-chave ou frase curta. Se omitida, consulta registros recentes de cada área.' },
        area: { type: 'string', enum: ['all', 'agenda', 'finances', 'diary'], description: 'Área opcional; padrão all.' },
      },
    },
  },
  {
    name: 'task_create',
    description: 'Cria uma tarefa (rotina, reversível).',
    sensitive: false,
    parameters: {
      type: 'object',
      required: ['title'],
      properties: {
        title: { type: 'string' },
        due_at: { type: 'string', description: 'ISO com fuso, opcional' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
      },
    },
  },
  {
    name: 'reminder_create',
    description: 'Cria um lembrete com data/hora (rotina, reversível).',
    sensitive: false,
    parameters: {
      type: 'object',
      required: ['title', 'remind_at'],
      properties: { title: { type: 'string' }, remind_at: { type: 'string' } },
    },
  },
  {
    name: 'event_create',
    description: 'Cria um evento com início (rotina, reversível).',
    sensitive: false,
    parameters: {
      type: 'object',
      required: ['title', 'start_at'],
      properties: {
        title: { type: 'string' },
        start_at: { type: 'string' },
        end_at: { type: 'string' },
        location: { type: 'string' },
      },
    },
  },
  {
    name: 'mood_log',
    description: 'Registra o humor de hoje do usuário (substitui o do dia).',
    sensitive: false,
    parameters: {
      type: 'object',
      required: ['mood_name'],
      properties: { mood_name: { type: 'string' }, note: { type: 'string' } },
    },
  },
  {
    name: 'finance_transaction_create',
    description: 'Cria lançamento financeiro — SEMPRE pendente, nunca pago. Rotina.',
    sensitive: false,
    parameters: {
      type: 'object',
      required: ['kind', 'amount', 'description', 'account_id', 'date'],
      properties: {
        kind: { type: 'string', enum: ['income', 'expense'] },
        amount: { type: 'string', description: 'Decimal, ex "123.45"' },
        currency: { type: 'string', enum: ['EUR', 'BRL'] },
        description: { type: 'string' },
        account_id: { type: 'string' },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        category_id: { type: 'string' },
      },
    },
  },
  {
    name: 'finance_transaction_update',
    description: 'Altera lançamento (impacto financeiro): exige confirmação.',
    sensitive: true,
    parameters: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string' },
        status: { type: 'string', enum: ['previsto', 'pendente', 'pago', 'recebido', 'cancelado'] },
        amount: { type: 'string' },
        description: { type: 'string' },
        date: { type: 'string' },
      },
    },
  },
  {
    name: 'finance_transaction_delete',
    description: 'Exclui lançamento (destrutivo): exige confirmação.',
    sensitive: true,
    parameters: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
  },
]

function groqTools(): unknown[] {
  return TOOLS.map(({ name, description, parameters }) => ({
    type: 'function',
    function: { name, description, parameters },
  }))
}

function mapGroqError(status: number): string {
  if (status === 401) return 'INVALID_KEY'
  if (status === 429) return 'QUOTA_EXCEEDED'
  if (status === 404) return 'MODEL_NOT_SUPPORTED'
  if (status >= 500) return 'GROQ_UNAVAILABLE'
  return 'GROQ_ERROR'
}

async function callGroq(
  key: string,
  model: string,
  messages: { role: string; content: string; tool_calls?: unknown; tool_call_id?: string; name?: string }[],
): Promise<{ content: string; toolCalls: { id: string; name: string; args: Record<string, unknown> }[] }> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, messages, tools: groqTools(), tool_choice: 'auto', temperature: 0.7, max_completion_tokens: 1024 }),
  })
  if (!response.ok) {
    const error = new Error(mapGroqError(response.status)) as Error & { code?: string }
    error.code = mapGroqError(response.status)
    throw error
  }
  const payload = (await response.json()) as {
    choices?: { message?: { content?: string; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[]
  }
  const message = payload.choices?.[0]?.message
  const toolCalls = (message?.tool_calls ?? []).map((call) => {
    let args: Record<string, unknown>
    try {
      args = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>
    } catch {
      args = {}
    }
    return { id: call.id, name: call.function.name, args }
  })
  return { content: message?.content ?? '', toolCalls }
}

type Executor = {
  preview: (args: Record<string, unknown>) => Promise<string>
  run: (args: Record<string, unknown>) => Promise<unknown>
}

function canProfileSee(row: Record<string, unknown>, userId: string): boolean {
  if ('visibility' in row && row.visibility === 'personal') {
    return row.owner_id === userId || row.created_by === userId
  }
  // Some personal records (for example gossip) predate the visibility field.
  if (row.owner_id != null) return row.owner_id === userId || row.created_by === userId
  return true
}

function executors(
  userClient: SupabaseClient,
  householdId: string,
  userId: string,
): Record<string, Executor> {
  const read = async (table: string, build: (q: ReturnType<SupabaseClient['from']>) => ReturnType<SupabaseClient['from']>) => {
    const { data, error } = await build(
      userClient.from(table).select('*').eq('household_id', householdId) as ReturnType<SupabaseClient['from']>,
    )
    if (error) throw new Error(error.message)
    return ((data ?? []) as Record<string, unknown>[]).filter((row) => canProfileSee(row, userId))
  }

  const visibleAccountIds = async (): Promise<Set<string>> => {
    const { data, error } = await userClient
      .from('financial_accounts_fh')
      .select('id,visibility,owner_id,created_by')
      .eq('household_id', householdId)
    if (error) throw new Error(error.message)
    return new Set(((data ?? []) as Record<string, unknown>[])
      .filter((row) => canProfileSee(row, userId))
      .map((row) => String(row.id)))
  }

  const assertCanManageTransaction = async (id: string): Promise<void> => {
    const { data: transaction } = await userClient
      .from('financial_transactions_fh')
      .select('owner_id,created_by')
      .eq('id', id)
      .eq('household_id', householdId)
      .maybeSingle()
    if (!transaction) throw new Error('Lançamento não encontrado nesta casa.')
    const row = transaction as { owner_id: string | null; created_by: string | null }
    if (row.owner_id === userId || row.created_by === userId) return
    const { data: household } = await userClient
      .from('households_fh')
      .select('created_by')
      .eq('id', householdId)
      .maybeSingle()
    if ((household as { created_by?: string } | null)?.created_by !== userId) {
      throw new Error('Este lançamento pessoal pertence a outro perfil.')
    }
  }

  const searchHousehold = async (args: Record<string, unknown>) => {
    const term = String(args['query'] ?? '').trim().slice(0, 80).replace(/[\\%_*(),.]/g, ' ')
    const requestedArea = String(args['area'] ?? 'all')
    const area: 'all' | 'agenda' | 'finances' | 'diary' =
      requestedArea === 'agenda' || requestedArea === 'finances' || requestedArea === 'diary'
        ? requestedArea
        : 'all'
    const pattern = `%${term.trim()}%`
    const groups: Record<string, { table: string; columns: string; fields: string[] }[]> = {
      agenda: [
        { table: 'categories_fh', columns: 'id,domain,name,color,icon,created_at', fields: ['name', 'domain'] },
        { table: 'recurrence_rules_fh', columns: 'id,frequency,interval_n,days_of_week,start_date,end_date,occurrence_count,timezone,created_by,created_at', fields: ['frequency', 'timezone'] },
        { table: 'events_fh', columns: 'id,title,description,location,start_at,visibility,owner_id,created_by,created_at', fields: ['title', 'description', 'location'] },
        { table: 'tasks_fh', columns: 'id,title,notes,due_at,status,priority,visibility,owner_id,created_by,created_at', fields: ['title', 'notes'] },
        { table: 'reminders_fh', columns: 'id,title,notes,remind_at,visibility,owner_id,created_by,created_at', fields: ['title', 'notes'] },
      ],
      finances: [
        { table: 'financial_merchants_fh', columns: 'id,category_id,name,created_at', fields: ['name'] },
        { table: 'financial_accounts_fh', columns: 'id,name,type,currency,opening_balance,visibility,owner_id,created_by,created_at', fields: ['name', 'type'] },
        { table: 'financial_transactions_fh', columns: 'id,kind,amount,currency,status,description,date,account_id,merchant_id,owner_id,created_by,created_at', fields: ['description'] },
        { table: 'financial_recurrences_fh', columns: 'id,kind,amount,currency,description,frequency,start_date,end_date,active,owner_id,created_by,created_at', fields: ['description'] },
        { table: 'financial_transfers_fh', columns: 'id,from_account,to_account,amount,currency,to_amount,to_currency,fee,date,description,created_by,created_at', fields: ['description', 'currency', 'to_currency'] },
        { table: 'exchange_rates_fh', columns: 'id,base,target,rate,source,manual,fetched_at,created_at', fields: ['base', 'target', 'source'] },
        { table: 'financial_goals_fh', columns: 'id,name,target_amount,currency,deadline,visibility,owner_id,created_by,created_at', fields: ['name'] },
        { table: 'financial_imports_fh', columns: 'id,filename,source,status,row_count,accepted_count,rejected_count,created_by,created_at', fields: ['filename', 'source', 'status'] },
        { table: 'exchange_operations_fh', columns: 'id,from_amount,from_currency,to_amount,to_currency,fee,effective_rate,date,source,notes,created_by,created_at', fields: ['source', 'notes'] },
      ],
      diary: [
        { table: 'posts_fh', columns: 'id,title,body,memory_date,tags,visibility,owner_id,created_by,created_at', fields: ['title', 'body'] },
        { table: 'tips_fh', columns: 'id,title,body,visibility,owner_id,created_by,created_at', fields: ['title', 'body'] },
        { table: 'announcements_fh', columns: 'id,title,body,pinned,expires_at,created_at', fields: ['title', 'body'] },
        { table: 'gossip_fh', columns: 'id,title,body,owner_id,created_by,created_at', fields: ['title', 'body'] },
        { table: 'user_moods_fh', columns: 'id,date,note,user_id,moods_fh(name,emoji),created_at', fields: ['note'] },
      ],
    }
    const selected = area === 'all' ? [...groups.agenda, ...groups.finances, ...groups.diary] : groups[area]
    const accountIds = area === 'all' || area === 'finances' ? await visibleAccountIds() : new Set<string>()
    const results: Record<string, unknown[]> = {}
    await Promise.all(selected.map(async ({ table, columns, fields }) => {
      const conditions = fields.map((field) => `${field}.ilike.${pattern}`).join(',')
      let query = userClient
        .from(table)
        .select(columns)
        .eq('household_id', householdId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (term.trim()) query = query.or(conditions)
      const { data, error } = await query
      if (error) throw new Error(error.message)
      let rows = ((data ?? []) as Record<string, unknown>[]).filter((row) => canProfileSee(row, userId))
      if (table === 'financial_transactions_fh') {
        rows = rows.filter((row) => row.owner_id === userId || row.created_by === userId || accountIds.has(String(row.account_id)))
      }
      if (table === 'user_moods_fh') rows = rows.filter((row) => row.user_id === userId)
      if (table === 'financial_transfers_fh') {
        rows = rows.filter((row) => accountIds.has(String(row.from_account)) && accountIds.has(String(row.to_account)))
      }
      results[table] = rows.slice(0, 6).map((row) => Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 800) : value]),
      ))
    }))
    return { query: term.trim() || null, area, results }
  }

  return {
    agenda_today: {
      preview: async () => 'Consultar agenda dos próximos 7 dias.',
      run: async () => {
        const today = new Date().toISOString().slice(0, 10)
        const horizon = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)
        const [events, tasks, reminders] = await Promise.all([
          read('events_fh', (q) => q.gte('start_at', `${today}T00:00:00Z`).lte('start_at', `${horizon}T23:59:59Z`).order('start_at').limit(50) as ReturnType<SupabaseClient['from']>),
          read('tasks_fh', (q) => q.eq('status', 'open').order('due_at', { ascending: true, nullsFirst: false }).limit(50) as ReturnType<SupabaseClient['from']>),
          read('reminders_fh', (q) => q.is('dismissed_at', null).gte('remind_at', `${today}T00:00:00Z`).order('remind_at').limit(50) as ReturnType<SupabaseClient['from']>),
        ])
        return { events, tasks, reminders };
      },
    },
    tasks_open: {
      preview: async () => 'Listar tarefas abertas.',
      run: async (args) => {
        let query = userClient
          .from('tasks_fh')
          .select('id,title,due_at,priority,visibility,owner_id,created_by')
          .eq('household_id', householdId)
          .eq('status', 'open')
          .order('due_at', { ascending: true, nullsFirst: false })
          .limit(50)
        if (args['overdue_only']) query = query.lt('due_at', new Date().toISOString())
        const { data, error } = await query
        if (error) throw new Error(error.message)
        return ((data ?? []) as Record<string, unknown>[]).filter((row) => canProfileSee(row, userId))
      },
    },
    finance_summary: {
      preview: async () => 'Resumir finanças do mês.',
      run: async () => {
        const month = new Date().toISOString().slice(0, 8) + '01'
        const { data, error } = await userClient
          .from('financial_transactions_fh')
          .select('kind,amount,currency,status,date,account_id,owner_id,created_by')
          .eq('household_id', householdId)
          .gte('date', month)
          .neq('status', 'cancelado')
          .limit(1000)
        if (error) throw new Error(error.message)
        const accountIds = await visibleAccountIds()
        const totals: Record<string, number> = {}
        let pending = 0
        let overdue = 0
        const today = new Date().toISOString().slice(0, 10)
        for (const tx of (data ?? []) as (Record<string, unknown> & { kind: string; amount: string; currency: string; status: string; date: string })[]) {
          if (tx.owner_id !== userId && tx.created_by !== userId && !accountIds.has(String(tx.account_id))) continue
          const key = `${tx.kind}:${tx.currency}:${tx.status}`
          totals[key] = (totals[key] ?? 0) + Number(tx.amount)
          if (tx.status === 'previsto' || tx.status === 'pendente') {
            pending += 1
            if (tx.date < today) overdue += 1
          }
        }
        return { month, totals, pending, overdue }
      },
    },
    finance_pending: {
      preview: async () => 'Listar lançamentos previstos/pendentes.',
      run: async () => {
        const { data, error } = await userClient
          .from('financial_transactions_fh')
          .select('id,kind,amount,currency,status,description,date,account_id,owner_id,created_by')
          .eq('household_id', householdId)
          .in('status', ['previsto', 'pendente'])
          .order('date')
          .limit(50)
        if (error) throw new Error(error.message)
        const accountIds = await visibleAccountIds()
        return ((data ?? []) as Record<string, unknown>[]).filter((row) =>
          row.owner_id === userId || row.created_by === userId || accountIds.has(String(row.account_id)),
        )
      },
    },
    goals_progress: {
      preview: async () => 'Ver progresso das metas.',
      run: async () => {
        const { data: goals, error } = await userClient
          .from('financial_goals_fh')
          .select('id,name,target_amount,currency,visibility,owner_id,created_by')
          .eq('household_id', householdId)
          .limit(50)
        if (error) throw new Error(error.message)
        const out = []
        for (const goal of ((goals ?? []) as (Record<string, unknown> & { id: string; name: string; target_amount: string; currency: string })[])
          .filter((row) => canProfileSee(row, userId))) {
          const { data: contributions } = await userClient
            .from('goal_contributions_fh')
            .select('amount')
            .eq('goal_id', goal.id)
          const saved = ((contributions ?? []) as { amount: string }[]).reduce((s, c) => s + Number(c.amount), 0)
          out.push({ ...goal, saved })
        }
        return out
      },
    },
    moods_recent: {
      preview: async () => 'Ver humores recentes.',
      run: async () => {
        const { data, error } = await userClient
          .from('user_moods_fh')
          .select('date,note,user_id,moods_fh(name,emoji)')
          .eq('household_id', householdId)
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(10)
        if (error) throw new Error(error.message)
        return data ?? []
      },
    },
    household_search: {
      preview: async (args) => `Pesquisar na casa por “${String(args['query'] ?? '').slice(0, 80)}”.`,
      run: searchHousehold,
    },
    task_create: {
      preview: async (args) => `Criar tarefa "${String(args['title'] ?? '').slice(0, 80)}".`,
      run: async (args) => {
        const { data, error } = await userClient
          .from('tasks_fh')
          .insert({
            household_id: householdId,
            created_by: userId,
            title: String(args['title'] ?? '').slice(0, 120),
            due_at: (args['due_at'] as string | undefined) ?? null,
            priority: (args['priority'] as string | undefined) ?? 'medium',
            status: 'open',
            visibility: 'shared',
          })
          .select('id,title')
          .single()
        if (error) throw new Error(error.message)
        return data
      },
    },
    reminder_create: {
      preview: async (args) => `Criar lembrete "${String(args['title'] ?? '').slice(0, 80)}".`,
      run: async (args) => {
        if (!args['remind_at']) throw new Error('remind_at é obrigatório.')
        const { data, error } = await userClient
          .from('reminders_fh')
          .insert({
            household_id: householdId,
            created_by: userId,
            title: String(args['title'] ?? '').slice(0, 120),
            remind_at: args['remind_at'] as string,
            visibility: 'shared',
          })
          .select('id,title')
          .single()
        if (error) throw new Error(error.message)
        return data
      },
    },
    event_create: {
      preview: async (args) => `Criar evento "${String(args['title'] ?? '').slice(0, 80)}".`,
      run: async (args) => {
        if (!args['start_at']) throw new Error('start_at é obrigatório.')
        const { data, error } = await userClient
          .from('events_fh')
          .insert({
            household_id: householdId,
            created_by: userId,
            title: String(args['title'] ?? '').slice(0, 120),
            start_at: args['start_at'] as string,
            end_at: (args['end_at'] as string | undefined) ?? null,
            location: (args['location'] as string | undefined) ?? null,
            visibility: 'shared',
          })
          .select('id,title')
          .single()
        if (error) throw new Error(error.message)
        return data
      },
    },
    mood_log: {
      preview: async () => 'Registrar humor de hoje.',
      run: async (args) => {
        const today = new Date().toISOString().slice(0, 10)
        const wanted = String(args['mood_name'] ?? '').toLowerCase()
        const { data: moods } = await userClient
          .from('moods_fh')
          .select('id,name')
          .or(`household_id.is.null,household_id.eq.${householdId}`)
        const match = ((moods ?? []) as { id: string; name: string }[]).find((m) =>
          m.name.toLowerCase().includes(wanted),
        )
        if (!match) throw new Error(`Humor "${wanted}" não encontrado no catálogo.`)
        await userClient.from('user_moods_fh').delete().eq('user_id', userId).eq('date', today)
        const { data, error } = await userClient
          .from('user_moods_fh')
          .insert({
            user_id: userId,
            household_id: householdId,
            mood_id: match.id,
            note: (args['note'] as string | undefined) ?? null,
            date: today,
          })
          .select('id')
          .single()
        if (error) throw new Error(error.message)
        return { ...data, mood: match.name }
      },
    },
    finance_transaction_create: {
      preview: async (args) =>
        `Criar lançamento PENDENTE: ${args['kind']} ${args['amount']} (${args['description']}).`,
      run: async (args) => {
        for (const field of ['kind', 'amount', 'description', 'account_id', 'date'] as const) {
          if (!args[field]) throw new Error(`${field} é obrigatório.`)
        }
        const { data: account } = await userClient
          .from('financial_accounts_fh')
          .select('id')
          .eq('id', String(args['account_id']))
          .eq('household_id', householdId)
          .maybeSingle()
        if (!account) throw new Error('A conta informada não pertence a esta casa.')
        const { data, error } = await userClient
          .from('financial_transactions_fh')
          .insert({
            household_id: householdId,
            created_by: userId,
            account_id: args['account_id'] as string,
            kind: args['kind'] as string,
            amount: args['amount'] as string,
            currency: ((args['currency'] as string | undefined) ?? 'EUR'),
            status: 'pendente',
            description: String(args['description']).slice(0, 200),
            date: args['date'] as string,
            category_id: (args['category_id'] as string | undefined) ?? null,
          })
          .select('id,description')
          .single()
        if (error) throw new Error(error.message)
        return data
      },
    },
    finance_transaction_update: {
      preview: async (args) => {
        await assertCanManageTransaction(String(args['id'] ?? ''))
        const { data } = await userClient
          .from('financial_transactions_fh')
          .select('description,amount,status')
          .eq('id', String(args['id'] ?? ''))
          .eq('household_id', householdId)
          .maybeSingle()
        const before = (data ?? {}) as Record<string, unknown>
        return `Alterar lançamento "${String(before['description'] ?? args['id'])}" (${String(before['status'] ?? '?')}) com ${JSON.stringify(args)}.`;
      },
      run: async (args) => {
        await assertCanManageTransaction(String(args['id'] ?? ''))
        const patch: Record<string, unknown> = {}
        for (const field of ['status', 'amount', 'description', 'date'] as const) {
          if (args[field] !== undefined) patch[field] = args[field]
        }
        if (patch['status'] === 'pago' || patch['status'] === 'recebido') {
          patch['paid_at'] = new Date().toISOString()
        }
        const { data, error } = await userClient
          .from('financial_transactions_fh')
          .update(patch)
          .eq('id', String(args['id']))
          .eq('household_id', householdId)
          .select('id,status')
          .single()
        if (error) throw new Error(error.message)
        return data
      },
    },
    finance_transaction_delete: {
      preview: async (args) => {
        await assertCanManageTransaction(String(args['id'] ?? ''))
        const { data } = await userClient
          .from('financial_transactions_fh')
          .select('description,amount,status')
          .eq('id', String(args['id'] ?? ''))
          .eq('household_id', householdId)
          .maybeSingle()
        const row = (data ?? {}) as Record<string, unknown>
        return `EXCLUIR lançamento "${String(row['description'] ?? args['id'])}" (${String(row['amount'] ?? '?')}, ${String(row['status'] ?? '?')}).`;
      },
      run: async (args) => {
        await assertCanManageTransaction(String(args['id'] ?? ''))
        const { error } = await userClient
          .from('financial_transactions_fh')
          .delete()
          .eq('id', String(args['id']))
          .eq('household_id', householdId)
        if (error) throw new Error(error.message)
        return { deleted: args['id'] }
      },
    },
  }
}

const SYSTEM_PROMPT = `Você é a governanta digital do Financial Home: organizada, prestativa, rápida e levemente espirituosa. Conhece a rotina da casa e ajuda a mantê-la em ordem, sem comprometer precisão ou clareza.
Hoje é {{DATE}}. Idioma: português (Brasil), a menos que peçam inglês.
Use household_search para encontrar registros salvos em agenda, finanças, diário, dicas, recados e fofocas. Consulte somente os dados da casa desta conversa e respeite a visibilidade pessoal do perfil ativo.
Regras: consulte apenas os dados necessários via ferramentas; nunca invente valores; lançamentos financeiros criados por você nascem PENDENTES; para alterar/excluir lançamentos, chame a ferramenta (o sistema pede confirmação ao usuário, não você); se uma ferramenta falhar, informe o erro real sem mascarar.`

serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return jsonResponse({ ok: true })
  if (request.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405)

  try {
    const { user, userClient } = await requireUser(request)
    const service = serviceClient()
    const body = (await request.json()) as ChatBody
    const { conversation_id: conversationId } = body
    if (!conversationId) throw new HttpError(400, 'CONVERSATION_REQUIRED')

    const { data: conversation } = await service
      .from('ai_conversations_fh')
      .select('id,household_id,user_id')
      .eq('id', conversationId)
      .maybeSingle()
    const conv = conversation as { id: string; household_id: string; user_id: string } | null
    if (!conv || conv.user_id !== user.id) throw new HttpError(404, 'CONVERSATION_NOT_FOUND')
    const householdId = conv.household_id
    const { data: membership } = await service
      .from('household_members_fh')
      .select('user_id')
      .eq('household_id', householdId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!membership) throw new HttpError(404, 'CONVERSATION_NOT_FOUND')

    const { data: config } = await service
      .from('ai_config_fh')
      .select('encrypted_key,model')
      .eq('config_id', 'global')
      .maybeSingle()
    const cfg = config as { encrypted_key: string | null; model: string } | null
    // Chave global opcional no ambiente da Edge Function; nunca lê VITE_ nem
    // expõe segredo ao navegador. Configuração global criptografada tem prioridade.
    const groqKey = cfg?.encrypted_key
      ? await decryptText(cfg.encrypted_key)
      : Deno.env.get('GROQ_API_KEY')?.trim()
    if (!groqKey) return jsonResponse({ error: 'NO_KEY' }, 400)
    const model = cfg?.model ?? 'openai/gpt-oss-20b'

    const exec = executors(userClient, householdId, user.id)

    // --- Confirmação de ação sensível pendente ---
    if ('confirm_action_id' in body) {
      const { data: pending } = await service
        .from('ai_action_logs_fh')
        .select('*')
        .eq('id', (body as { confirm_action_id: string }).confirm_action_id)
        .eq('status', 'proposed')
        .maybeSingle()
      const action = pending as {
        id: string
        tool: string
        args: Record<string, unknown>
        conversation_id: string
      } | null
      if (!action || action.conversation_id !== conversationId) {
        throw new HttpError(404, 'ACTION_NOT_FOUND')
      }
      const def = TOOLS.find((t) => t.name === action.tool)
      if (!def || !exec[def.name]) throw new HttpError(400, 'UNKNOWN_TOOL')
      try {
        const output = await exec[def.name]!.run(action.args)
        await service.from('ai_action_logs_fh').update({ status: 'executed', result: output as Record<string, unknown> }).eq('id', action.id)
        await service.from('ai_messages_fh').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: `Feito! Ação "${def.name}" executada e confirmada no banco.`,
        })
        return jsonResponse({ reply: `Feito! Ação "${def.name}" executada e confirmada no banco.`, executed: action.id })
      } catch (toolError) {
        await service.from('ai_action_logs_fh').update({ status: 'error', result: { error: String(toolError) } }).eq('id', action.id)
        return jsonResponse({ error: 'TOOL_FAILED', detail: String(toolError) }, 400)
      }
    }

    // --- Nova mensagem ---
    const userMessage = (body as { message?: string }).message?.trim() ?? ''
    if (!userMessage) throw new HttpError(400, 'MESSAGE_REQUIRED')

    await service.from('ai_messages_fh').insert({ conversation_id: conversationId, role: 'user', content: userMessage })

    const { data: history } = await service
      .from('ai_messages_fh')
      .select('role,content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(20)
    const ordered = (((history ?? []) as { role: string; content: string }[]).reverse()).filter((m) =>
      ['user', 'assistant'].includes(m.role),
    )

    const { data: memories } = await service
      .from('ai_memories_fh')
          .select('content')
      .eq('household_id', householdId)
          .or(`user_id.is.null,user_id.eq.${user.id}`)
          .or(`user_id.is.null,user_id.eq.${user.id}`)
      .eq('active', true)
      .limit(20)
    const memoryBlock = (((memories ?? []) as { content: string }[]).map((m) => m.content).join('\n') || '(nenhuma)')

    const messages: { role: string; content: string; tool_calls?: unknown; tool_call_id?: string; name?: string }[] = [
      {
        role: 'system',
        content:
          SYSTEM_PROMPT.replace('{{DATE}}', new Date().toISOString().slice(0, 10)) +
          `\nMemória da casa:\n${memoryBlock}`,
      },
      ...ordered.map((m) => ({ role: m.role, content: m.content })),
    ]

    let finalReply = ''
    const confirmations: { action_id: string; tool: string; preview: string }[] = []

    for (let step = 0; step < 3; step += 1) {
      let groq: { content: string; toolCalls: { id: string; name: string; args: Record<string, unknown> }[] }
      try {
        groq = await callGroq(groqKey, model, messages)
      } catch (groqError) {
        const code = (groqError as Error & { code?: string }).code ?? 'GROQ_ERROR'
        return jsonResponse({ error: code }, code === 'GROQ_ERROR' ? 502 : 400)
      }
      if (groq.toolCalls.length === 0) {
        finalReply = groq.content || '(silêncio misterioso da IA — tente reformular.)'
        break
      }

      messages.push({
        role: 'assistant',
        content: groq.content,
        tool_calls: groq.toolCalls.map((call) => ({
          id: call.id,
          type: 'function',
          function: { name: call.name, arguments: JSON.stringify(call.args) },
        })),
      })

      for (const call of groq.toolCalls) {
        const def = TOOLS.find((t) => t.name === call.name)
        if (!def || !exec[def.name]) {
          messages.push({ role: 'tool', tool_call_id: call.id, name: call.name, content: JSON.stringify({ error: 'Ferramenta desconhecida.' }) })
          continue
        }
        if (def.sensitive) {
          const preview = await exec[def.name]!.preview(call.args)
          const { data: logged } = await service
            .from('ai_action_logs_fh')
            .insert({
              household_id: householdId,
              user_id: user.id,
              conversation_id: conversationId,
              tool: def.name,
              args: call.args,
              status: 'proposed',
            })
            .select('id')
            .single()
          const actionId = ((logged ?? {}) as { id?: string }).id ?? ''
          confirmations.push({ action_id: actionId, tool: def.name, preview })
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            name: call.name,
            content: JSON.stringify({ needs_confirmation: true, action_id: actionId, preview }),
          })
        } else {
          try {
            const output = await exec[def.name]!.run(call.args)
            await service.from('ai_action_logs_fh').insert({
              household_id: householdId,
              user_id: user.id,
              conversation_id: conversationId,
              tool: def.name,
              args: call.args,
              result: (typeof output === 'object' && output !== null ? output : { value: output }) as Record<string, unknown>,
              status: 'executed',
            })
            messages.push({ role: 'tool', tool_call_id: call.id, name: call.name, content: JSON.stringify(output).slice(0, 4000) })
          } catch (toolError) {
            messages.push({ role: 'tool', tool_call_id: call.id, name: call.name, content: JSON.stringify({ error: String(toolError) }) })
          }
        }
      }

      if (confirmations.length > 0) {
        finalReply = 'Preciso da sua confirmação antes de executar (veja os cartões abaixo). Nada foi alterado ainda.'
        break
      }
    }

    await service.from('ai_messages_fh').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: finalReply,
    })

    return jsonResponse({ reply: finalReply, confirmations })
  } catch (error) {
    if (error instanceof HttpError) return jsonResponse({ error: error.code }, error.status)
    console.error('[groq-chat]', error)
    return jsonResponse({ error: 'INTERNAL_ERROR' }, 500)
  }
})
