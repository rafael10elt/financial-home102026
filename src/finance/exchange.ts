/**
 * Câmbio: taxa efetiva × cotação de referência.
 *
 * - Taxa efetiva: calculada dos valores REAIS debitados/recebidos
 *   (effective_rate = to_amount / from_amount, por unidade de origem).
 * - Cotação de referência: estimativa para exibição/relatórios. Todo valor
 *   convertido por referência carrega a taxa, a fonte e o horário usados —
 *   e é sinalizado como estimativa na interface. Histórico confirmado nunca
 *   é recalculado quando a cotação muda.
 */

export type Quote = {
  base: string
  target: string
  rate: number
  source: string
  fetchedAt: string
  manual: boolean
}

export type ConvertedAmount = {
  originalMinor: number
  originalCurrency: string
  convertedMinor: number
  convertedCurrency: string
  rate: number
  source: string
  fetchedAt: string
  isEstimate: true
}

/** Taxa efetiva = quanto da moeda destino por 1 unidade da origem. */
export function effectiveRate(fromAmount: number, toAmount: number): number {
  if (!(fromAmount > 0) || !(toAmount > 0)) throw new Error('Valores devem ser positivos.')
  return toAmount / fromAmount
}

/**
 * Converte centavos pela cotação de referência.
 * Moedas com 2 casas (EUR/BRL): rate aplicado sobre o valor decimal.
 */
export function convertByQuote(
  minor: number,
  fromCurrency: string,
  quote: Quote,
): ConvertedAmount {
  if (quote.base !== fromCurrency) {
    throw new Error(`Cotação ${quote.base}→${quote.target} não serve para ${fromCurrency}.`)
  }
  const decimals = 2
  const value = minor / 10 ** decimals
  const convertedMinor = Math.round(value * quote.rate * 10 ** decimals)
  if (!Number.isSafeInteger(convertedMinor)) throw new Error('Estouro aritmético.')
  return {
    originalMinor: minor,
    originalCurrency: fromCurrency,
    convertedMinor,
    convertedCurrency: quote.target,
    rate: quote.rate,
    source: quote.source,
    fetchedAt: quote.fetchedAt,
    isEstimate: true,
  }
}

/** Normaliza par de moedas para busca (ordem alfabética). */
export function quotePair(a: string, b: string): { base: string; target: string; inverted: boolean } {
  if (a === b) throw new Error('Moedas iguais não precisam de cotação.')
  return a < b
    ? { base: a, target: b, inverted: false }
    : { base: b, target: a, inverted: true }
}
