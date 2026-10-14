/**
 * Dinheiro com aritmética inteira (centavos).
 *
 * Regra inegociável: nenhum cálculo financeiro usa ponto flutuante.
 * Valores do banco (numeric) trafegam como string e viram centavos
 * inteiros aqui; formatação de exibição usa Intl.NumberFormat.
 */

export type Currency = 'EUR' | 'BRL'

const MINOR_UNITS: Record<Currency, number> = { EUR: 2, BRL: 2 }

export function currencyDecimals(currency: string): number {
  return (MINOR_UNITS as Record<string, number>)[currency] ?? 2
}

/** Converte "1234.56" (ou número) em centavos inteiros. Lança em inválido. */
export function toMinorUnits(value: string | number, currency: string): number {
  const decimals = currencyDecimals(currency)
  const text = typeof value === 'number' ? String(value) : value.trim().replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(text)) throw new Error(`Valor monetário inválido: ${value}`)
  const [whole, fraction = ''] = text.split('.') as [string, string]
  const padded = (fraction + '0'.repeat(decimals)).slice(0, decimals)
  const sign = whole.startsWith('-') ? -1 : 1
  const digits = (whole.replace('-', '') + padded).replace(/^0+(?=\d)/, '')
  const result = sign * Number(digits)
  if (!Number.isSafeInteger(result)) throw new Error(`Valor fora do intervalo seguro: ${value}`)
  return result
}

/** Converte centavos de volta para string decimal ("1234.56"). */
export function fromMinorUnits(minor: number, currency: string): string {
  if (!Number.isSafeInteger(minor)) throw new Error('Centavos inválidos.')
  const decimals = currencyDecimals(currency)
  const sign = minor < 0 ? '-' : ''
  const digits = String(Math.abs(minor)).padStart(decimals + 1, '0')
  const whole = digits.slice(0, digits.length - decimals)
  const fraction = digits.slice(digits.length - decimals)
  return `${sign}${whole}.${fraction}`
}

export function addMinor(a: number, b: number): number {
  const result = a + b
  if (!Number.isSafeInteger(result)) throw new Error('Estouro aritmético.')
  return result
}

export function subMinor(a: number, b: number): number {
  return addMinor(a, -b)
}

/** Multiplica centavos por um fator (ex.: taxa), arredondando meio para cima. */
export function mulMinor(minor: number, factor: number): number {
  const result = Math.round(minor * factor)
  if (!Number.isSafeInteger(result)) throw new Error('Estouro aritmético.')
  return result
}

export function formatMoney(minor: number, currency: string, locale = 'pt-BR'): string {
  const decimals = currencyDecimals(currency)
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(minor / 10 ** decimals)
}

/** Formata valor decimal vindo do banco. */
export function formatDecimal(value: string | number, currency: string, locale = 'pt-BR'): string {
  return formatMoney(toMinorUnits(value, currency), currency, locale)
}
