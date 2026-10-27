import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '../../i18n'
import { useAuth } from '../../auth/context'
import { useHousehold } from '../../household/context'
import {
  useFinanceData,
  type Account,
  type Goal,
  type Transaction,
} from '../../finance/useFinance'
import { accountBalance, consolidate, groupBy, type Quote } from '../../finance/reports'
import { fromMinorUnits, formatMoney, toMinorUnits } from '../../finance/money'
import { Button } from '../../ui/Button'
import { Card, CardDescription, CardTitle } from '../../ui/Card'
import { Modal } from '../../ui/Modal'
import {
  AccountDialog,
  ContributeDialog,
  GoalDialog,
  OperationDialog,
  RateDialog,
  RecurrenceDialog,
  TransactionDialog,
  TransferDialog,
} from './FinanceDialogs'
import { ImportWizard } from './ImportWizard'
import { FinanceCategoriesPanel } from './FinanceCategoriesPanel'
import { useToast } from '../../ui/toastContext'
import { useLiveRates } from '../../finance/useLiveRates'
import { CashflowChart, CategoryDonutChart, ExchangeRateWidget } from './FinanceDashboardCharts'
import { DashboardWidgetsDialog, type FinanceWidgetId, type FinanceWidgetLayout } from './DashboardWidgetsDialog'

type Tab = 'summary' | 'transactions' | 'categories' | 'recurrences' | 'transfers' | 'goals' | 'exchange' | 'import'
const defaultWidgetLayout: FinanceWidgetLayout = {
  order: ['metrics', 'flow', 'categoryDonut', 'accounts', 'byCategory', 'byPerson', 'exchange'],
  hidden: [],
}

function dashboardStorageKey(profileId: string | undefined): string {
  return `fh.finance.dashboard.v1:${profileId ?? 'guest'}`
}

function loadDashboardLayout(profileId: string | undefined): FinanceWidgetLayout {
  try {
    const stored = localStorage.getItem(dashboardStorageKey(profileId))
    if (!stored) return defaultWidgetLayout
    const parsed = JSON.parse(stored) as FinanceWidgetLayout
    const ids = new Set(defaultWidgetLayout.order)
    const order = [...new Set(parsed.order)].filter((id) => ids.has(id))
    for (const id of defaultWidgetLayout.order) if (!order.includes(id)) order.push(id)
    return { order, hidden: [...new Set(parsed.hidden ?? [])].filter((id) => ids.has(id)) }
  } catch {
    return defaultWidgetLayout
  }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso
}

function localDateKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function yearAhead(): string {
  const now = new Date()
  const end = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
  return localDateKey(end)
}

