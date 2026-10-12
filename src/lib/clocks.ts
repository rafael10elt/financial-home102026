/**
 * Relógios locais usando fusos IANA.
 * Nunca calculamos diferença fixa entre cidades: cada cidade é formatada
 * diretamente com `Intl.DateTimeFormat` e o fuso IANA correspondente,
 * o que respeita automaticamente o horário de verão.
 */

export const CITY_TIMEZONES = {
  brasil: 'America/Sao_Paulo',
  dublin: 'Europe/Dublin',
} as const

export type CityKey = keyof typeof CITY_TIMEZONES

export type CityClock = {
  time: string
  date: string
  weekday: string
  timeZone: string
}

const timeFormatterCache = new Map<string, Intl.DateTimeFormat>()
const dateFormatterCache = new Map<string, Intl.DateTimeFormat>()
const weekdayFormatterCache = new Map<string, Intl.DateTimeFormat>()

function getTimeFormatter(timeZone: string, hour12: boolean): Intl.DateTimeFormat {
  const key = `${timeZone}|${hour12}`
  let formatter = timeFormatterCache.get(key)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      ...(hour12 ? {} : { hourCycle: 'h23' }),
    })
    timeFormatterCache.set(key, formatter)
  }
  return formatter
}

function getDateFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = dateFormatterCache.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
    dateFormatterCache.set(timeZone, formatter)
  }
  return formatter
}

function getWeekdayFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = weekdayFormatterCache.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      weekday: 'long',
      day: '2-digit',
      month: 'long',
    })
    weekdayFormatterCache.set(timeZone, formatter)
  }
  return formatter
}

export function formatCityClock(
  instant: Date,
  city: CityKey,
  options: { hour12?: boolean } = {},
): CityClock {
  const timeZone = CITY_TIMEZONES[city]
  return {
    time: getTimeFormatter(timeZone, options.hour12 ?? false).format(instant),
    date: getDateFormatter(timeZone).format(instant),
    weekday: getWeekdayFormatter(timeZone).format(instant),
    timeZone,
  }
}

function offsetHoursAt(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0')

  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  )
  return (asUtc - instant.getTime()) / 3_600_000
}

/**
 * Diferença (horas) entre Brasília e Dublin num instante dado.
 * Muda conforme o horário de verão — prova de que não usamos offset fixo.
 */
export function hoursDifferenceOn(instant: Date): number {
  return (
    offsetHoursAt(instant, CITY_TIMEZONES.dublin) - offsetHoursAt(instant, CITY_TIMEZONES.brasil)
  )
}
