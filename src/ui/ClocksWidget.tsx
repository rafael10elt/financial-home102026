import { useI18n } from '../i18n'
import { formatCityClock, type CityKey } from '../lib/clocks'
import { useNow } from '../hooks/useNow'
import { Card } from './Card'

function Clock({ city, now }: { city: CityKey; now: Date }) {
  const { t } = useI18n()
  const clock = formatCityClock(now, city)
  const label = city === 'brasil' ? t('clock.brasilia') : t('clock.dublin')

  return (
    <div className="flex flex-col items-center gap-0.5" role="status" aria-live="off">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-2xl font-semibold tabular-nums" aria-label={`${label} ${clock.time}`}>
        {clock.time}
      </span>
      <span className="text-xs capitalize text-muted-foreground">{clock.weekday}</span>
      <span className="text-xs text-muted-foreground">{clock.date}</span>
    </div>
  )
}

/**
 * Relógios independentes de Brasília e Dublin.
 * Usam fusos IANA via Intl — sem diferença fixa, sem dependência de API.
 */
export function ClocksWidget() {
  const now = useNow()

  return (
    <Card>
      <div className="grid grid-cols-2 gap-4">
        <Clock city="brasil" now={now} />
        <Clock city="dublin" now={now} />
      </div>
    </Card>
  )
}
