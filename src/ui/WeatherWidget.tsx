import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import type { TranslationKey } from '../i18n/pt-BR'
import {
  DUBLIN_TIMEZONE,
  fetchWeather,
  isFresh,
  loadCachedWeather,
  type WeatherCondition,
  type WeatherData,
  type WeatherState,
} from '../weather/client'
import { Card, CardTitle } from './Card'
import { Button } from './Button'

function conditionKey(condition: WeatherCondition): TranslationKey {
  switch (condition) {
    case 'clear':
      return 'weather.clear'
    case 'partly_cloudy':
      return 'weather.partly_cloudy'
    case 'overcast':
      return 'weather.overcast'
    case 'fog':
      return 'weather.fog'
    case 'drizzle':
      return 'weather.drizzle'
    case 'rain':
      return 'weather.rain_cond'
    case 'freezing_rain':
      return 'weather.freezing_rain'
    case 'snow':
      return 'weather.snow'
    case 'showers':
      return 'weather.showers'
    case 'thunderstorm':
      return 'weather.thunderstorm'
    case 'unknown':
      return 'weather.unknown'
  }
}

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: DUBLIN_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
}

function formatHourLabel(iso: string): string {
  // Open-Meteo retorna as horas locais de Dublin sem offset no ISO.
  // Usar o texto evita reinterpretá-las no fuso do dispositivo do usuário.
  if (/T\d{2}:\d{2}/.test(iso)) return iso.slice(11, 16)
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: DUBLIN_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso))
}

function dublinDateAndHour(now: Date): { date: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: DUBLIN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return {
    date: `${values['year']}-${values['month']}-${values['day']}`,
    hour: Number(values['hour']),
    minute: Number(values['minute']),
  }
}

function durationLabel(totalMinutes: number): string {
  const hours = Math.floor(Math.max(0, totalMinutes) / 60)
  const minutes = Math.max(0, totalMinutes) % 60
  return `${hours}h ${String(minutes).padStart(2, '0')}m`
}

function formatDayLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: DUBLIN_TIMEZONE,
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)))
}

/**
 * Widget de clima de Dublin. Independente dos relógios e do restante da
 * Overview: falhas viram estado visível, nunca exceção.
 */
