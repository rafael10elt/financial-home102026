import { useEffect, useState } from 'react'
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

const DEFAULT_WIDGETS = [
  'clocks',
  'weather',
  'quickActions',
  'agendaToday',
  'tasksOpen',
  'mood',
  'financeSoon',
  'diarySoon',
] as const

type WidgetId = (typeof DEFAULT_WIDGETS)[number]

const LAYOUT_KEY = 'fh.layout.v1'

function sanitizeLayout(raw: unknown): WidgetId[] {
  if (!Array.isArray(raw)) return [...DEFAULT_WIDGETS]
  const known = new Set<string>(DEFAULT_WIDGETS)
  const cleaned = raw.filter(
    (item): item is WidgetId => typeof item === 'string' && known.has(item),
  )
  for (const widget of DEFAULT_WIDGETS) {
    if (!cleaned.includes(widget)) cleaned.push(widget)
  }
  return cleaned
}

function loadLocalLayout(): WidgetId[] {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY)
    if (!raw) return [...DEFAULT_WIDGETS]
    return sanitizeLayout(JSON.parse(raw))
  } catch {
    return [...DEFAULT_WIDGETS]
  }
}

export function OverviewPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { supabase, user } = useAuth()
  const { state } = useHousehold()
  const agenda = useAgendaData()

  const [widgets, setWidgets] = useState<WidgetId[]>(() => loadLocalLayout())
  const [editingLayout, setEditingLayout] = useState(false)

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
        const layout = (data as { layout: unknown } | null)?.layout
        if (layout !== undefined && layout !== null) setWidgets(sanitizeLayout(layout))
      })
    return () => {
      cancelled = true
    }
  }, [supabase, user])

  function persist(next: WidgetId[]) {
    setWidgets(next)
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(next))
    } catch {
      // Cache local opcional.
    }
    if (supabase && user) {
      void supabase
        .from('dashboard_layouts_fh')
        .upsert({ user_id: user.id, layout: next }, { onConflict: 'user_id' })
    }
  }

  function move(index: number, delta: -1 | 1) {
    const next = [...widgets]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    const [moved] = next.splice(index, 1)
    if (moved) next.splice(target, 0, moved)
    persist(next)
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
    .filter((task) => task.status === 'open')
    .sort((a, b) => (a.due_at ?? '9999') < (b.due_at ?? '9999') ? -1 : 1)
    .slice(0, 5)

  function renderWidget(id: WidgetId) {
    switch (id) {
      case 'clocks':
        return <ClocksWidget />
      case 'weather':
        return <WeatherWidget />
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
            onClick={() => setEditingLayout((value) => !value)}
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

      {widgets.map((id, index) => (
        <section key={id} aria-label={id}>
          {editingLayout && (
            <div className="mb-1 flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                disabled={index === 0}
                onClick={() => move(index, -1)}
                aria-label={`${t('overview.moveUp')}: ${id}`}
              >
                ↑
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={index === widgets.length - 1}
                onClick={() => move(index, 1)}
                aria-label={`${t('overview.moveDown')}: ${id}`}
              >
                ↓
              </Button>
            </div>
          )}
          {renderWidget(id)}
        </section>
      ))}
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
