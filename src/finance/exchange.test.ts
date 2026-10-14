import { describe, expect, it } from 'vitest'
import { convertByQuote, effectiveRate, quotePair } from './exchange'

describe('exchange', () => {
  it('calcula taxa efetiva dos valores reais', () => {
    // Operação real: debitou 100 BRL, recebeu 16.50 EUR.
    expect(effectiveRate(100, 16.5)).toBeCloseTo(0.165, 10)
  })

  it('rejeita valores não positivos na taxa efetiva', () => {
    expect(() => effectiveRate(0, 10)).toThrow()
    expect(() => effectiveRate(-5, 10)).toThrow()
  })

  it('converte por cotação preservando a proveniência', () => {
    const converted = convertByQuote(10000, 'BRL', {
      base: 'BRL',
      target: 'EUR',
      rate: 0.165,
      source: 'manual',
      fetchedAt: '2026-10-14T10:00:00Z',
      manual: true,
    })
    expect(converted.convertedMinor).toBe(1650)
    expect(converted.convertedCurrency).toBe('EUR')
    expect(converted.isEstimate).toBe(true)
    expect(converted.source).toBe('manual')
  })

  it('rejeita cotação de par diferente', () => {
    expect(() =>
      convertByQuote(100, 'EUR', {
        base: 'BRL',
        target: 'EUR',
        rate: 0.165,
        source: 'x',
        fetchedAt: 'x',
        manual: false,
      }),
    ).toThrow()
  })

  it('normaliza o par de moedas', () => {
    expect(quotePair('BRL', 'EUR')).toEqual({ base: 'BRL', target: 'EUR', inverted: false })
    expect(quotePair('EUR', 'BRL')).toEqual({ base: 'BRL', target: 'EUR', inverted: true })
    expect(() => quotePair('EUR', 'EUR')).toThrow()
  })
})
