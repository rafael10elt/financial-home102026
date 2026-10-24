import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { useAuth } from '../../auth/context'
import { useHousehold } from '../../household/context'
import { useAgendaData } from '../../agenda/useAgenda'
import { useDiaryData } from '../../diary/useDiary'
import { useFinanceData } from '../../finance/useFinance'
import { consolidate, type Quote } from '../../finance/reports'
import { formatMoney } from '../../finance/money'
import { Button } from '../../ui/Button'
import { Card, CardTitle } from '../../ui/Card'
import { PhasePlaceholder } from '../../ui/PhasePlaceholder'
import { ClocksWidget } from '../../ui/ClocksWidget'
import { WeatherWidget } from '../../ui/WeatherWidget'
import { TransactionDialog } from '../finance/FinanceDialogs'
import { useToast } from '../../ui/toastContext'
import { useLiveRates } from '../../finance/useLiveRates'
import { ExchangeRateWidget } from '../finance/FinanceDashboardCharts'
import { DashboardWidgetsDialog } from '../finance/DashboardWidgetsDialog'
import { TradingSessionsWidget } from '../../ui/TradingSessionsWidget'
import { GroceryListWidget } from '../../ui/GroceryListWidget'

const DEFAULT_WIDGETS = [
  'clocks',
  'weather',
  'quickActions',
  'agendaToday',
  'tasksOpen',
  'mood',
  'financeSoon',
  'diarySoon',
  'exchange',
  'tradingSessions',
  'grocery',
] as const

type WidgetId = (typeof DEFAULT_WIDGETS)[number]

type WidgetLayout = { order: WidgetId[]; hidden: WidgetId[] }
const DEFAULT_LAYOUT: WidgetLayout = { order: [...DEFAULT_WIDGETS], hidden: ['exchange'] }

function sanitizeLayout(raw: unknown): WidgetLayout {
  const source = Array.isArray(raw) ? { order: raw, hidden: [] } : raw as { order?: unknown; hidden?: unknown } | null
  if (!source || !Array.isArray(source.order)) return { order: [...DEFAULT_LAYOUT.order], hidden: [...DEFAULT_LAYOUT.hidden] }
  const known = new Set<string>(DEFAULT_WIDGETS)
  const cleaned = source.order.filter(
    (item): item is WidgetId => typeof item === 'string' && known.has(item),
  )
  for (const widget of DEFAULT_WIDGETS) {
    if (!cleaned.includes(widget)) cleaned.push(widget)
  }
  const hidden = Array.isArray(source.hidden)
    ? source.hidden.filter((item): item is WidgetId => typeof item === 'string' && known.has(item))
    : []
  // Layouts antigos não tinham câmbio: ele entra como opção, oculto por padrão.
  if (!source.order.includes('exchange') && !hidden.includes('exchange')) hidden.push('exchange')
  return { order: cleaned, hidden }
}

function layoutKey(profileId: string | undefined): string { return `fh.layout.v2:${profileId ?? 'guest'}` }

function loadLocalLayout(profileId: string | undefined): WidgetLayout {
  try {
    const raw = localStorage.getItem(layoutKey(profileId))
    if (!raw) return { order: [...DEFAULT_LAYOUT.order], hidden: [...DEFAULT_LAYOUT.hidden] }
    return sanitizeLayout(JSON.parse(raw))
  } catch {
    return { order: [...DEFAULT_LAYOUT.order], hidden: [...DEFAULT_LAYOUT.hidden] }
  }
}

