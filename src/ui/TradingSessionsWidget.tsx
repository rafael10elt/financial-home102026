import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import type { TranslationKey } from '../i18n/pt-BR'
import { Card, CardTitle } from './Card'

const ZONE = 'Europe/Dublin'
type DublinParts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number }

function dublinParts(date: Date): DublinParts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day), hour: Number(values.hour), minute: Number(values.minute), weekday: weekdays[values.weekday] ?? 0 }
}

function wallTimeToInstant(year: number, month: number, day: number, hour: number, minute: number): number {
  const desired = Date.UTC(year, month - 1, day, hour, minute)
  let guess = desired
  for (let pass = 0; pass < 3; pass += 1) {
    const actual = dublinParts(new Date(guess))
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute)
    guess += desired - represented
  }
  return guess
}

export function TradingSessionsWidget() {
  const { t } = useI18n()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const parts = dublinParts(now)
  const minuteOfDay = parts.hour * 60 + parts.minute
  const weekday = parts.weekday >= 1 && parts.weekday <= 5
  const sessions = [
    { name: 'overview.trading.londonName' as TranslationKey, range: '08:00–11:00', active: weekday && minuteOfDay >= 8 * 60 && minuteOfDay < 11 * 60 },
    { name: 'overview.trading.premarketName' as TranslationKey, range: '12:00–14:30', active: weekday && minuteOfDay >= 12 * 60 && minuteOfDay < 14 * 60 + 30 },
    { name: 'overview.trading.rthName' as TranslationKey, range: '14:30–21:00', active: weekday && minuteOfDay >= 14 * 60 + 30 && minuteOfDay < 21 * 60 },
    { name: 'overview.trading.powerHourName' as TranslationKey, range: '20:00–20:55', active: weekday && minuteOfDay >= 20 * 60 && minuteOfDay < 20 * 60 + 55 },
  ]
  let statusKey: TranslationKey = 'overview.trading.closed'
  let color = 'border-border bg-muted text-muted-foreground'
  if (weekday && minuteOfDay >= 20 * 60 && minuteOfDay < 20 * 60 + 55) {
    statusKey = 'overview.trading.powerHour'; color = 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
  } else if (weekday && minuteOfDay >= 14 * 60 + 30 && minuteOfDay < 21 * 60) {
    statusKey = 'overview.trading.rth'; color = 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  } else if (weekday && minuteOfDay >= 12 * 60 && minuteOfDay < 14 * 60 + 30) {
    statusKey = 'overview.trading.premarket'; color = 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
  } else if (weekday && minuteOfDay >= 8 * 60 && minuteOfDay < 11 * 60) {
    statusKey = 'overview.trading.london'; color = 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300'
  }

  const nextOpen = (() => {
    for (let offset = 0; offset <= 7; offset += 1) {
      const dayStamp = Date.UTC(parts.year, parts.month - 1, parts.day + offset, 12)
      const date = new Date(dayStamp)
      const weekdayIndex = date.getUTCDay()
      if (weekdayIndex === 0 || weekdayIndex === 6) continue
      const openings: { hour: number; minute: number; key: TranslationKey }[] = [
        { hour: 8, minute: 0, key: 'overview.trading.londonName' },
        { hour: 12, minute: 0, key: 'overview.trading.premarketName' },
        { hour: 14, minute: 30, key: 'overview.trading.rthName' },
      ]
      for (const opening of openings) {
        const instant = wallTimeToInstant(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), opening.hour, opening.minute)
        if (instant > now.getTime()) return { instant, key: opening.key }
      }
    }
    return null
  })()
  const countdown = nextOpen
    ? (() => { const minutes = Math.max(0, Math.floor((nextOpen.instant - now.getTime()) / 60_000)); return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m` })()
    : '—'

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="mb-1">{t('overview.trading.title')}</CardTitle>
          <p className="text-xs text-muted-foreground">{t('overview.trading.clock', { time: new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now) })}</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${color}`}>{t(statusKey)}</span>
      </div>
      <p className="mt-3 text-sm">{t('overview.trading.nextOpen', { session: nextOpen ? t(nextOpen.key) : '—', time: countdown })}</p>
      <ul className="mt-3 grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2">
        {sessions.map((session) => <li key={session.name} className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 ${session.active ? 'border-primary/50 bg-primary/10 font-semibold' : 'border-border text-muted-foreground'}`}>
          <span>{t(session.name)}</span><span className="tabular-nums">{session.range}</span>
        </li>)}
      </ul>
      <p className="mt-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">{t('overview.trading.warning')}</p>
      <p className="mt-2 text-[11px] text-muted-foreground">{t('overview.trading.scheduleNote')}</p>
    </Card>
  )
}
