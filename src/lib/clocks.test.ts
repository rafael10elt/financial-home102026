import { describe, expect, it } from 'vitest'
import { formatCityClock, hoursDifferenceOn, CITY_TIMEZONES } from '../lib/clocks'

describe('relógios de Brasília e Dublin', () => {
  it('usa nomes IANA de fuso', () => {
    expect(CITY_TIMEZONES.brasil).toBe('America/Sao_Paulo')
    expect(CITY_TIMEZONES.dublin).toBe('Europe/Dublin')
  })

  it('formata 24h com data local de cada cidade', () => {
    const instant = new Date('2026-01-15T12:00:00Z')
    const brasilia = formatCityClock(instant, 'brasil')
    const dublin = formatCityClock(instant, 'dublin')

    // 12:00 UTC = 09:00 em Brasília (UTC-3, sem DST) e 12:00 em Dublin (UTC+0 no inverno).
    expect(brasilia.time).toBe('09:00')
    expect(dublin.time).toBe('12:00')
    expect(brasilia.date).toBe('15/01/2026')
    expect(dublin.date).toBe('15/01/2026')
  })

  it('não usa diferença fixa entre cidades (DST muda a diferença)', () => {
    // Verão no hemisfério norte: Dublin UTC+1, Brasília UTC-3 => 4 horas.
    const winter = hoursDifferenceOn(new Date('2026-07-10T12:00:00Z'))
    // Inverno no hemisfério norte: Dublin UTC+0 => 3 horas.
    const summer = hoursDifferenceOn(new Date('2026-01-10T12:00:00Z'))

    expect(summer).toBe(3)
    expect(winter).toBe(4)
  })

  it('reflete a troca de horário de verão em Dublin', () => {
    const beforeDst = formatCityClock(new Date('2026-03-28T12:00:00Z'), 'dublin')
    const afterDst = formatCityClock(new Date('2026-03-30T12:00:00Z'), 'dublin')
    expect(beforeDst.time).toBe('12:00')
    expect(afterDst.time).toBe('13:00')
  })
})
