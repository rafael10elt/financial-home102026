import { describe, expect, it } from 'vitest'
import {
  addMonthsKey,
  computeEnergyEstimate,
  cycleEndKey,
  daysBetween,
  energyCostMinor,
  normalizeReadings,
  parseDecimal,
  readingDeltas,
  type EnergyConfig,
} from './energy'

const base: EnergyConfig = {
  currency: 'EUR',
  pricePerKwh: 0.25,
  fixedFee: 5,
  initialReading: 1000,
  currentReading: 1100,
  cycleStart: '2026-11-01',
  cycleMonths: 1,
  readings: [],
}

describe('energy', () => {
  it('aceita vírgula e texto inválido sem quebrar', () => {
    expect(parseDecimal('123,45')).toBe(123.45)
    expect(parseDecimal(' 12.5 ')).toBe(12.5)
    expect(parseDecimal('abc')).toBe(0)
    expect(parseDecimal(null)).toBe(0)
  })

  it('calcula o custo em centavos com taxa fixa', () => {
    // 100 kWh × 0,25 = 25,00 + 5,00 fixo = 3000 centavos.
    expect(energyCostMinor(100, 0.25, 5)).toBe(3000)
    expect(energyCostMinor(0, 0.25, 5)).toBe(500)
    expect(energyCostMinor(12.345, 0.3142, 0)).toBe(388)
  })

  it('encontra o fim do ciclo respeitando meses curtos', () => {
    expect(cycleEndKey('2026-11-05')).toBe('2026-12-04')
    expect(cycleEndKey('2026-11-05', 2)).toBe('2027-01-04')
    expect(cycleEndKey('2026-01-31')).toBe('2026-02-27')
    expect(cycleEndKey('2026-12-15')).toBe('2027-01-14')
    expect(addMonthsKey('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonthsKey('2028-01-31', 1)).toBe('2028-02-29')
  })

  it('projeta um ciclo bimestral', () => {
    const estimate = computeEnergyEstimate(
      { ...base, cycleStart: '2026-11-05', cycleMonths: 2 },
      '2026-12-04',
    )
    expect(estimate.cycleStart).toBe('2026-11-05')
    expect(estimate.cycleEnd).toBe('2027-01-04')
    expect(estimate.cycleDays).toBe(61)
    expect(estimate.daysElapsed).toBe(30)
    expect(estimate.daysLeft).toBe(31)
    expect(estimate.percent).toBe(49)
    expect(estimate.projectedKwh).toBeCloseTo(203.33, 1)
  })

  it('projeta o mês a partir da média diária', () => {
    const estimate = computeEnergyEstimate(base, '2026-11-10')
    expect(estimate.consumptionKwh).toBe(100)
    expect(estimate.cycleDays).toBe(30)
    expect(estimate.daysElapsed).toBe(10)
    expect(estimate.daysLeft).toBe(20)
    expect(estimate.dailyAverageKwh).toBe(10)
    expect(estimate.projectedKwh).toBe(300)
    expect(estimate.costMinor).toBe(3000)
    expect(estimate.projectedCostMinor).toBe(8000)
    expect(estimate.percent).toBe(33)
  })

  it('não projeta além do ciclo encerrado', () => {
    const estimate = computeEnergyEstimate(base, '2026-12-05')
    expect(estimate.daysElapsed).toBe(30)
    expect(estimate.daysLeft).toBe(0)
    expect(estimate.projectedKwh).toBe(100)
  })

  it('ignora consumo negativo e datas anteriores ao ciclo', () => {
    const estimate = computeEnergyEstimate({ ...base, currentReading: 900 }, '2026-10-20')
    expect(estimate.consumptionKwh).toBe(0)
    expect(estimate.daysElapsed).toBe(0)
    expect(estimate.projectedKwh).toBe(0)
    expect(daysBetween('2026-11-01', '2026-11-10')).toBe(9)
  })

  it('calcula a evolução entre leituras', () => {
    expect(
      readingDeltas([
        { date: '2026-11-01', reading: 1000 },
        { date: '2026-11-10', reading: 1040 },
        { date: '2026-11-20', reading: 1090 },
        { date: '2026-11-25', reading: 1080 },
      ]),
    ).toEqual([
      { date: '2026-11-10', kwh: 40 },
      { date: '2026-11-20', kwh: 50 },
    ])
  })

  it('normaliza histórico inválido', () => {
    expect(
      normalizeReadings([
        { date: '2026-11-10', reading: '1040,5' },
        { date: '10/11/2026', reading: 10 },
        { date: '2026-11-20', reading: -3 },
        null,
      ]),
    ).toEqual([{ date: '2026-11-10', reading: 1040.5 }])
  })
})
