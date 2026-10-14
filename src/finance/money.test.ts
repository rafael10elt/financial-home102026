import { describe, expect, it } from 'vitest'
import {
  addMinor,
  formatDecimal,
  formatMoney,
  fromMinorUnits,
  mulMinor,
  toMinorUnits,
} from './money'

describe('money', () => {
  it('converte decimal em centavos sem ponto flutuante', () => {
    expect(toMinorUnits('1234.56', 'EUR')).toBe(123456)
    expect(toMinorUnits('0.1', 'EUR') + toMinorUnits('0.2', 'EUR')).toBe(30)
    expect(toMinorUnits('-10.50', 'BRL')).toBe(-1050)
  })

  it('rejeita valores inválidos', () => {
    expect(() => toMinorUnits('abc', 'EUR')).toThrow()
    expect(() => toMinorUnits('', 'EUR')).toThrow()
    expect(() => toMinorUnits('12.345.67', 'EUR')).toThrow()
  })

  it('converte centavos de volta para decimal', () => {
    expect(fromMinorUnits(123456, 'EUR')).toBe('1234.56')
    expect(fromMinorUnits(-1050, 'BRL')).toBe('-10.50')
    expect(fromMinorUnits(0, 'EUR')).toBe('0.00')
  })

  it('soma e multiplica em inteiros', () => {
    expect(addMinor(100, 200)).toBe(300)
    // 10% de 199 centavos = 19.9 -> 20 (meio para cima).
    expect(mulMinor(199, 0.1)).toBe(20)
  })

  it('formata em EUR e BRL (pt-BR)', () => {
    expect(formatMoney(123456, 'EUR')).toContain('€')
    expect(formatMoney(123456, 'EUR')).toContain('1.234,56')
    expect(formatDecimal('1234.56', 'BRL')).toContain('R$')
  })
})
