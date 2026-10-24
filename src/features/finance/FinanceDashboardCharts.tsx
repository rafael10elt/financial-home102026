import { useI18n } from '../../i18n'
import { Button } from '../../ui/Button'
import { Card, CardDescription, CardTitle } from '../../ui/Card'
import type { ConvertedTotal } from '../../finance/reports'
import { formatMoney } from '../../finance/money'

const chartColors = ['#38bdf8', '#a78bfa', '#f59e0b', '#34d399', '#fb7185', '#f472b6', '#94a3b8']

export function CashflowChart({
  incomeRealized,
  expenseRealized,
  incomePlanned,
  expensePlanned,
}: {
  incomeRealized: ConvertedTotal
  expenseRealized: ConvertedTotal
  incomePlanned: ConvertedTotal
  expensePlanned: ConvertedTotal
}) {
  const { t } = useI18n()
  const rows = [
    { label: t('fin.summary.income'), value: incomeRealized.minor, color: 'bg-emerald-500' },
    { label: t('fin.summary.expense'), value: expenseRealized.minor, color: 'bg-rose-500' },
    { label: t('fin.summary.plannedIn'), value: incomePlanned.minor, color: 'bg-sky-500' },
    { label: t('fin.summary.plannedOut'), value: expensePlanned.minor, color: 'bg-amber-500' },
  ]
  const max = Math.max(1, ...rows.map((row) => Math.abs(row.value)))
  return (
    <Card>
      <CardTitle className="mb-1">{t('fin.chart.cashflow')}</CardTitle>
      <CardDescription className="mb-4">{t('fin.chart.cashflowHint')}</CardDescription>
      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[minmax(6rem,9rem)_1fr_auto] items-center gap-3 text-sm">
            <span className="truncate text-muted-foreground">{row.label}</span>
            <span className="h-3 overflow-hidden rounded-full bg-muted">
              <span className={`block h-full rounded-full ${row.color}`} style={{ width: `${Math.max(row.value ? 3 : 0, Math.abs(row.value) / max * 100)}%` }} />
            </span>
            <span className="min-w-24 text-right font-medium tabular-nums">{formatMoney(Math.abs(row.value), 'EUR')}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

export function CategoryDonutChart({ items }: { items: { name: string; minor: number }[] }) {
  const { t } = useI18n()
  const total = items.reduce((sum, item) => sum + item.minor, 0)
  const visibleItems = items.length > 7
    ? [...items.slice(0, 6), { name: t('fin.chart.other'), minor: items.slice(6).reduce((sum, item) => sum + item.minor, 0) }]
    : items
  const radius = 42
  const circumference = 2 * Math.PI * radius
  let offset = 0
  return (
    <Card>
      <CardTitle className="mb-1">{t('fin.chart.expensesByCategory')}</CardTitle>
      <CardDescription className="mb-4">{t('fin.chart.donutHint')}</CardDescription>
      {total <= 0 ? <p className="text-sm text-muted-foreground">{t('fin.empty')}</p> : (
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
          <svg viewBox="0 0 100 100" role="img" aria-label={t('fin.chart.expensesByCategory')} className="size-40 shrink-0 -rotate-90">
            <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--muted)" strokeWidth="15" />
            {visibleItems.map((item, index) => {
              const length = item.minor / total * circumference
              const circle = <circle key={item.name} cx="50" cy="50" r={radius} fill="none" stroke={chartColors[index % chartColors.length]} strokeWidth="15" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} />
              offset += length
              return circle
            })}
            <text x="50" y="48" textAnchor="middle" dominantBaseline="middle" fill="currentColor" fontSize="8" className="rotate-90" style={{ transformOrigin: '50% 50%' }}>{t('fin.chart.total')}</text>
            <text x="50" y="59" textAnchor="middle" dominantBaseline="middle" fill="currentColor" fontSize="7" className="rotate-90" style={{ transformOrigin: '50% 50%' }}>{formatMoney(total, 'EUR')}</text>
          </svg>
          <ul className="flex w-full flex-col gap-2">
            {visibleItems.map((item, index) => (
              <li key={item.name} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="shrink-0 text-muted-foreground tabular-nums">{Math.round(item.minor / total * 100)}% · {formatMoney(item.minor, 'EUR')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

export function ExchangeRateWidget({
  rates,
  date,
  loading,
  error,
  onRefresh,
}: {
  rates: Record<string, number>
  date: string
  loading: boolean
  error: string | null
  onRefresh: () => void
}) {
  const { t } = useI18n()
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="mb-1">{t('fin.chart.exchange')}</CardTitle>
          <CardDescription>{t('fin.chart.exchangeHint')}</CardDescription>
        </div>
        <Button size="sm" variant="secondary" onClick={onRefresh} disabled={loading}>{loading ? t('common.loading') : t('common.retry')}</Button>
      </div>
      {error && Object.keys(rates).length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground" role="status">{t('fin.chart.exchangeUnavailable')}</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {['GBP', 'BRL', 'USD'].map((currency) => (
              <div key={currency} className="rounded-lg border border-border bg-background/50 p-3">
                <p className="text-xs text-muted-foreground">EUR → {currency}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{rates[currency]?.toLocaleString(undefined, { maximumFractionDigits: 4 }) ?? '—'}</p>
                <p className="text-xs text-muted-foreground">{currency} por 1 EUR</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{t('fin.chart.rateDate', { date })}</span>
            <a href="https://frankfurter.dev" target="_blank" rel="noreferrer" className="underline underline-offset-2">Frankfurter</a>
          </div>
          {error && <p className="mt-2 text-xs text-muted-foreground">{t('fin.chart.rateStale')}</p>}
        </>
      )}
    </Card>
  )
}
