import { describe, expect, it } from 'vitest'
import { parseAmountInput } from './financeForm'

describe('parseAmountInput', () => {
  it('aceita formatos pt-BR e internacionais', () => {
    expect(parseAmountInput('1.234,56')).toBe('1234.56')
    expect(parseAmountInput('1234,56')).toBe('1234.56')
    expect(parseAmountInput('1234.56')).toBe('1234.56')
    expect(parseAmountInput('10')).toBe('10.00')
  })

  it('rejeita zero, negativo e lixo', () => {
    expect(parseAmountInput('0')).toBeNull()
    expect(parseAmountInput('0,00')).toBeNull()
    expect(parseAmountInput('-5')).toBeNull()
    expect(parseAmountInput('abc')).toBeNull()
    expect(parseAmountInput('')).toBeNull()
    expect(parseAmountInput('12.345')).toBeNull()
  })
})
