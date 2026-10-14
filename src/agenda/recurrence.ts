/**
 * Expansão de recorrências genéricas (eventos, tarefas, lembretes).
 *
 * Função pura: recebe a regra + exceções e devolve as ocorrências dentro da
 * janela [from, to] (datas no formato YYYY-MM-DD, interpretadas no calendário
 * civil — sem aritmética de instantes, logo imune a transições de DST).
 *
 * Semântica:
 * - `occurrence_count` limita as ocorrências-base geradas pela série.
 *   Ocorrências puladas continuam contando na série (elas existem, apenas
 *   não disparam ação).
 * - Exceções `skipped` removem a ocorrência; `postponed` a substitui por
 *   `postponedTo` (ISO informado pelo usuário).
 * - Trava de segurança: no máximo 2000 ocorrências ou 10 anos de varredura.
 */

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

export type RecurrenceRule = {
  frequency: Frequency
  interval_n: number
  days_of_week: number[] | null
  month_day: number | null
  start_date: string
  end_date: string | null
  occurrence_count: number | null
  timezone: string
}

export type RecurrenceException = {
  original_date: string
  action: 'skipped' | 'postponed'
  new_start_at: string | null
}

export type Occurrence = {
  date: string
  postponedTo: string | null
}

const DAY_MS = 86_400_000
const MAX_OCCURRENCES = 2000
const MAX_DAYS_SCAN = 366 * 10 + 3

function parseDay(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number)
  return Date.UTC(year, month - 1, day, 12, 0, 0)
}

function formatDay(timestamp: number): string {
  const date = new Date(timestamp)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function daysBetween(from: number, to: number): number {
  return Math.round((to - from) / DAY_MS)
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0, 12)).getUTCDate()
}

function addMonths(timestamp: number, months: number, wantedDay: number | null): number {
  const date = new Date(timestamp)
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const total = month + months
  const targetYear = year + Math.floor(total / 12)
  const targetMonth = ((total % 12) + 12) % 12
  const day = Math.min(wantedDay ?? date.getUTCDate(), daysInMonth(targetYear, targetMonth))
  return Date.UTC(targetYear, targetMonth, day, 12, 0, 0)
}

function addYears(timestamp: number, years: number): number {
  const date = new Date(timestamp)
  const targetYear = date.getUTCFullYear() + years
  const month = date.getUTCMonth()
  const day = Math.min(date.getUTCDate(), daysInMonth(targetYear, month))
  return Date.UTC(targetYear, month, day, 12, 0, 0)
}

function monthDiff(from: number, to: number): number {
  const a = new Date(from)
  const b = new Date(to)
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth())
}

function matches(rule: RecurrenceRule, start: number, candidate: number): boolean {
  if (candidate < start) return false
  // A data inicial da série é sempre uma ocorrência (mesmo quando o
  // parâmetro mensal/anual apontaria outro dia).
  if (candidate === start) return true
  const interval = Math.max(1, Math.floor(rule.interval_n))

  switch (rule.frequency) {
    case 'daily': {
      return daysBetween(start, candidate) % interval === 0
    }
    case 'weekly': {
      const weekdays =
        rule.days_of_week && rule.days_of_week.length > 0
          ? rule.days_of_week
          : [new Date(start).getUTCDay()]
      if (!weekdays.includes(new Date(candidate).getUTCDay())) return false
      return Math.floor(daysBetween(start, candidate) / 7) % interval === 0
    }
    case 'monthly': {
      const diff = monthDiff(start, candidate)
      if (diff % interval !== 0) return false
      const expected = addMonths(start, diff, rule.month_day)
      return formatDay(expected) === formatDay(candidate)
    }
    case 'yearly': {
      const years = new Date(candidate).getUTCFullYear() - new Date(start).getUTCFullYear()
      if (years % interval !== 0) return false
      const expected = addYears(start, years)
      return formatDay(expected) === formatDay(candidate)
    }
  }
}

export function expandRecurrence(
  rule: RecurrenceRule,
  exceptions: RecurrenceException[],
  from: string,
  to: string,
): Occurrence[] {
  const start = parseDay(rule.start_date)
  const windowStart = Math.max(parseDay(from), start)
  const hardEnd = Math.min(
    parseDay(to),
    rule.end_date ? parseDay(rule.end_date) : Number.POSITIVE_INFINITY,
  )
  if (windowStart > hardEnd) return []

  const byDate = new Map<string, RecurrenceException>()
  for (const exception of exceptions) byDate.set(exception.original_date, exception)

  const result: Occurrence[] = []
  let generated = 0
  let cursor = start
  let scanned = 0

  while (cursor <= hardEnd && scanned < MAX_DAYS_SCAN && generated < MAX_OCCURRENCES) {
    if (matches(rule, start, cursor)) {
      generated += 1
      if (rule.occurrence_count !== null && generated > rule.occurrence_count) break
      if (cursor >= windowStart) {
        const date = formatDay(cursor)
        const exception = byDate.get(date)
        if (!exception || exception.action !== 'skipped') {
          result.push({
            date,
            postponedTo: exception?.action === 'postponed' ? (exception.new_start_at ?? null) : null,
          })
        }
      }
    }
    cursor += DAY_MS
    scanned += 1
  }

  return result
}