export function OverviewPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { supabase, user } = useAuth()
  const { state } = useHousehold()
  const agenda = useAgendaData()
  const finance = useFinanceData()
  const { notify } = useToast()
  const liveRates = useLiveRates()

  const [layout, setLayout] = useState<WidgetLayout>(() => loadLocalLayout(user?.id))
  const [editingLayout, setEditingLayout] = useState(false)
  const layoutProfileRef = useRef(user?.id)
  const [quickExpense, setQuickExpense] = useState(false)
  const [savingQuickExpense, setSavingQuickExpense] = useState(false)

  useEffect(() => {
    if (layoutProfileRef.current === user?.id) return
    layoutProfileRef.current = user?.id
    setLayout(loadLocalLayout(user?.id))
  }, [user?.id])

  useEffect(() => {
    if (layoutProfileRef.current !== user?.id) return
    try { localStorage.setItem(layoutKey(user?.id), JSON.stringify(layout)) } catch { /* cache local opcional */ }
  }, [layout, user?.id])

  // Hidrata o layout da conta (nuvem vence apenas na primeira carga).
  useEffect(() => {
    if (!supabase || !user) return
    let cancelled = false
    void supabase
      .from('dashboard_layouts_fh')
      .select('layout')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        const cloudLayout = (data as { layout: unknown } | null)?.layout
        if (cloudLayout !== undefined && cloudLayout !== null) {
          const next = sanitizeLayout(cloudLayout)
          setLayout(next)
          try { localStorage.setItem(layoutKey(user.id), JSON.stringify(next)) } catch { /* cache local opcional */ }
        }
      })
    return () => {
      cancelled = true
    }
  }, [supabase, user])

  function persist(next: WidgetLayout) {
    setLayout(next)
    try {
      localStorage.setItem(layoutKey(user?.id), JSON.stringify(next))
    } catch {
      // Cache local opcional.
    }
    if (supabase && user) {
      void supabase
        .from('dashboard_layouts_fh')
        .upsert({ user_id: user.id, layout: next }, { onConflict: 'user_id' })
        .then(({ error }) => {
          if (error) notify('error', t('overview.widgets'), error.message)
        })
    }
  }

  const todayKey = (() => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  })()

  const todayEvents = agenda.events.filter((event) => {
    const key = (() => {
      const date = new Date(event.start_at)
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    })()
    return key === todayKey
  })

  const openTasks = agenda.tasks
    .filter((task) => task.status === 'open' || task.status === 'in_progress')
    .sort((a, b) => (a.due_at ?? '9999') < (b.due_at ?? '9999') ? -1 : 1)
    .slice(0, 5)

  function renderWidget(id: WidgetId) {
    switch (id) {
      case 'clocks':
        return <ClocksWidget />
      case 'weather':
        return <WeatherWidget />
      case 'tradingSessions':
        return <TradingSessionsWidget />
      case 'grocery':
        return <GroceryListWidget />
      case 'quickActions':
        return (
          <Card>
            <CardTitle className="mb-2">{t('overview.quickActions')}</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void navigate('/agenda?novo=tarefa')}>
                {t('agenda.newTask')}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void navigate('/agenda?novo=evento')}>
                {t('agenda.newEvent')}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void navigate('/agenda?novo=lembrete')}>
                {t('agenda.newReminder')}
              </Button>
            </div>
          </Card>
        )
      case 'agendaToday':
        return (
          <Card>
            <CardTitle className="mb-2">{t('overview.agendaToday')}</CardTitle>
            {agenda.status === 'loading' && (
              <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
            )}
            {agenda.status === 'ready' && todayEvents.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('agenda.empty')}</p>
            )}
            {agenda.status === 'ready' && todayEvents.length > 0 && (
              <ul className="flex flex-col divide-y divide-[var(--border)]">
                {todayEvents.map((event) => (
                  <li key={event.id} className="py-1.5 text-sm">
                    <span className="font-medium">{event.title}</span>{' '}
                    <span className="text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hourCycle: 'h23',
                      }).format(new Date(event.start_at))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2">
              <Button size="sm" variant="ghost" onClick={() => void navigate('/agenda')}>
                {t('agenda.title')} →
              </Button>
            </div>
          </Card>
        )
      case 'tasksOpen':
        return (
          <Card>
            <CardTitle className="mb-2">{t('overview.tasksOpen')}</CardTitle>
            {agenda.status === 'loading' && (
              <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
            )}
            {agenda.status === 'ready' && openTasks.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('agenda.empty')}</p>
            )}
            {agenda.status === 'ready' && openTasks.length > 0 && (
              <ul className="flex flex-col divide-y divide-[var(--border)]">
                {openTasks.map((task) => (
                  <li key={task.id} className="flex items-center justify-between py-1.5 text-sm">
                    <span className="font-medium">{task.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {t(`agenda.priority.${task.priority}`)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )
      case 'financeSoon':
        return <FinanceSummaryWidget />
      case 'exchange':
        return <ExchangeRateWidget rates={liveRates.rates} date={liveRates.date} loading={liveRates.loading} error={liveRates.error} onRefresh={() => void liveRates.refresh()} />
      case 'mood':
        return <MoodWidget />
      case 'diarySoon':
        return <PhasePlaceholder phase="4" module={t('overview.diarySoon')} />
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">{t('nav.overview')}</h1>
        <div className="ml-auto">
          <Button
            size="sm"
            variant="secondary"
            aria-pressed={editingLayout}
            onClick={() => setEditingLayout(true)}
          >
            {t('overview.widgets')}
          </Button>
        </div>
      </div>

      {state.kind === 'ready' && (
        <p className="text-sm text-muted-foreground">
          {t('house.current', { name: state.household.name })}
        </p>
      )}

      {layout.order.filter((id) => !layout.hidden.includes(id)).map((id) => (
        <section key={id} aria-label={id}>
          {renderWidget(id)}
        </section>
      ))}
      {layout.order.every((id) => layout.hidden.includes(id)) && <Card><CardTitle>{t('overview.allHidden')}</CardTitle></Card>}

      {editingLayout && (
        <DashboardWidgetsDialog
          labels={{
            clocks: t('overview.widget.clocks'), weather: t('weather.title'), quickActions: t('overview.quickActions'),
            agendaToday: t('overview.agendaToday'), tasksOpen: t('overview.tasksOpen'), mood: t('diary.moodToday'),
            financeSoon: t('overview.financeSoon'), diarySoon: t('overview.diarySoon'), exchange: t('fin.dashboard.exchange'),
            tradingSessions: t('overview.trading.title'), grocery: t('overview.grocery.title'),
          }}
          title={t('overview.widgets')}
          description={t('overview.widgetDescription')}
          resetLabel={t('fin.dashboard.reset')}
          doneLabel={t('fin.dashboard.done')}
          showLabel={(name) => t('fin.dashboard.show', { name })}
          dragLabel={(name) => t('fin.dashboard.drag', { name })}
          layout={layout}
          onChange={persist}
          onReset={() => {
            const defaults = { order: [...DEFAULT_LAYOUT.order], hidden: [...DEFAULT_LAYOUT.hidden] }
            persist(defaults)
            notify('success', t('overview.widgets'), t('fin.dashboard.saved'))
          }}
          onClose={() => {
            setEditingLayout(false)
            notify('success', t('overview.widgets'), t('fin.dashboard.saved'))
          }}
        />
      )}

      <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2 pb-[env(safe-area-inset-bottom)]">
        <Button size="md" variant="secondary" className="h-12 rounded-full px-5 shadow-lg" onClick={() => void navigate('/assistente')}>
          <span aria-hidden="true">✦</span><span>{t('overview.quickAssistant')}</span>
        </Button>
        <Button
          size="md"
          className="h-12 rounded-full px-5 shadow-lg"
          disabled={finance.status === 'loading'}
          onClick={() => {
            if (!finance.accounts.length) {
              notify('info', t('overview.quickExpenseNeedsAccount'), t('overview.quickExpenseNeedsAccountDetail'))
              void navigate('/financas')
              return
            }
            setQuickExpense(true)
          }}
        >
          <span aria-hidden="true">＋</span><span>{t('overview.quickExpense')}</span>
        </Button>
      </div>

      {quickExpense && finance.status === 'ready' && (
        <TransactionDialog
          initial={null}
          accounts={finance.accounts}
          categories={finance.categories.map((category) => ({ id: category.id, name: category.name, kind: category.kind }))}
          merchants={finance.merchants}
          members={state.kind === 'ready' ? state.members.map((member) => ({ user_id: member.user_id, display_name: member.display_name })) : []}
          defaultKind="expense"
          busy={savingQuickExpense}
          error={null}
          onClose={() => setQuickExpense(false)}
          onSave={async (values) => {
            setSavingQuickExpense(true)
            const result = await finance.insert('financial_transactions_fh', values)
            setSavingQuickExpense(false)
            if (result.error) {
              notify('error', t('overview.quickExpenseFailed'), result.error)
              return
            }
            setQuickExpense(false)
            notify('success', t('overview.quickExpenseSaved'))
          }}
        />
      )}
    </div>
  )
}

function FinanceSummaryWidget() {  const { t } = useI18n()
  const navigate = useNavigate()
  const finance = useFinanceData()

  const quotes = new Map<string, Quote>()
  for (const rate of finance.rates) {
    const key = `${rate.base}->${rate.target}`
    if (!quotes.has(key)) {
      quotes.set(key, {
        base: rate.base,
        target: rate.target,
        rate: Number(rate.rate),
        source: rate.source,
        fetchedAt: rate.fetched_at,
        manual: rate.manual,
      })
    }
  }

  // Cálculo puro (pode lançar "sem cotação"); o JSX fica fora do try/catch.
  function computeSummary() {
    try {
      const month = new Date().toISOString().slice(0, 8) + '01'
      const today = new Date().toISOString().slice(0, 10)
      const result = consolidate(
        finance.status === 'ready'
          ? finance.transactions
              .filter((tx) => tx.date >= month)
              .map((tx) => ({
                id: tx.id,
                kind: tx.kind,
                amount: tx.amount,
                currency: tx.currency,
                status: tx.status,
                date: tx.date,
                category_id: tx.category_id,
                owner_id: tx.owner_id,
                account_id: tx.account_id,
              }))
          : [],
        'EUR',
        quotes,
        today,
      )
      return { result, error: null as string | null }
    } catch (error) {
      return { result: null, error: error instanceof Error ? error.message : String(error) }
    }
  }

  let body: React.ReactNode
  if (finance.status === 'loading') {
    body = <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
  } else if (finance.status !== 'ready') {
    body = <p className="text-sm text-muted-foreground">{t('fin.empty')}</p>
  } else {
    const computed = computeSummary()
    if (computed.error || !computed.result) {
      body = <p className="text-sm text-muted-foreground">{t('fin.noRate', { from: 'BRL', to: 'EUR' })}</p>
    } else {
      const result = computed.result
      body = (
        <>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div>
              <dt className="text-[11px] text-muted-foreground">{t('fin.summary.income')}</dt>
              <dd className="font-semibold tabular-nums">
                {formatMoney(result.incomeRealized.minor, 'EUR')}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">{t('fin.summary.expense')}</dt>
              <dd className="font-semibold tabular-nums">
                {formatMoney(result.expenseRealized.minor, 'EUR')}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">{t('fin.summary.pending')}</dt>
              <dd className="font-semibold tabular-nums">{result.pendingCount}</dd>
            </div>
          </dl>
          {result.balance.estimated && (
            <p className="mt-1 text-[11px] text-muted-foreground">* {t('fin.estimate')}</p>
          )}
        </>
      )
    }
  }

  return (
    <Card>
      <CardTitle className="mb-2">{t('fin.tabs.summary')}</CardTitle>
      {body}
      <div className="mt-2">
        <Button size="sm" variant="ghost" onClick={() => void navigate('/financas')}>
          {t('fin.title')} →
        </Button>
      </div>
    </Card>
  )
}

function MoodWidget() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { user } = useAuth()
  const diary = useDiaryData()

  const today = new Date().toISOString().slice(0, 10)
  const todayMoods =
    diary.status === 'ready' ? diary.userMoods.filter((entry) => entry.date === today) : []

  return (
    <Card>
      <CardTitle className="mb-2">{t('diary.moodToday')}</CardTitle>
      {diary.status === 'loading' && (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      )}
      {diary.status === 'ready' && todayMoods.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('diary.empty')}</p>
      )}
      {todayMoods.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {todayMoods.map((entry) => (
            <li key={entry.id} className="flex items-center gap-2 text-sm">
              <span className="text-xl" aria-hidden="true">
                {entry.mood?.emoji ?? '🙂'}
              </span>
              <span className="font-medium">{entry.mood?.name ?? '—'}</span>
              <span className="text-xs text-muted-foreground">
                {entry.user_id === user?.id ? 'você' : ''}
                {entry.note ? ` · ${entry.note}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2">
        <Button size="sm" variant="ghost" onClick={() => void navigate('/diario')}>
          {t('diary.title')} →
        </Button>
      </div>
    </Card>
  )
}