export function WeatherWidget() {
  const { t } = useI18n()
  const [state, setState] = useState<WeatherState>({ status: 'loading' })
  const [refreshing, setRefreshing] = useState(false)
  const [clock, setClock] = useState(() => Date.now())

  const load = useCallback(async (force: boolean) => {
    const cached = loadCachedWeather()
    if (!force && cached && isFresh(cached)) {
      setState({ status: 'ready', data: cached, stale: false })
      return
    }
    if (!force && cached) {
      // Mostra o cache imediatamente e tenta atualizar em segundo plano.
      setState({ status: 'ready', data: cached, stale: true })
    }
    setRefreshing(true)
    try {
      const data: WeatherData | null = await fetchWeather(fetch, Date.now())
      if (data) {
        setState({ status: 'ready', data, stale: !isFresh(data) })
      } else if (!cached) {
        setState({ status: 'unavailable' })
      }
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      void load(false)
    })
  }, [load])

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  async function handleRefresh() {
    await load(true)
  }

  const dublinNow = dublinDateAndHour(new Date(clock))
  const todayWeather = state.status === 'ready'
    ? state.data.daily.find((day) => day.date === dublinNow.date)
    : undefined
  const localNow = `${dublinNow.date}T${String(dublinNow.hour).padStart(2, '0')}:${String(dublinNow.minute).padStart(2, '0')}`
  const daylightStatus = (() => {
    if (!todayWeather?.sunrise || !todayWeather.sunset) return null
    const sunrise = todayWeather.sunrise.slice(0, 16)
    const sunset = todayWeather.sunset.slice(0, 16)
    const nextSunrise = state.status === 'ready'
      ? state.data.daily.find((day) => day.date > dublinNow.date)?.sunrise?.slice(0, 16)
      : undefined
    const target = localNow < sunrise ? sunrise : localNow < sunset ? sunset : nextSunrise
    if (!target) return null
    const [targetDate, targetTime] = target.split('T')
    const toWallClockUtc = (date: string, time: string) => {
      const [year, month, day] = date.split('-').map(Number)
      const [hour, minute] = time.split(':').map(Number)
      return Date.UTC(year, month - 1, day, hour, minute)
    }
    const remaining = Math.max(0, Math.round((toWallClockUtc(targetDate, targetTime) - toWallClockUtc(dublinNow.date, `${String(dublinNow.hour).padStart(2, '0')}:${String(dublinNow.minute).padStart(2, '0')}`)) / 60_000))
    return {
      sunrise: todayWeather.sunrise,
      sunset: todayWeather.sunset,
      text: localNow < sunrise
        ? t('weather.untilSunrise', { time: durationLabel(remaining) })
        : localNow < sunset
          ? t('weather.daylightRemaining', { time: durationLabel(remaining) })
          : t('weather.untilSunrise', { time: durationLabel(remaining) }),
    }
  })()

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-2">
        <CardTitle>{t('weather.title')}</CardTitle>
        <Button size="sm" variant="secondary" onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? t('common.loading') : t('weather.refresh')}
        </Button>
      </div>

      {state.status === 'loading' && (
        <p className="text-sm text-muted-foreground" role="status">
          {t('weather.loading')}
        </p>
      )}

      {state.status === 'unavailable' && (
        <p className="text-sm text-muted-foreground" role="alert">
          {t('weather.unavailable')}
        </p>
      )}

      {state.status === 'ready' && (
        <div className="flex flex-col gap-3">
          {state.stale && (
            <p className="text-xs text-destructive" role="status">
              {t('weather.stale')}
            </p>
          )}

          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-semibold tabular-nums">
              {Math.round(state.data.current.temperature)}°
            </span>
            <span className="text-sm text-muted-foreground">
              {t(conditionKey(state.data.current.condition))}
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4">
            <div>
              <dt className="sr-only">{t('weather.feelsLike', { value: '' }).replace(/\s*\S*$/, '')}</dt>
              <dd>{t('weather.feelsLike', { value: Math.round(state.data.current.feelsLike) })}</dd>
            </div>
            <div>
              <dd>{t('weather.humidity', { value: Math.round(state.data.current.humidity) })}</dd>
            </div>
            <div>
              <dd>{t('weather.wind', { value: Math.round(state.data.current.windSpeed) })}</dd>
            </div>
            <div>
              <dd>{t('weather.rain', { value: state.data.current.precipitation.toFixed(1) })}</dd>
            </div>
          </dl>

          {daylightStatus && (
            <dl className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">{t('weather.sunrise')}</dt>
                <dd className="font-medium tabular-nums">{formatHourLabel(daylightStatus.sunrise)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t('weather.sunset')}</dt>
                <dd className="font-medium tabular-nums">{formatHourLabel(daylightStatus.sunset)}</dd>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <dt className="text-xs text-muted-foreground">{t('weather.daylight')}</dt>
                <dd className="font-medium">{daylightStatus.text}</dd>
              </div>
            </dl>
          )}

          {state.data.hourlyToday.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('weather.today')}
              </p>
              <ol className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 xl:grid-cols-12 2xl:grid-cols-[repeat(24,minmax(0,1fr))]">
                {state.data.hourlyToday.map((point) => {
                  const date = point.time.slice(0, 10)
                  const hour = Number(point.time.slice(11, 13))
                  const isPast = date < dublinNow.date || (date === dublinNow.date && hour < dublinNow.hour)
                  const isCurrent = date === dublinNow.date && hour === dublinNow.hour
                  const hourLabel = formatHourLabel(point.time)
                  const hourDescription = isPast
                    ? t('weather.pastHour')
                    : isCurrent
                      ? t('weather.currentHour')
                      : ''
                  return (
                    <li
                      key={point.time}
                      aria-label={hourDescription ? `${hourLabel}, ${hourDescription}` : hourLabel}
                      className={`flex min-w-0 flex-col items-center rounded-md border border-border px-1.5 py-1.5 text-xs ${isPast ? 'opacity-40 grayscale' : ''} ${isCurrent ? 'ring-1 ring-primary' : ''}`}
                    >
                      <span className="text-muted-foreground tabular-nums">{hourLabel}</span>
                      <span className="font-semibold tabular-nums">{Math.round(point.temperature)}°</span>
                      <span className="text-muted-foreground tabular-nums">
                        {Math.round(point.precipitationProbability)}%
                      </span>
                    </li>
                  )
                })}
              </ol>
            </div>
          )}

          {state.data.daily.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('weather.nextDays')}
              </p>
              <ol className="flex flex-col divide-y divide-[var(--border)]">
                {state.data.daily.slice(0, 5).map((day) => (
                  <li key={day.date} className="flex items-center justify-between py-1.5 text-sm">
                    <span className="capitalize text-muted-foreground">{formatDayLabel(day.date)}</span>
                    <span>{t(conditionKey(day.condition))}</span>
                    <span className="tabular-nums">
                      {Math.round(day.min)}° / {Math.round(day.max)}°
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-muted-foreground">
            <span>{t('weather.updatedAt', { time: formatUpdatedAt(state.data.fetchedAt) })}</span>
            <a
              href="https://open-meteo.com/"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-foreground"
            >
              {t('weather.attribution')}
            </a>
          </div>
        </div>
      )}
    </Card>
  )
}
