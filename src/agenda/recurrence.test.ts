import { describe, expect, it } from 'vitest'
import { expandRecurrence, type RecurrenceRule } from './recurrence'

function rule(partial: Partial<RecurrenceRule>): RecurrenceRule {
  return {
    frequency: 'daily',
    interval_n: 1,
    days_of_week: null,
    month_day: null,
    start_date: '2026-01-01',
    end_date: null,
    occurrence_count: null,
    timezone: 'Europe/Dublin',
    ...partial,
  }
}

describe('expandRecurrence', () => {
  it('gera série diária simples', () => {
    const result = expandRecurrence(rule({}), [], '2026-01-01', '2026-01-03')
    expect(result.map((o) => o.date)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03'])
  })

  it('respeita intervalo (a cada 2 dias)', () => {
    const result = expandRecurrence(rule({ interval_n: 2 }), [], '2026-01-01', '2026-01-06')
    expect(result.map((o) => o.date)).toEqual(['2026-01-01', '2026-01-03', '2026-01-05'])
  })

  it('gera série semanal nos dias configurados', () => {
    // 2026-01-05 é segunda-feira; 2026-01-07 é quarta-feira.
    const result = expandRecurrence(
      rule({ frequency: 'weekly', start_date: '2026-01-05', days_of_week: [1, 3] }),
      [],
      '2026-01-05',
      '2026-01-14',
    )
    expect(result.map((o) => o.date)).toEqual([
      '2026-01-05',
      '2026-01-07',
      '2026-01-12',
      '2026-01-14',
    ])
  })

  it('gera série mensal com ajuste de fim de mês', () => {
    const result = expandRecurrence(
      rule({ frequency: 'monthly', start_date: '2026-01-31' }),
      [],
      '2026-01-01',
      '2026-04-30',
    )
    // Fevereiro de 2026 tem 28 dias: a ocorrência é ajustada, não perdida.
    expect(result.map((o) => o.date)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ])
  })

  it('gera série anual', () => {
    const result = expandRecurrence(
      rule({ frequency: 'yearly', start_date: '2025-06-10' }),
      [],
      '2026-01-01',
      '2028-12-31',
    )
    expect(result.map((o) => o.date)).toEqual(['2026-06-10', '2027-06-10', '2028-06-10'])
  })

  it('limita por data final e por quantidade', () => {
    const byDate = expandRecurrence(
      rule({ end_date: '2026-01-03' }),
      [],
      '2026-01-01',
      '2026-01-10',
    )
    expect(byDate).toHaveLength(3)

    const byCount = expandRecurrence(
      rule({ occurrence_count: 2 }),
      [],
      '2026-01-01',
      '2026-01-10',
    )
    expect(byCount.map((o) => o.date)).toEqual(['2026-01-01', '2026-01-02'])
  })

  it('pula ocorrências marcadas como skipped', () => {
    const result = expandRecurrence(
      rule({}),
      [{ original_date: '2026-01-02', action: 'skipped', new_start_at: null }],
      '2026-01-01',
      '2026-01-03',
    )
    expect(result.map((o) => o.date)).toEqual(['2026-01-01', '2026-01-03'])
  })

  it('adia ocorrências marcadas como postponed', () => {
    const result = expandRecurrence(
      rule({}),
      [
        {
          original_date: '2026-01-02',
          action: 'postponed',
          new_start_at: '2026-01-04T10:00:00+00:00',
        },
      ],
      '2026-01-01',
      '2026-01-03',
    )
    expect(result).toEqual([
      { date: '2026-01-01', postponedTo: null },
      { date: '2026-01-02', postponedTo: '2026-01-04T10:00:00+00:00' },
      { date: '2026-01-03', postponedTo: null },
    ])
  })

  it('atravessa a mudança de horário de verão sem deslocar dias', () => {
    // Dublin entra em DST em 29/03/2026: a série diária não pode pular nem repetir dias.
    const result = expandRecurrence(rule({ start_date: '2026-03-27' }), [], '2026-03-27', '2026-03-31')
    expect(result.map((o) => o.date)).toEqual([
      '2026-03-27',
      '2026-03-28',
      '2026-03-29',
      '2026-03-30',
      '2026-03-31',
    ])
  })

  it('retorna vazio quando a janela termina antes do início', () => {
    expect(expandRecurrence(rule({}), [], '2026-02-01', '2026-01-01')).toEqual([])
  })
})
