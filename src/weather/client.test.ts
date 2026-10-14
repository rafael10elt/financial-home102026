import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  WEATHER_CACHE_KEY,
  fetchWeather,
  isFresh,
  loadCachedWeather,
  mapWmoCode,
  saveCachedWeather,
  type WeatherData,
} from './client'

const samplePayload = {
  current: {
    time: '2026-10-14T12:00',
    temperature_2m: 13.5,
    relative_humidity_2m: 78,
    apparent_temperature: 11.2,
    precipitation: 0.0,
    weather_code: 3,
    wind_speed_10m: 18.4,
  },
  hourly: {
    time: ['2026-10-14T12:00', '2026-10-14T13:00', '2026-10-15T00:00'],
    temperature_2m: [13.5, 13.8, 9.1],
    precipitation_probability: [10, 20, 40],
    weather_code: [3, 61, 1],
  },
  daily: {
    time: ['2026-10-14', '2026-10-15'],
    weather_code: [3, 80],
    temperature_2m_max: [14.0, 12.0],
    temperature_2m_min: [8.0, 7.0],
    precipitation_probability_max: [20, 60],
  },
}

function okFetch(payload: unknown = samplePayload) {
  return vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(payload) })
}

describe('mapWmoCode', () => {
  it('mapeia códigos conhecidos', () => {
    expect(mapWmoCode(0)).toBe('clear')
    expect(mapWmoCode(2)).toBe('partly_cloudy')
    expect(mapWmoCode(3)).toBe('overcast')
    expect(mapWmoCode(45)).toBe('fog')
    expect(mapWmoCode(53)).toBe('drizzle')
    expect(mapWmoCode(63)).toBe('rain')
    expect(mapWmoCode(71)).toBe('snow')
    expect(mapWmoCode(80)).toBe('showers')
    expect(mapWmoCode(95)).toBe('thunderstorm')
  })

  it('nunca inventa condição: código estranho vira unknown', () => {
    expect(mapWmoCode(-1)).toBe('unknown')
    expect(mapWmoCode(999)).toBe('unknown')
  })
})

describe('fetchWeather', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('interpreta a resposta e filtra a visão horária de hoje', async () => {
    const data = await fetchWeather(okFetch(), Date.parse('2026-10-14T12:30:00Z'))
    expect(data?.current.temperature).toBe(13.5)
    expect(data?.current.condition).toBe('overcast')
    expect(data?.hourlyToday).toHaveLength(2)
    expect(data?.hourlyToday[1]?.condition).toBe('rain')
    expect(data?.daily).toHaveLength(2)
    expect(data?.daily[1]?.condition).toBe('showers')
    expect(data?.source).toBe('open-meteo')
  })

  it('salva cache e considera fresco dentro do TTL', async () => {
    const now = Date.parse('2026-10-14T12:30:00Z')
    const data = await fetchWeather(okFetch(), now)
    expect(data).not.toBeNull()
    expect(loadCachedWeather()).toEqual(data)
    expect(isFresh(data as WeatherData, now)).toBe(true)
    expect(isFresh(data as WeatherData, now + 31 * 60 * 1000)).toBe(false)
  })

  it('em falha de rede preserva o último resultado válido', async () => {
    const now = Date.parse('2026-10-14T12:30:00Z')
    const cached = (await fetchWeather(okFetch(), now)) as WeatherData
    saveCachedWeather(cached)

    const failing = vi.fn().mockRejectedValue(new Error('offline'))
    const data = await fetchWeather(failing, now + 60 * 60 * 1000)
    expect(data).toEqual(cached)
  })

  it('sem cache e sem rede retorna null (indisponibilidade, sem inventar)', async () => {
    const failing = vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) })
    expect(await fetchWeather(failing)).toBeNull()
  })

  it('resposta inválida não gera dados fictícios', async () => {
    const data = await fetchWeather(okFetch({ current: null }))
    expect(data).toBeNull()
  })

  it('usa o fuso Europe/Dublin na URL', async () => {
    const fetchFn = okFetch()
    await fetchWeather(fetchFn)
    const url = String(fetchFn.mock.calls[0]?.[0] ?? '')
    expect(url).toContain('timezone=Europe%2FDublin')
    expect(url).toContain('api.open-meteo.com')
  })
})

describe('cache', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('ignora cache corrompido', () => {
    localStorage.setItem(WEATHER_CACHE_KEY, '%%% inválido %%%')
    expect(loadCachedWeather()).toBeNull()
  })
})
