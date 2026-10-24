/**
 * Clima de Dublin via Open-Meteo (sem chave).
 *
 * Termos verificados em 2026-10-14 (open-meteo.com/en/terms): uso gratuito
 * para fins não comerciais (o app é privado, sem assinaturas nem anúncios),
 * limites de 10.000 chamadas/dia, 5.000/hora e 600/minuto, licença CC-BY 4.0
 * — por isso o widget exibe a atribuição obrigatória.
 *
 * Estratégia de rede: no máximo 1 chamada a cada 30 minutos (fora o botão
 * manual), cache em localStorage, e em falha preserva o último resultado
 * válido marcado como desatualizado. O widget de clima nunca quebra a
 * Overview: todo erro vira estado, nunca exceção.
 */

export const DUBLIN_LATITUDE = 53.3498
export const DUBLIN_LONGITUDE = -6.2603
export const DUBLIN_TIMEZONE = 'Europe/Dublin'
export const WEATHER_CACHE_KEY = 'fh.weather.v1'
export const WEATHER_TTL_MS = 30 * 60 * 1000

export type WeatherCondition =
  | 'clear'
  | 'partly_cloudy'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'freezing_rain'
  | 'snow'
  | 'showers'
  | 'thunderstorm'
  | 'unknown'

export type CurrentWeather = {
  temperature: number
  feelsLike: number
  humidity: number
  condition: WeatherCondition
  precipitation: number
  windSpeed: number
  time: string
}

export type HourlyPoint = {
  time: string
  temperature: number
  precipitationProbability: number
  condition: WeatherCondition
}

export type DailyPoint = {
  date: string
  condition: WeatherCondition
  max: number
  min: number
  precipitationProbability: number
  sunrise: string | null
  sunset: string | null
}

export type WeatherData = {
  current: CurrentWeather
  hourlyToday: HourlyPoint[]
  daily: DailyPoint[]
  fetchedAt: string
  source: 'open-meteo'
}

export type WeatherState =
  | { status: 'loading' }
  | { status: 'ready'; data: WeatherData; stale: boolean }
  | { status: 'unavailable' }

export function mapWmoCode(code: number): WeatherCondition {
  // Códigos WMO 4677 válidos vão de 0 a 99. Qualquer valor fora disso é
  // tratado como desconhecido — nunca inventamos condição do tempo.
  if (!Number.isInteger(code) || code < 0 || code > 99) return 'unknown'
  if (code === 0) return 'clear'
  if (code === 1 || code === 2) return 'partly_cloudy'
  if (code === 3) return 'overcast'
  if (code === 45 || code === 48) return 'fog'
  if (code >= 51 && code <= 57) return 'drizzle'
  if (code === 66 || code === 67) return 'freezing_rain'
  if (code === 61 || code === 63 || code === 65) return 'rain'
  if (code === 71 || code === 73 || code === 75 || code === 77 || code === 85 || code === 86) {
    return 'snow'
  }
  if (code === 80 || code === 81 || code === 82) return 'showers'
  if (code >= 95) return 'thunderstorm'
  return 'unknown'
}

