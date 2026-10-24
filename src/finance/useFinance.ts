import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useAuth } from '../auth/context'
import { useHousehold } from '../household/context'
import { duePeriods, type FinanceFrequency } from './frecurrence'
import { effectiveRate } from './exchange'

export type Account = {
  id: string
  household_id: string
  name: string
  type: 'checking' | 'savings' | 'cash' | 'other'
  currency: string
  opening_balance: string
  visibility: 'shared' | 'personal'
  owner_id: string | null
  created_by: string | null
}

export type Transaction = {
  id: string
  household_id: string
  account_id: string
  kind: 'income' | 'expense'
  amount: string
  currency: string
  status: 'previsto' | 'pendente' | 'pago' | 'recebido' | 'cancelado'
  description: string
  category_id: string | null
  merchant_id: string | null
  date: string
  paid_at: string | null
  owner_id: string | null
  created_by: string | null
  recurrence_id: string | null
  period_key: string | null
  installment_group: string | null
  installment_number: number | null
  installment_total: number | null
}

export type FRecurrence = {
  id: string
  household_id: string
  account_id: string
  kind: 'income' | 'expense'
  amount: string
  currency: string
  description: string
  category_id: string | null
  frequency: FinanceFrequency
  interval_n: number
  start_date: string
  end_date: string | null
  occurrence_count: number | null
  active: boolean
  owner_id: string | null
  created_by: string | null
}

export type Transfer = {
  id: string
  household_id: string
  from_account: string
  to_account: string
  amount: string
  currency: string
  to_amount: string | null
  to_currency: string | null
  fee: string
  date: string
  description: string | null
  created_by: string | null
}

export type Goal = {
  id: string
  household_id: string
  name: string
  target_amount: string
  currency: string
  deadline: string | null
  visibility: 'shared' | 'personal'
  owner_id: string | null
  created_by: string | null
}

export type Contribution = {
  id: string
  goal_id: string
  amount: string
  date: string
  note: string | null
  created_by: string | null
}

export type Rate = {
  id: string
  base: string
  target: string
  rate: string
  source: string
  manual: boolean
  fetched_at: string
}

export type Operation = {
  id: string
  from_amount: string
  from_currency: string
  to_amount: string
  to_currency: string
  fee: string
  effective_rate: string
  date: string
  source: string | null
  notes: string | null
}

export type FinanceCategory = {
  id: string
  household_id: string | null
  name: string
  kind: string | null
  color: string | null
}

export type FinanceMerchant = {
  id: string
  household_id: string
  category_id: string
  name: string
  created_by: string | null
}

const FINANCE_DEFAULTS: { name: string; kind: string; color: string }[] = [
  { name: 'Salário — Jess', kind: 'income', color: '#047857' },
  { name: 'Salário — Rafa', kind: 'income', color: '#047857' },
  { name: 'Job 1 — Jess', kind: 'income', color: '#059669' },
  { name: 'Job 1 — Rafa', kind: 'income', color: '#059669' },
  { name: 'Moradia', kind: 'expense', color: '#1d4ed8' },
  { name: 'Alimentação', kind: 'expense', color: '#b45309' },
  { name: 'Transporte', kind: 'expense', color: '#7c3aed' },
  { name: 'Saúde', kind: 'expense', color: '#be123c' },
  { name: 'Lazer', kind: 'expense', color: '#0e7490' },
  { name: 'Outros', kind: 'expense', color: '#5b6472' },
]

async function ensureFinanceCategories(
  supabase: SupabaseClient,
  householdId: string,
  userId: string,
): Promise<void> {
  const { data: existing } = await supabase
    .from('categories_fh')
    .select('id')
    .eq('household_id', householdId)
    .eq('domain', 'finance')
    .limit(1)
  // Only seed a brand-new household. Do not silently recreate categories the
  // user chose to delete on every page load.
  if ((existing ?? []).length > 0) return
  for (const category of FINANCE_DEFAULTS) {
    await supabase.from('categories_fh').insert(
      { ...category, domain: 'finance', household_id: householdId, created_by: userId },
    )
  }
}

