import { describe, expect, it } from 'vitest'
import { parsePdfLines } from './pdf'

describe('parsePdfLines', () => {
  it('extrai candidatos de linhas com data + valor pt-BR', () => {
    const text = [
      'EXTRATO CONTA CORRENTE',
      '12/10/2026 MERCADO CENTRAL 123,45',
      '13/10/2026 SALARIO OUTUBRO 2.500,00',
      'SALDO ANTERIOR 999,99',
      'linha sem dados suficientes',
    ].join('\n')

    const candidates = parsePdfLines(text)
    expect(candidates).toHaveLength(2)
    expect(candidates[0]).toMatchObject({
      date: '2026-10-12',
      amountMinor: 12345,
    })
    expect(candidates[0]?.description).toContain('MERCADO')
    expect(candidates[1]).toMatchObject({
      date: '2026-10-13',
      amountMinor: 250000,
    })
  })

  it('ignora datas inexistentes', () => {
    const candidates = parsePdfLines('31/02/2026 FANTASMA 10,00')
    expect(candidates).toEqual([])
  })
})
