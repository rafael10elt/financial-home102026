/**
 * Períodos de recorrências FINANCEIRAS.
 *
 * Cada período vira no máximo um lançamento pendente: a chave
 * `period_key` (ex.: "2026-10" para mensal) tem unicidade por recorrência
 * no banco. Retry da geração nunca duplica o período.
 *
 * Formatos de period_key por frequência:
 * - daily: YYYY-MM-DD · weekly: YYYY-MM-DD da segunda-feira da semana
 * - monthly: YYYY-MM · yearly: YYYY
 */

export type FinanceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

export type FinanceRecurrence = {
  frequency: FinanceFrequency
  interval_n: number
  start_date: string
  end_date: string | null
  occurrence_count: number | null
  active: boolean
}

export type FinancePeriod = { period_key: string; date: string }

const DAY_MS = 86_400_000
const MAX_PERIODS = 500

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function parseDay(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d, 12)
}

function formatDay(ts: number): string {
  const dt = new Date(ts)
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate()
}

export function periodKeyFor(frequency: FinanceFrequency, dateKey: string): string {
  if (frequency === 'monthly') return dateKey.slice(0, 7)
  if (frequency === 'yearly') return dateKey.slice(0, 4)
  if (frequency === 'weekly') {
    const ts = parseDay(dateKey)
    const weekday = new Date(ts).getUTCDay()
    const monday = ts - ((weekday + 6) % 7) * DAY_MS
    return formatDay(monday)
  }
  return dateKey
}

/** Gera os períodos devidos até `horizon` (inclusive). Sempre pendentes. */
export function duePeriods(
  recurrence: FinanceRecurrence,
  horizon: string,
  existingKeys: Set<string>,
): FinancePeriod[] {
  if (!recurrence.active) return []
  const interval = Math.max(1, Math.floor(recurrence.interval_n))
  const start = parseDay(recurrence.start_date)
  const end = Math.min(
    parseDay(horizon),
    recurrence.end_date ? parseDay(recurrence.end_date) : Number.POSITIVE_INFINITY,
  )

  const periods: FinancePeriod[] = []
  const seen = new Set<string>()
  let generated = 0
  let index = 0

  while (generated < MAX_PERIODS) {
    const startDate = new Date(start)
    const sy = startDate.getUTCFullYear()
    const sm = startDate.getUTCMonth()
    const sd = startDate.getUTCDate()

    let ts: number
    if (recurrence.frequency === 'daily') {
      ts = start + index * interval * DAY_MS
    } else if (recurrence.frequency === 'weekly') {
      ts = start + index * interval * 7 * DAY_MS
    } else if (recurrence.frequency === 'monthly') {
      const total = sm + index * interval
      const ty = sy + Math.floor(total / 12)
      const tm = ((total % 12) + 12) % 12
      ts = Date.UTC(ty, tm, Math.min(sd, daysInMonth(ty, tm)), 12)
    } else {
      ts = Date.UTC(sy + index * interval, sm, Math.min(sd, daysInMonth(sy + index * interval, sm)), 12)
    }

    if (ts > end) break
    index += 1
    generated += 1
    if (recurrence.occurrence_count !== null && generated > recurrence.occurrence_count) break

    const date = formatDay(ts)
    const period_key = periodKeyFor(recurrence.frequency, date)
    if (seen.has(period_key) || existingKeys.has(period_key)) continue
    seen.add(period_key)
    periods.push({ period_key, date })
  }

  return periods
}
