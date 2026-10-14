import { describe, expect, it } from 'vitest'
import { duePeriods, periodKeyFor, type FinanceRecurrence } from './frecurrence'

function recurrence(partial: Partial<FinanceRecurrence>): FinanceRecurrence {
  return {
    frequency: 'monthly',
    interval_n: 1,
    start_date: '2026-01-15',
    end_date: null,
    occurrence_count: null,
    active: true,
    ...partial,
  }
}

describe('periodKeyFor', () => {
  it('formata a chave por frequência', () => {
    expect(periodKeyFor('monthly', '2026-10-15')).toBe('2026-10')
    expect(periodKeyFor('yearly', '2026-10-15')).toBe('2026')
    expect(periodKeyFor('daily', '2026-10-15')).toBe('2026-10-15')
    // 2026-10-14 é quarta: a semana começa na segunda 2026-10-12.
    expect(periodKeyFor('weekly', '2026-10-14')).toBe('2026-10-12')
  })
})

describe('duePeriods', () => {
  it('gera períodos mensais até o horizonte', () => {
    const periods = duePeriods(recurrence({}), '2026-03-31', new Set())
    expect(periods).toEqual([
      { period_key: '2026-01', date: '2026-01-15' },
      { period_key: '2026-02', date: '2026-02-15' },
      { period_key: '2026-03', date: '2026-03-15' },
    ])
  })

  it('pula períodos já existentes (idempotência)', () => {
    const periods = duePeriods(recurrence({}), '2026-03-31', new Set(['2026-01', '2026-02']))
    expect(periods).toEqual([{ period_key: '2026-03', date: '2026-03-15' }])
  })

  it('retry gera os mesmos períodos (sem duplicar)', () => {
    const first = duePeriods(recurrence({}), '2026-03-31', new Set())
    const second = duePeriods(recurrence({}), '2026-03-31', new Set(first.map((p) => p.period_key)))
    expect(second).toEqual([])
  })

  it('respeita término por data e por quantidade', () => {
    expect(duePeriods(recurrence({ end_date: '2026-02-28' }), '2026-12-31', new Set())).toHaveLength(2)
    expect(duePeriods(recurrence({ occurrence_count: 1 }), '2026-12-31', new Set())).toHaveLength(1)
  })

  it('recorrência inativa não gera nada', () => {
    expect(duePeriods(recurrence({ active: false }), '2026-12-31', new Set())).toEqual([])
  })

  it('gera períodos semanais e diários', () => {
    const weekly = duePeriods(
      recurrence({ frequency: 'weekly', start_date: '2026-10-12' }),
      '2026-10-26',
      new Set(),
    )
    expect(weekly.map((p) => p.period_key)).toEqual(['2026-10-12', '2026-10-19', '2026-10-26'])

    const daily = duePeriods(
      recurrence({ frequency: 'daily', start_date: '2026-10-12' }),
      '2026-10-13',
      new Set(),
    )
    expect(daily).toHaveLength(2)
  })
})