function currentMonthRange(): { start: string; end: string } {
  const now = new Date()
  return {
    start: localDateKey(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: localDateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  }
}

export function FinancePage() {
  const { t, locale } = useI18n()
  const { notify } = useToast()
  const { user } = useAuth()
  const { state: householdState } = useHousehold()
  const finance = useFinanceData()
  const liveRates = useLiveRates()

  const [tab, setTab] = useState<Tab>('summary')
  const [periodStart, setPeriodStart] = useState(() => currentMonthRange().start)
  const [periodEnd, setPeriodEnd] = useState(() => currentMonthRange().end)
  const [dialog, setDialog] = useState<
    | { name: 'account'; editing: Account | null }
    | { name: 'transaction'; editing: Transaction | null; kind: 'income' | 'expense' }
    | { name: 'recurrence'; editing: import('../../finance/useFinance').FRecurrence | null }
    | { name: 'transfer' }
    | { name: 'goal'; editing: Goal | null }
    | { name: 'contribute'; goalId: string }
    | { name: 'rate' }
    | { name: 'operation' }
    | { name: 'import' }
    | null
  >(null)
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ table: string; id: string; before: unknown } | null>(null)
  const [filterAccount, setFilterAccount] = useState('')
  const [filterKind, setFilterKind] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [transactionsFrom, setTransactionsFrom] = useState(() => currentMonthRange().start)
  const [transactionsTo, setTransactionsTo] = useState(() => currentMonthRange().end)
  const [widgetLayout, setWidgetLayout] = useState<FinanceWidgetLayout>(() => loadDashboardLayout(user?.id))
  const [customizeWidgets, setCustomizeWidgets] = useState(false)
  const widgetProfileRef = useRef(user?.id)

  useEffect(() => {
    if (widgetProfileRef.current === user?.id) return
    widgetProfileRef.current = user?.id
    setWidgetLayout(loadDashboardLayout(user?.id))
  }, [user?.id])

  useEffect(() => {
    if (widgetProfileRef.current !== user?.id) return
    try { localStorage.setItem(dashboardStorageKey(user?.id), JSON.stringify(widgetLayout)) } catch { /* armazenamento local opcional */ }
  }, [user?.id, widgetLayout])

  const members =
    householdState.kind === 'ready'
      ? householdState.members.map((m) => ({ user_id: m.user_id, display_name: m.display_name }))
      : []

  const memberName = (userId: string | null) => {
    if (!userId) return t('fin.unassigned')
    if (userId === user?.id) return 'você'
    return members.find((m) => m.user_id === userId)?.display_name ?? userId.slice(0, 8)
  }

  const categoryName = (categoryId: string | null) =>
    finance.categories.find((c) => c.id === categoryId)?.name ?? t('fin.noCategory')

  const accountName = (accountId: string) =>
    finance.accounts.find((a) => a.id === accountId)?.name ?? accountId.slice(0, 8)

  const quotes = useMemo(() => {
    const map = new Map<string, Quote>()
    for (const rate of finance.rates) {
      const key = `${rate.base}->${rate.target}`
      if (!map.has(key)) {
        map.set(key, {
          base: rate.base,
          target: rate.target,
          rate: Number(rate.rate),
          source: rate.manual ? `${rate.source} (${t('fin.manual')})` : rate.source,
          fetchedAt: rate.fetched_at,
          manual: rate.manual,
        })
      }
    }
    for (const [key, rate] of Object.entries(liveRates.quotes)) {
      if (!map.has(key)) map.set(key, rate)
    }
    return map
  }, [finance.rates, liveRates.quotes, t])

  const periodTxs = useMemo(() => {
    return finance.transactions.filter((tx) => tx.date >= periodStart && tx.date <= periodEnd)
  }, [finance.transactions, periodStart, periodEnd])

  const consolidation = useMemo(() => {
    try {
      return {
        data: consolidate(
          periodTxs.map((tx) => ({
            id: tx.id,
            kind: tx.kind,
            amount: tx.amount,
            currency: tx.currency,
            status: tx.status,
            date: tx.date,
            category_id: tx.category_id,
            owner_id: tx.owner_id,
            account_id: tx.account_id,
          })),
          'EUR',
          quotes,
          todayKey(),
        ),
        error: null as string | null,
      }
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : String(error) }
    }
  }, [periodTxs, quotes])

  const expenseByCategory = useMemo(() => {
    try {
      const groups = groupBy(
        periodTxs.filter((tx) => tx.kind === 'expense' && tx.status === 'pago').map(toReportTx),
        'category_id', 'EUR', quotes,
      )
      return [...groups.entries()].map(([id, total]) => ({
        name: id === 'sem-grupo' ? t('fin.noCategory') : categoryName(id),
        minor: Math.abs(total.minor),
      })).filter((entry) => entry.minor > 0).sort((a, b) => b.minor - a.minor)
    } catch { return [] }
  }, [periodTxs, quotes, finance.categories, t])

  const groupedByCategory = useMemo(() => {
    try { return groupBy(periodTxs.map(toReportTx), 'category_id', 'EUR', quotes) }
    catch { return new Map() }
  }, [periodTxs, quotes])
  const groupedByPerson = useMemo(() => {
    try { return groupBy(periodTxs.map(toReportTx), 'owner_id', 'EUR', quotes) }
    catch { return new Map() }
  }, [periodTxs, quotes])

  const filteredTxs = useMemo(
    () =>
      finance.transactions.filter((tx) => {
        if (transactionsFrom && tx.date < transactionsFrom) return false
        if (transactionsTo && tx.date > transactionsTo) return false
        if (filterAccount && tx.account_id !== filterAccount) return false
        if (filterKind && tx.kind !== filterKind) return false
        if (filterStatus && tx.status !== filterStatus) return false
        return true
      }),
    [finance.transactions, filterAccount, filterKind, filterStatus, transactionsFrom, transactionsTo],
  )

  const transactionMonths = useMemo(() => {
    const groups = new Map<string, Transaction[]>()
    const ordered = [...filteredTxs].sort((a, b) => {
      const aPending = a.status === 'pendente' || a.status === 'previsto'
      const bPending = b.status === 'pendente' || b.status === 'previsto'
      if (aPending !== bPending) return aPending ? -1 : 1
      if (aPending) return a.date.localeCompare(b.date) || a.description.localeCompare(b.description)
      return b.date.localeCompare(a.date) || a.description.localeCompare(b.description)
    })
    for (const tx of ordered) {
      const month = tx.date.slice(0, 7)
      const group = groups.get(month) ?? []
      group.push(tx)
      groups.set(month, group)
    }
    return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([month, transactions]) => {
      const byKind = {
        expense: { count: 0, pendingCount: 0, paidCount: 0, pendingTotals: new Map<string, number>(), paidTotals: new Map<string, number>() },
        income: { count: 0, pendingCount: 0, paidCount: 0, pendingTotals: new Map<string, number>(), paidTotals: new Map<string, number>() },
      }
      for (const tx of transactions) {
        const summary = byKind[tx.kind]
        summary.count += 1
        const isPending = tx.status === 'pendente' || tx.status === 'previsto' || tx.status === 'vencido'
        const isPaid = tx.status === 'pago' || tx.status === 'recebido'
        if (!isPending && !isPaid) continue
        const totals = isPending ? summary.pendingTotals : summary.paidTotals
        totals.set(tx.currency, (totals.get(tx.currency) ?? 0) + toMinorUnits(tx.amount, tx.currency))
        if (isPending) summary.pendingCount += 1
        else summary.paidCount += 1
      }
      return { month, transactions, byKind }
    })
  }, [filteredTxs])

  async function handleSave(table: string, values: Record<string, unknown>, editingId: string | null, auditEntity?: string, before?: unknown) {
    setBusy(true)
    setServerError(null)
    setNotice(null)
    const result = editingId
      ? await finance.update(table, editingId, values, auditEntity, before)
      : await finance.insert(table, values)
    setBusy(false)
    if (result.error) {
      setServerError(t('fin.saveError', { message: result.error }))
      return
    }
    setDialog(null)
  }

  async function handleDelete() {
    if (!confirmDelete) return
    setBusy(true)
    const result = confirmDelete.table === 'financial_recurrences_fh'
      ? await finance.deleteRecurrence(confirmDelete.before as import('../../finance/useFinance').FRecurrence)
      : await finance.remove(confirmDelete.table, confirmDelete.id, confirmDelete.table, confirmDelete.before)
    setBusy(false)
    setConfirmDelete(null)
    if (result.error) {
      setServerError(t('fin.saveError', { message: result.error }))
      notify('error', t('common.error', { message: '' }), result.error)
    } else if (confirmDelete.table === 'financial_recurrences_fh') {
      notify('success', t('fin.recurrence'), t('fin.recurrenceDeleted'))
    }
  }

  async function handleStatus(tx: Transaction, status: 'pago' | 'recebido' | 'cancelado') {
    setBusy(true)
    const result = await finance.update(
      'financial_transactions_fh',
      tx.id,
      {
        status,
        paid_at: status === 'cancelado' ? null : (tx.paid_at ?? new Date().toISOString()),
      },
      'financial_transactions_fh',
      { id: tx.id, status: tx.status },
    )
    setBusy(false)
    if (result.error) setServerError(t('fin.saveError', { message: result.error }))
  }

  async function handleGenerate() {
    setBusy(true)
    setNotice(null)
    const result = await finance.generateRecurrences(yearAhead())
    setBusy(false)
    if (result.error) {
      setServerError(t('fin.saveError', { message: result.error }))
    } else {
      setNotice(t('fin.generated', { n: result.created }))
      notify('success', t('fin.generate'), t('fin.generated', { n: result.created }))
    }
  }

  async function handleSaveRecurrence(values: Record<string, unknown>, editing: import('../../finance/useFinance').FRecurrence | null) {
    setBusy(true)
    setServerError(null)
    const result = await finance.saveRecurrence(values, editing?.id ?? null, yearAhead())
    setBusy(false)
    if (result.error) {
      setServerError(t('fin.saveError', { message: result.error }))
      notify('error', t('common.error', { message: '' }), result.error)
      return
    }
    setDialog(null)
    notify('success', t('fin.newRecurrence'), t('fin.recurrenceSaved'))
  }

  async function handleRecurrenceActive(recurrence: import('../../finance/useFinance').FRecurrence) {
    setBusy(true)
    const result = await finance.setRecurrenceActive(recurrence, !recurrence.active)
    setBusy(false)
    if (result.error) {
      setServerError(t('fin.saveError', { message: result.error }))
      notify('error', t('common.error', { message: '' }), result.error)
    } else {
      notify('success', t('fin.recurrence'), recurrence.active ? t('fin.recurrencePaused') : t('fin.recurrenceResumed'))
    }
  }

  async function handleImport(input: {
    filename: string
    source: 'csv' | 'pdf'
    accountId: string
    rows: { date: string; description: string; amountMinor: number; currency: string; kind: 'income' | 'expense' }[]
  }) {
    setBusy(true)
    setServerError(null)
    try {
      const created = await finance.insert('financial_imports_fh', {
        filename: input.filename,
        source: input.source,
        status: 'reviewing',
        row_count: input.rows.length,
      })
      if (created.error || !created.id) {
        setServerError(t('fin.saveError', { message: created.error ?? '' }))
        return
      }
      let accepted = 0
      for (let index = 0; index < input.rows.length; index += 1) {
        const row = input.rows[index] as (typeof input.rows)[number]
        if (!row || !row.date || !row.description) continue
        const rowRes = await finance.insert('financial_import_rows_fh', {
          import_id: created.id,
          line_no: index + 1,
          date: row.date,
          description: row.description.slice(0, 200),
          amount: fromMinorUnits(row.amountMinor, row.currency),
          currency: row.currency,
          status: 'accepted',
        })
        if (rowRes.error || !rowRes.id) continue
        const txRes = await finance.insert('financial_transactions_fh', {
          account_id: input.accountId,
          kind: row.kind,
          amount: fromMinorUnits(row.amountMinor, row.currency),
          currency: row.currency,
          status: 'pendente',
          description: row.description.slice(0, 200),
          date: row.date,
          import_row_id: rowRes.id,
        })
        if (!txRes.error) accepted += 1
      }
      await finance.update('financial_imports_fh', created.id, {
        status: accepted === input.rows.length ? 'imported' : 'partially',
        accepted_count: accepted,
        rejected_count: input.rows.length - accepted,
      })
      setNotice(t('fin.generated', { n: accepted }))
      setDialog(null)
    } finally {
      setBusy(false)
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'summary', label: t('fin.tabs.summary') },
    { id: 'transactions', label: t('fin.tabs.transactions') },
    { id: 'categories', label: t('fin.tabs.categories') },
    { id: 'recurrences', label: t('fin.tabs.recurrences') },
    { id: 'transfers', label: t('fin.tabs.transfers') },
    { id: 'goals', label: t('fin.tabs.goals') },
    { id: 'exchange', label: t('fin.tabs.exchange') },
    { id: 'import', label: t('fin.tabs.import') },
  ]

  const filterClass = 'h-9 rounded-md border border-input bg-card px-2 text-sm text-foreground'

  const widgetLabels: Record<FinanceWidgetId, string> = {
    metrics: t('fin.dashboard.metrics'), flow: t('fin.dashboard.flow'), categoryDonut: t('fin.dashboard.donut'),
    accounts: t('fin.dashboard.accounts'), byCategory: t('fin.dashboard.byCategory'),
    byPerson: t('fin.dashboard.byPerson'), exchange: t('fin.dashboard.exchange'),
  }
  const dashboardWidgets: Record<FinanceWidgetId, ReactNode> = {
    metrics: consolidation.error ? (
      <Card><p className="text-sm text-destructive" role="alert">{consolidation.error}</p><CardDescription className="mt-1">{t('fin.noRate', { from: 'BRL', to: 'EUR' })}</CardDescription></Card>
    ) : consolidation.data ? (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard label={t('fin.summary.income')} total={consolidation.data.incomeRealized} />
        <SummaryCard label={t('fin.summary.expense')} total={consolidation.data.expenseRealized} />
        <SummaryCard label={t('fin.summary.balance')} total={consolidation.data.balance} strong />
        <SummaryCard label={t('fin.summary.plannedIn')} total={consolidation.data.incomePlanned} />
        <SummaryCard label={t('fin.summary.plannedOut')} total={consolidation.data.expensePlanned} />
        <Card><CardTitle className="text-sm">{t('fin.summary.pending')}</CardTitle><p className="mt-1 text-2xl font-semibold tabular-nums">{consolidation.data.pendingCount}</p><CardDescription>{t('fin.summary.overdue')}: {consolidation.data.overdueCount}</CardDescription></Card>
      </div>
    ) : null,
    flow: consolidation.data ? <CashflowChart incomeRealized={consolidation.data.incomeRealized} expenseRealized={consolidation.data.expenseRealized} incomePlanned={consolidation.data.incomePlanned} expensePlanned={consolidation.data.expensePlanned} /> : null,
    categoryDonut: <CategoryDonutChart items={expenseByCategory} />,
    accounts: (
      <Card>
        <CardTitle className="mb-2">{t('fin.accounts')}</CardTitle>
        {finance.accounts.length === 0 ? <p className="text-sm text-muted-foreground">{t('fin.empty')}</p> : (
          <ul className="flex flex-col divide-y divide-[var(--border)]">
            {finance.accounts.map((account) => {
              const txs = finance.transactions.filter((tx) => tx.account_id === account.id && tx.status !== 'cancelado')
              const trs = finance.transfers.filter((tr) => tr.from_account === account.id || tr.to_account === account.id)
              const movements = [
                ...txs.map((tx) => ({ kind: (tx.kind === 'income' ? 'in' : 'out') as 'in' | 'out', minor: tx.currency === account.currency ? toMinorUnits(tx.amount, tx.currency) : 0, confirmed: tx.status === 'pago' || tx.status === 'recebido' })),
                ...trs.flatMap((tr) => {
                  const legs: { kind: 'in' | 'out'; minor: number; confirmed: boolean }[] = []
                  if (tr.from_account === account.id && tr.currency === account.currency) legs.push({ kind: 'out', minor: toMinorUnits(tr.amount, tr.currency), confirmed: true })
                  if (tr.to_account === account.id) {
                    const targetCurrency = tr.to_currency ?? tr.currency
                    if (targetCurrency === account.currency) legs.push({ kind: 'in', minor: toMinorUnits(tr.to_amount ?? tr.amount, targetCurrency), confirmed: true })
                  }
                  return legs
                }),
              ]
              const balance = accountBalance(toMinorUnits(account.opening_balance, account.currency), movements)
              return (
                <li key={account.id} className="flex min-w-0 flex-col gap-2 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col"><span className="font-medium">{account.name} <span className="text-xs text-muted-foreground">({account.currency})</span></span><span className="text-xs text-muted-foreground">{t(`fin.accountType.${account.type}`)} · {memberName(account.owner_id)}</span></div>
                  <div className="flex flex-wrap items-center gap-2"><div className="text-right"><div className="font-semibold tabular-nums">{formatMoney(balance.current, account.currency)}</div>{(balance.pendingIn > 0 || balance.pendingOut > 0) && <div className="text-xs text-muted-foreground tabular-nums">{t('fin.pendingBalance')}: +{formatMoney(balance.pendingIn, account.currency)} / −{formatMoney(balance.pendingOut, account.currency)}</div>}</div><Button size="sm" variant="secondary" onClick={() => setDialog({ name: 'account', editing: account })}>{t('fin.editAccount')}</Button><Button size="sm" variant="ghost" onClick={() => setConfirmDelete({ table: 'financial_accounts_fh', id: account.id, before: account })}>{t('agenda.delete')}</Button></div>
                </li>
              )
            })}
          </ul>
        )}
        <div className="mt-3"><Button size="sm" onClick={() => setDialog({ name: 'account', editing: null })}>{t('fin.newAccount')}</Button></div>
      </Card>
    ),
    byCategory: <GroupCard title={t('fin.byCategory')} groups={groupedByCategory} nameFor={(id) => (id === 'sem-grupo' ? t('fin.noCategory') : categoryName(id))} />,
    byPerson: <GroupCard title={t('fin.byPerson')} groups={groupedByPerson} nameFor={(id) => (id === 'sem-grupo' ? t('fin.unassigned') : memberName(id))} />,
    exchange: <ExchangeRateWidget rates={liveRates.rates} date={liveRates.date} loading={liveRates.loading} error={liveRates.error} onRefresh={() => void liveRates.refresh()} />,
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t('fin.title')}</h1>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('fin.title')}>
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={
              tab === item.id
                ? 'rounded-md border border-primary bg-accent px-3 py-1.5 text-sm font-medium'
                : 'rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted'
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}

      {finance.status === 'loading' && (
        <p className="text-sm text-muted-foreground" role="status">
          {t('common.loading')}
        </p>
      )}
      {finance.status === 'error' && (
        <Card>
          <p className="text-sm text-destructive" role="alert">
            {t('common.error', { message: finance.error ?? '' })}
          </p>
          <div className="mt-2">
            <Button size="sm" variant="secondary" onClick={finance.reload}>
              {t('common.retry')}
            </Button>
          </div>
        </Card>
      )}

      {finance.status === 'ready' && tab === 'summary' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('fin.consolidatedIn', { currency: 'EUR' })}</span>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              {t('fin.period.from')}
              <input type="date" value={periodStart} max={periodEnd} onChange={(e) => setPeriodStart(e.target.value)} className={filterClass} />
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              {t('fin.period.to')}
              <input type="date" value={periodEnd} min={periodStart} onChange={(e) => setPeriodEnd(e.target.value)} className={filterClass} />
            </label>
            <Button size="sm" variant="secondary" onClick={() => {
              const range = currentMonthRange()
              setPeriodStart(range.start)
              setPeriodEnd(range.end)
            }}>
              {t('common.clear')}
            </Button>
            <div className="ml-auto">
              <Button size="sm" variant="secondary" onClick={() => setCustomizeWidgets(true)}>{t('fin.dashboard.customize')}</Button>
            </div>
          </div>
          {widgetLayout.order.filter((id) => !widgetLayout.hidden.includes(id)).map((id) => {
            const widget = dashboardWidgets[id]
            return widget ? <div key={id}>{widget}</div> : null
          })}
          {widgetLayout.order.every((id) => widgetLayout.hidden.includes(id)) && (
            <Card><CardDescription>{t('fin.dashboard.allHidden')}</CardDescription></Card>
          )}
        </div>
      )}

      {finance.status === 'ready' && tab === 'categories' && (
        <FinanceCategoriesPanel
          categories={finance.categories.filter((category) => category.household_id === finance.householdId)}
          merchants={finance.merchants}
          saveCategory={async (id, name, kind) => {
            const result = id
              ? await finance.update('categories_fh', id, { name, kind }, 'categories_fh')
              : await finance.insert('categories_fh', { domain: 'finance', name, kind, color: '#2563eb' })
            return result.error ?? null
          }}
          removeCategory={async (id) => (await finance.remove('categories_fh', id, 'categories_fh')).error ?? null}
          saveMerchant={async (id, categoryId, name) => {
            const result = id
              ? await finance.update('financial_merchants_fh', id, { category_id: categoryId, name }, 'financial_merchants_fh')
              : await finance.insert('financial_merchants_fh', { category_id: categoryId, name })
            return result.error ?? null
          }}
          removeMerchant={async (id) => (await finance.remove('financial_merchants_fh', id, 'financial_merchants_fh')).error ?? null}
        />
      )}

      {finance.status === 'ready' && tab === 'transactions' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setDialog({ name: 'transaction', editing: null, kind: 'expense' })}>
              {t('fin.newTransaction')}
            </Button>
            <select value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)} className={filterClass} aria-label={t('fin.account')}>
              <option value="">{t('fin.account')}: —</option>
              {finance.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <select value={filterKind} onChange={(e) => setFilterKind(e.target.value)} className={filterClass} aria-label={t('fin.kind')}>
              <option value="">{t('fin.allTypes')}</option>
              <option value="income">{t('fin.income')}</option>
              <option value="expense">{t('fin.expense')}</option>
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={filterClass} aria-label={t('fin.status')}>
              <option value="">{t('fin.allStatuses')}</option>
              {(['previsto', 'pendente', 'pago', 'recebido', 'vencido', 'cancelado'] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`fin.status.${s}`)}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 rounded-md border border-[var(--border)] px-3 text-sm text-muted-foreground">
              {t('fin.from')} <input type="date" value={transactionsFrom} onChange={(e) => setTransactionsFrom(e.target.value)} aria-label={t('fin.dateFrom')} className="bg-transparent py-2 text-foreground" />
            </label>
            <label className="flex items-center gap-2 rounded-md border border-[var(--border)] px-3 text-sm text-muted-foreground">
              {t('fin.to')} <input type="date" value={transactionsTo} onChange={(e) => setTransactionsTo(e.target.value)} aria-label={t('fin.dateTo')} className="bg-transparent py-2 text-foreground" />
            </label>
            <Button size="sm" variant="ghost" onClick={() => { const range = currentMonthRange(); setTransactionsFrom(range.start); setTransactionsTo(range.end) }}>{t('fin.clearDates')}</Button>
          </div>

          <Card>
            {transactionMonths.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('fin.empty')}</p>
            ) : (
              <div className="flex flex-col gap-5">
                {transactionMonths.map(({ month, transactions, byKind }) => (
                  <details key={month} className="rounded-md border border-[var(--border)] px-3">
                    <summary className="cursor-pointer py-3 text-sm font-semibold capitalize marker:text-muted-foreground">
                      <span className="ml-1">{new Intl.DateTimeFormat(locale === 'pt-BR' ? 'pt-BR' : 'en-GB', { month: 'long', year: 'numeric' }).format(new Date(`${month}-01T12:00:00`))}</span>
                      <span className="ml-3 inline-flex flex-wrap gap-x-3 gap-y-1 text-xs font-normal text-muted-foreground">
                        <span>{t('fin.totalTransactions', { count: transactions.length })}</span>
                        <span>{t('fin.expense')}: {byKind.expense.count}</span>
                        <span>{t('fin.income')}: {byKind.income.count}</span>
                      </span>
                    </summary>
                    <div className="grid gap-3 border-b border-[var(--border)] pb-3 pl-5 sm:grid-cols-2">
                      {(['expense', 'income'] as const).map((kind) => {
                        const summary = byKind[kind]
                        const totalsLabel = (totals: Map<string, number>) => totals.size > 0
                          ? [...totals].map(([currency, total]) => formatMoney(total, currency)).join(' · ')
                          : '—'
                        return (
                          <div key={kind} className={`rounded-md border p-3 ${kind === 'income' ? 'border-green-700/30 bg-green-700/5' : 'border-rose-700/30 bg-rose-700/5'}`}>
                            <h4 className={`mb-2 text-sm font-semibold ${kind === 'income' ? 'text-green-700 dark:text-green-400' : 'text-rose-700 dark:text-rose-400'}`}>{t(`fin.${kind === 'income' ? 'income' : 'expense'}`)} · {t('fin.totalTransactions', { count: summary.count })}</h4>
                            <div className="grid gap-1 text-xs text-muted-foreground">
                              <span>{t('fin.pendingTransactions', { count: summary.pendingCount })} · {t('fin.pendingTotal')}: {totalsLabel(summary.pendingTotals)}</span>
                              <span>{t('fin.paidTransactions', { count: summary.paidCount })} · {t('fin.paidTotal')}: {totalsLabel(summary.paidTotals)}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <ul className="flex flex-col divide-y divide-[var(--border)]">
                {transactions.map((tx) => {
                  const overdue = (tx.status === 'previsto' || tx.status === 'pendente') && tx.date < todayKey()
                  const shownStatus = overdue ? 'vencido' : tx.status
                  return (
                    <li key={tx.id} className="flex min-w-0 flex-col gap-2 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex flex-col">
                        <span className="font-medium">{tx.description}</span>
                        <span className="break-words text-xs text-muted-foreground">
                          {formatDate(tx.date)} · {t(`fin.status.${shownStatus}`)} · {accountName(tx.account_id)} ·{' '}
                          {categoryName(tx.category_id)} · {memberName(tx.owner_id)}
                          {tx.merchant_id ? ` · ${finance.merchants.find((merchant) => merchant.id === tx.merchant_id)?.name ?? ''}` : ''}
                          {tx.installment_total ? ` · ${tx.installment_number}/${tx.installment_total}` : ''}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`font-semibold tabular-nums ${tx.kind === 'income' ? 'text-green-700 dark:text-green-400' : ''}`}>
                          {tx.kind === 'income' ? '+' : '−'}
                          {formatMoney(toMinorUnits(tx.amount, tx.currency), tx.currency)}
                        </span>
                        {(tx.status === 'previsto' || tx.status === 'pendente') && (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() => void handleStatus(tx, tx.kind === 'income' ? 'recebido' : 'pago')}
                          >
                            {tx.kind === 'income' ? t('fin.markReceived') : t('fin.markPaid')}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setDialog({ name: 'transaction', editing: tx, kind: tx.kind })
                          }
                        >
                          {t('fin.editTransaction')}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmDelete({ table: 'financial_transactions_fh', id: tx.id, before: tx })}
                        >
                          {t('agenda.delete')}
                        </Button>
                      </div>
                    </li>
                  )
                })}
                    </ul>
                  </details>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {finance.status === 'ready' && tab === 'recurrences' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => setDialog({ name: 'recurrence', editing: null })} disabled={finance.accounts.length === 0}>
              {t('fin.newRecurrence')}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void handleGenerate()} disabled={busy}>
              {t('fin.generate')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('fin.generateHint')}</p>
          <Card>
            {finance.recurrences.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('fin.empty')}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-[var(--border)]">
                {finance.recurrences.map((recurrence) => (
                  <li key={recurrence.id} className="flex min-w-0 flex-col gap-2 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col">
                      <span className="font-medium">{recurrence.description}</span>
                      <span className="text-xs text-muted-foreground">
                        {recurrence.kind === 'income' ? t('fin.income') : t('fin.expense')} ·{' '}
                        {formatMoney(toMinorUnits(recurrence.amount, recurrence.currency), recurrence.currency)} ·{' '}
                        {t(`agenda.recurrence.${recurrence.frequency}`)} · {accountName(recurrence.account_id)} ·{' '}
                        {recurrence.active ? t('fin.active') : t('fin.inactive')}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => setDialog({ name: 'recurrence', editing: recurrence })}>
                        {t('fin.editRecurrence')}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void handleRecurrenceActive(recurrence)}
                      >
                        {recurrence.active ? t('fin.inactive') : t('fin.active')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmDelete({ table: 'financial_recurrences_fh', id: recurrence.id, before: recurrence })}
                      >
                        {t('agenda.delete')}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {finance.status === 'ready' && tab === 'transfers' && (
        <div className="flex flex-col gap-3">
          <div>
            <Button size="sm" onClick={() => setDialog({ name: 'transfer' })} disabled={finance.accounts.length < 2}>
              {t('fin.newTransfer')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('fin.transferNote')}</p>
          <Card>
            {finance.transfers.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('fin.empty')}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-[var(--border)]">
                {finance.transfers.map((transfer) => (
                  <li key={transfer.id} className="flex min-w-0 flex-col gap-2 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {accountName(transfer.from_account)} → {accountName(transfer.to_account)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(transfer.date)}
                        {transfer.description ? ` · ${transfer.description}` : ''}
                      </span>
                    </div>
                    <span className="font-semibold tabular-nums">
                      {formatMoney(toMinorUnits(transfer.amount, transfer.currency), transfer.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {finance.status === 'ready' && tab === 'goals' && (
        <div className="flex flex-col gap-3">
          <div>
            <Button size="sm" onClick={() => setDialog({ name: 'goal', editing: null })}>
              {t('fin.newGoal')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('fin.goalNote')}</p>
          {finance.goals.length === 0 ? (
            <Card>
              <p className="text-sm text-muted-foreground">{t('fin.empty')}</p>
            </Card>
          ) : (
            finance.goals.map((goal) => {
              const saved = finance.contributions
                .filter((c) => c.goal_id === goal.id)
                .reduce((sum, c) => sum + toMinorUnits(c.amount, goal.currency), 0)
              const target = toMinorUnits(goal.target_amount, goal.currency)
              const percent = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0
              return (
                <Card key={goal.id}>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>{goal.name}</CardTitle>
                    <div className="flex gap-1">
                      <Button size="sm" variant="secondary" onClick={() => setDialog({ name: 'contribute', goalId: goal.id })}>
                        {t('fin.contribute')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDialog({ name: 'goal', editing: goal })}>
                        {t('fin.editGoal')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmDelete({ table: 'financial_goals_fh', id: goal.id, before: goal })}
                      >
                        {t('agenda.delete')}
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                  </div>
                  <p className="mt-1 text-sm tabular-nums">
                    {formatMoney(saved, goal.currency)} / {formatMoney(target, goal.currency)} · {percent}%
                  </p>
                  {goal.deadline && (
                    <p className="text-xs text-muted-foreground">
                      {t('fin.deadline')}: {goal.deadline}
                    </p>
                  )}
                </Card>
              )
            })
          )}
        </div>
      )}

      {finance.status === 'ready' && tab === 'exchange' && (
        <div className="flex flex-col gap-4">
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <CardTitle>{t('fin.reference')}</CardTitle>
              <Button size="sm" variant="secondary" onClick={() => setDialog({ name: 'rate' })}>
                {t('fin.newRate')}
              </Button>
            </div>
            {finance.rates.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('fin.empty')}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-[var(--border)]">
                {finance.rates.slice(0, 20).map((rate) => (
                  <li key={rate.id} className="flex items-center justify-between py-1.5 text-sm">
                    <span>
                      {rate.base}→{rate.target} <span className="text-xs text-muted-foreground">· {rate.source}</span>
                    </span>
                    <span className="tabular-nums">{Number(rate.rate).toFixed(6)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="mb-2 flex items-center justify-between">
              <CardTitle>{t('fin.operation')}</CardTitle>
              <Button size="sm" variant="secondary" onClick={() => setDialog({ name: 'operation' })}>
                {t('fin.newOperation')}
              </Button>
            </div>
            {finance.operations.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('fin.empty')}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-[var(--border)]">
                {finance.operations.map((operation) => (
                  <li key={operation.id} className="flex min-w-0 flex-col gap-2 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {formatMoney(toMinorUnits(operation.from_amount, operation.from_currency), operation.from_currency)}
                        {' → '}
                        {formatMoney(toMinorUnits(operation.to_amount, operation.to_currency), operation.to_currency)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(operation.date)}
                        {operation.source ? ` · ${operation.source}` : ''}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {t('fin.effectiveRate')}: {Number(operation.effective_rate).toFixed(6)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {finance.status === 'ready' && tab === 'import' && (
        <Card>
          <CardTitle className="mb-2">{t('fin.newImport')}</CardTitle>
          {dialog?.name === 'import' ? (
            <ImportWizard
              accounts={finance.accounts}
              existing={finance.transactions}
              busy={busy}
              error={serverError}
              onImport={handleImport}
              onClose={() => setDialog(null)}
            />
          ) : (
            <Button size="sm" onClick={() => setDialog({ name: 'import' })} disabled={finance.accounts.length === 0}>
              {t('fin.newImport')}
            </Button>
          )}
        </Card>
      )}

      {dialog?.name === 'account' && (
        <AccountDialog
          initial={dialog.editing}
          members={members}
          busy={busy}
          error={serverError}
          onClose={() => setDialog(null)}
          onSave={(values) => void handleSave('financial_accounts_fh', values, dialog.editing?.id ?? null)}
        />
      )}
      {dialog?.name === 'transaction' && (
        <TransactionDialog
          initial={dialog.editing}
          accounts={finance.accounts}
          categories={finance.categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind }))}
          merchants={finance.merchants}
          members={members}
          defaultKind={dialog.kind}
          busy={busy}
          error={serverError}
          onClose={() => setDialog(null)}
          onSave={(values) =>
            void handleSave(
              'financial_transactions_fh',
              values,
              dialog.editing?.id ?? null,
              'financial_transactions_fh',
              dialog.editing,
            )
          }
        />
      )}
      {dialog?.name === 'recurrence' && (
        <RecurrenceDialog
          initial={dialog.editing}
          accounts={finance.accounts}
          categories={finance.categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind }))}
          members={members}
          busy={busy}
          error={serverError}
          onClose={() => setDialog(null)}
          onSave={(values) => void handleSaveRecurrence(values, dialog.editing)}
        />
      )}
      {dialog?.name === 'transfer' && (
        <TransferDialog
          accounts={finance.accounts}
          busy={busy}
          error={serverError}
          onClose={() => setDialog(null)}
          onSave={(values) => void handleSave('financial_transfers_fh', values, null)}
        />
      )}
      {dialog?.name === 'goal' && (
        <GoalDialog
          initial={dialog.editing}
          members={members}
          busy={busy}
          error={serverError}
          onClose={() => setDialog(null)}
          onSave={(values) => void handleSave('financial_goals_fh', values, dialog.editing?.id ?? null)}
        />
      )}
      {dialog?.name === 'contribute' && (
        <ContributeDialog
          busy={busy}
          error={serverError}
          onClose={() => setDialog(null)}
          onSave={async (values) => {
            setBusy(true)
            const result = await finance.insert('goal_contributions_fh', {
              ...values,
              goal_id: dialog.goalId,
            })
            setBusy(false)
            if (result.error) {
              setServerError(t('fin.saveError', { message: result.error }))
              return
            }
            setDialog(null)
          }}
        />
      )}
      {dialog?.name === 'rate' && (
        <RateDialog
          busy={busy}
          error={serverError}
          onClose={() => setDialog(null)}
          onSave={(values) => void handleSave('exchange_rates_fh', values, null)}
        />
      )}
      {dialog?.name === 'operation' && (
        <OperationDialog
          busy={busy}
          error={serverError}
          onClose={() => setDialog(null)}
          onSave={async (values) => {
            setBusy(true)
            const result = await finance.recordOperation(
              values as {
                from_amount: string
                from_currency: string
                to_amount: string
                to_currency: string
                fee?: string
                date: string
                source?: string
                notes?: string
              },
            )
            setBusy(false)
            if (result.error) {
              setServerError(t('fin.saveError', { message: result.error }))
              return
            }
            setDialog(null)
          }}
        />
      )}

      {confirmDelete && (
        <Modal title={t('agenda.delete')} onClose={() => setConfirmDelete(null)}>
          <p className="mb-4 text-sm text-muted-foreground">
            {confirmDelete.table === 'financial_recurrences_fh' ? t('fin.recurrenceDeleteConfirm') : t('fin.deleteConfirm')}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmDelete(null)} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={busy}>
              {t('agenda.delete')}
            </Button>
          </div>
        </Modal>
      )}
      {customizeWidgets && (
        <DashboardWidgetsDialog
          labels={widgetLabels}
          title={t('fin.dashboard.title')}
          description={t('fin.dashboard.description')}
          resetLabel={t('fin.dashboard.reset')}
          doneLabel={t('fin.dashboard.done')}
          showLabel={(name) => t('fin.dashboard.show', { name })}
          dragLabel={(name) => t('fin.dashboard.drag', { name })}
          layout={widgetLayout}
          onChange={setWidgetLayout}
          onReset={() => {
            setWidgetLayout(defaultWidgetLayout)
            notify('success', t('fin.dashboard.customize'), t('fin.dashboard.saved'))
          }}
          onClose={() => {
            setCustomizeWidgets(false)
            notify('success', t('fin.dashboard.customize'), t('fin.dashboard.saved'))
          }}
        />
      )}
    </div>
  )
}

function toReportTx(tx: {
  id: string
  kind: 'income' | 'expense'
  amount: string
  currency: string
  status: 'previsto' | 'pendente' | 'pago' | 'recebido' | 'cancelado'
  date: string
  category_id: string | null
  owner_id: string | null
  account_id: string
}) {
  return tx
}

function SummaryCard({
  label,
  total,
  strong = false,
}: {
  label: string
  total: { minor: number; currency: string; estimated: boolean }
  strong?: boolean
}) {
  const { t } = useI18n()
  return (
    <Card>
      <CardTitle className="text-sm">{label}</CardTitle>
      <p className={`mt-1 tabular-nums ${strong ? 'text-2xl font-bold' : 'text-2xl font-semibold'}`}>
        {formatMoney(total.minor, total.currency)}
      </p>
      {total.estimated && (
        <CardDescription>* {t('fin.estimate')}</CardDescription>
      )}
    </Card>
  )
}

function GroupCard({
  title,
  groups,
  nameFor,
}: {
  title: string
  groups: Map<string, { minor: number; currency: string; estimated: boolean }>
  nameFor: (id: string) => string
}) {
  const { t } = useI18n()
  const entries = [...groups.entries()].sort((a, b) => Math.abs(b[1].minor) - Math.abs(a[1].minor))
  return (
    <Card>
      <CardTitle className="mb-2">{title}</CardTitle>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('fin.empty')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--border)]">
          {entries.map(([id, total]) => (
            <li key={id} className="flex items-center justify-between py-1.5 text-sm">
              <span>{nameFor(id)}</span>
              <span className="tabular-nums">
                {formatMoney(total.minor, total.currency)}
                {total.estimated ? ' *' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