function mapError(message: string): string {
  if (/row-level security/i.test(message)) return 'Sem permissão para esta operação.'
  if (/duplicate key|unique constraint/i.test(message)) return 'Registro equivalente já existe.'
  if (/violates (check|foreign key|not-null)/i.test(message)) return 'Dados inválidos para o banco.'
  if (/restrict/i.test(message)) return 'Há registros vinculados. Quite-os antes de excluir.'
  return message
}

export function useFinanceData() {
  const { supabase, user } = useAuth()
  const { state: householdState } = useHousehold()

  const householdId = householdState.kind === 'ready' ? householdState.household.id : null

  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [recurrences, setRecurrences] = useState<FRecurrence[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [rates, setRates] = useState<Rate[]>([])
  const [operations, setOperations] = useState<Operation[]>([])
  const [categories, setCategories] = useState<FinanceCategory[]>([])
  const [merchants, setMerchants] = useState<FinanceMerchant[]>([])
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      if (!supabase || !user || !householdId) {
        setStatus('idle')
        return
      }
      setStatus('loading')
      setError(null)
      void loadAll(supabase, user.id, householdId)
    })

    async function loadAll(
      client: NonNullable<typeof supabase>,
      userId: string,
      household: string,
    ) {
      try {
        await ensureFinanceCategories(client, household, userId)
        const [accs, txs, recs, trfs, gls, conts, rts, ops, cats, stores] = await Promise.all([
          client.from('financial_accounts_fh').select('*').eq('household_id', household).order('name').limit(100),
          client
            .from('financial_transactions_fh')
            .select('*')
            .eq('household_id', household)
            .order('date', { ascending: false })
            .limit(1000),
          client.from('financial_recurrences_fh').select('*').eq('household_id', household).limit(200),
          client
            .from('financial_transfers_fh')
            .select('*')
            .eq('household_id', household)
            .order('date', { ascending: false })
            .limit(200),
          client.from('financial_goals_fh').select('*').eq('household_id', household).limit(100),
          client.from('goal_contributions_fh').select('*').limit(1000),
          client
            .from('exchange_rates_fh')
            .select('id,base,target,rate,source,manual,fetched_at')
            .or(`household_id.is.null,household_id.eq.${household}`)
            .order('fetched_at', { ascending: false })
            .limit(100),
          client
            .from('exchange_operations_fh')
            .select('*')
            .eq('household_id', household)
            .order('date', { ascending: false })
            .limit(200),
          client
            .from('categories_fh')
            .select('id,household_id,name,kind,color')
            .eq('domain', 'finance')
            .or(`household_id.is.null,household_id.eq.${household}`)
            .order('name'),
          client.from('financial_merchants_fh').select('*').eq('household_id', household).order('name'),
        ])
        if (cancelled) return
        const firstError =
          accs.error ?? txs.error ?? recs.error ?? trfs.error ?? gls.error ?? conts.error ?? rts.error ?? ops.error ?? cats.error ?? stores.error
        if (firstError) {
          setError(firstError.message)
          setStatus('error')
          return
        }
        setAccounts((accs.data ?? []) as Account[])
        setTransactions((txs.data ?? []) as Transaction[])
        setRecurrences((recs.data ?? []) as FRecurrence[])
        setTransfers((trfs.data ?? []) as Transfer[])
        setGoals((gls.data ?? []) as Goal[])
        setContributions((conts.data ?? []) as Contribution[])
        setRates((rts.data ?? []) as Rate[])
        setOperations((ops.data ?? []) as Operation[])
        setCategories((cats.data ?? []) as FinanceCategory[])
        setMerchants((stores.data ?? []) as FinanceMerchant[])
        setStatus('ready')
      } catch (unknownError) {
        if (!cancelled) {
          setError(unknownError instanceof Error ? unknownError.message : String(unknownError))
          setStatus('error')
        }
      }
    }

    return () => {
      cancelled = true
    }
  }, [supabase, user, householdId, reloadToken])

  async function audit(
    client: SupabaseClient,
    household: string,
    userId: string,
    entity: string,
    entityId: string,
    action: string,
    before: unknown,
    after: unknown,
  ): Promise<void> {
    await client.from('audit_logs_fh').insert({
      household_id: household,
      user_id: userId,
      entity,
      entity_id: entityId,
      action,
      before: before ?? null,
      after: after ?? null,
    })
  }

  async function insert(table: string, payload: Record<string, unknown>) {
    if (!supabase || !user || !householdId) return { error: 'Supabase não configurado.', id: null as string | null }
    const { data, error: insertError } = await supabase
      .from(table)
      .insert({ ...payload, household_id: householdId, created_by: user.id })
      .select('id')
      .single()
    if (insertError) return { error: mapError(insertError.message), id: null }
    reload()
    return { error: null, id: (data as { id: string }).id }
  }

  async function update(table: string, id: string, payload: Record<string, unknown>, auditEntity?: string, before?: unknown) {
    if (!supabase || !user || !householdId) return { error: 'Supabase não configurado.' }
    const { error: updateError } = await supabase.from(table).update(payload).eq('id', id)
    if (updateError) return { error: mapError(updateError.message) }
    if (auditEntity) {
      await audit(supabase, householdId, user.id, auditEntity, id, 'update', before ?? null, payload)
    }
    reload()
    return { error: null }
  }

  async function remove(table: string, id: string, auditEntity?: string, before?: unknown) {
    if (!supabase || !user || !householdId) return { error: 'Supabase não configurado.' }
    const { error: deleteError } = await supabase.from(table).delete().eq('id', id)
    if (deleteError) return { error: mapError(deleteError.message) }
    if (auditEntity) {
      await audit(supabase, householdId, user.id, auditEntity, id, 'delete', before ?? null, null)
    }
    reload()
    return { error: null }
  }

  /** Gera lançamentos PENDENTES até o horizonte. Idempotente por (recurrence_id, period_key). */
  async function generateRecurrences(horizon: string) {
    if (!supabase || !user || !householdId) return { error: 'Supabase não configurado.', created: 0 }
    let created = 0
    for (const recurrence of recurrences) {
      if (!recurrence.active) continue
      const { data: existing } = await supabase
        .from('financial_transactions_fh')
        .select('period_key')
        .eq('recurrence_id', recurrence.id)
      const existingKeys = new Set(((existing ?? []) as { period_key: string | null }[]).map((row) => row.period_key ?? ''))
      const periods = duePeriods(
        {
          frequency: recurrence.frequency,
          interval_n: recurrence.interval_n,
          start_date: recurrence.start_date,
          end_date: recurrence.end_date,
          occurrence_count: recurrence.occurrence_count,
          active: recurrence.active,
        },
        horizon,
        existingKeys,
      )
      for (const period of periods) {
        const { error: insertError } = await supabase.from('financial_transactions_fh').insert({
          household_id: householdId,
          created_by: user.id,
          account_id: recurrence.account_id,
          kind: recurrence.kind,
          amount: recurrence.amount,
          currency: recurrence.currency,
          status: 'pendente',
          description: recurrence.description,
          category_id: recurrence.category_id,
          date: period.date,
          owner_id: recurrence.owner_id,
          recurrence_id: recurrence.id,
          period_key: period.period_key,
        })
        // Conflito de unicidade = outro processo já gerou; ignora.
        if (!insertError) created += 1
        else if (!/duplicate key|unique constraint/i.test(insertError.message)) {
          return { error: mapError(insertError.message), created }
        }
      }
    }
    reload()
    return { error: null, created }
  }

  async function recordOperation(input: {
    from_amount: string
    from_currency: string
    to_amount: string
    to_currency: string
    fee?: string
    date: string
    source?: string
    notes?: string
  }) {
    const rate = effectiveRate(Number(input.from_amount), Number(input.to_amount))
    return insert('exchange_operations_fh', {
      ...input,
      fee: input.fee ?? '0',
      effective_rate: rate.toFixed(6),
    })
  }

  return {
    status,
    error,
    accounts,
    transactions,
    recurrences,
    transfers,
    goals,
    contributions,
    rates,
    operations,
    categories,
    merchants,
    householdId,
    reload,
    insert,
    update,
    remove,
    generateRecurrences,
    recordOperation,
  }
}