function buildUrl(): string {
  const params = new URLSearchParams({
    latitude: String(DUBLIN_LATITUDE),
    longitude: String(DUBLIN_LONGITUDE),
    current:
      'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m',
    hourly: 'temperature_2m,precipitation_probability,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
    timezone: DUBLIN_TIMEZONE,
    forecast_days: '7',
    wind_speed_unit: 'kmh',
  })
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`
}

type OpenMeteoResponse = {
  current?: {
    time?: string
    temperature_2m?: number
    relative_humidity_2m?: number
    apparent_temperature?: number
    precipitation?: number
    weather_code?: number
    wind_speed_10m?: number
  }
  hourly?: {
    time?: string[]
    temperature_2m?: (number | null)[]
    precipitation_probability?: (number | null)[]
    weather_code?: (number | null)[]
  }
  daily?: {
    time?: string[]
    weather_code?: (number | null)[]
    temperature_2m_max?: (number | null)[]
    temperature_2m_min?: (number | null)[]
    precipitation_probability_max?: (number | null)[]
    sunrise?: (string | null)[]
    sunset?: (string | null)[]
  }
}

function toNumber(value: unknown, fallback = Number.NaN): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function parseResponse(payload: OpenMeteoResponse, fetchedAt: string): WeatherData | null {
  const current = payload.current
  if (!current || typeof current.time !== 'string') return null

  const temperature = toNumber(current.temperature_2m)
  if (Number.isNaN(temperature)) return null

  const hourlyTimes = payload.hourly?.time ?? []
  const today = current.time.slice(0, 10)
  const hourlyToday: HourlyPoint[] = []
  for (let index = 0; index < hourlyTimes.length; index += 1) {
    const time = hourlyTimes[index]
    if (!time.startsWith(today)) continue
    hourlyToday.push({
      time,
      temperature: toNumber(payload.hourly?.temperature_2m?.[index], temperature),
      precipitationProbability: toNumber(payload.hourly?.precipitation_probability?.[index], 0),
      condition: mapWmoCode(toNumber(payload.hourly?.weather_code?.[index], -1)),
    })
  }

  const dailyTimes = payload.daily?.time ?? []
  const daily: DailyPoint[] = dailyTimes.map((date, index) => ({
    date,
    condition: mapWmoCode(toNumber(payload.daily?.weather_code?.[index], -1)),
    max: toNumber(payload.daily?.temperature_2m_max?.[index]),
    min: toNumber(payload.daily?.temperature_2m_min?.[index]),
    precipitationProbability: toNumber(payload.daily?.precipitation_probability_max?.[index], 0),
    sunrise: payload.daily?.sunrise?.[index] ?? null,
    sunset: payload.daily?.sunset?.[index] ?? null,
  }))

  return {
    current: {
      temperature,
      feelsLike: toNumber(current.apparent_temperature, temperature),
      humidity: toNumber(current.relative_humidity_2m),
      condition: mapWmoCode(toNumber(current.weather_code, -1)),
      precipitation: toNumber(current.precipitation, 0),
      windSpeed: toNumber(current.wind_speed_10m, 0),
      time: current.time,
    },
    hourlyToday,
    daily,
    fetchedAt,
    source: 'open-meteo',
  }
}

export function loadCachedWeather(): WeatherData | null {
  try {
    const raw = localStorage.getItem(WEATHER_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { data?: WeatherData }
    if (!parsed.data || parsed.data.source !== 'open-meteo') return null
    return parsed.data
  } catch {
    return null
  }
}

export function isFresh(data: WeatherData, now: number = Date.now()): boolean {
  const fetched = Date.parse(data.fetchedAt)
  if (Number.isNaN(fetched)) return false
  return now - fetched < WEATHER_TTL_MS
}

export function saveCachedWeather(data: WeatherData): void {
  try {
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ data }))
  } catch {
    // Armazenamento indisponível: o cache é opcional, a app segue sem ele.
  }
}

type FetchFn = (input: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>

/**
 * Busca o clima. Em falha, devolve o cache (marcado como desatualizado pelo
 * chamador via `isFresh`) ou `null` quando não há nada preservado.
 * Nunca lança exceção.
 */
export async function fetchWeather(
  fetchFn: FetchFn = fetch as unknown as FetchFn,
  now: number = Date.now(),
): Promise<WeatherData | null> {
  try {
    const response = await fetchFn(buildUrl())
    if (!response.ok) return loadCachedWeather()
    const payload = (await response.json()) as OpenMeteoResponse
    const fetchedAt = new Date(now).toISOString()
    const data = parseResponse(payload, fetchedAt)
    if (!data) return loadCachedWeather()
    saveCachedWeather(data)
    return data
  } catch {
    return loadCachedWeather()
  }
}
