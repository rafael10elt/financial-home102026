/**
 * Relatórios consolidados — funções puras sobre lançamentos.
 *
 * Regras aplicadas aqui (espelham o Mapa da Verdade):
 * - O consolidado lê SOMENTE financial_transactions_fh. Transferências vivem
 *   em tabela própria e nunca entram como receita/despesa.
 * - Status pagos contam no realizado; previstos/pendentes contam no previsto.
 *   Cancelados nunca contam. "Vencido" é derivado (pendente com data passada).
 * - Conversões para a moeda de exibição usam cotação de referência e saem
 *   marcadas como estimativa.
 */

import { convertByQuote, type Quote } from './exchange'
import { addMinor, toMinorUnits } from './money'

export type { Quote }

export type TxKind = 'income' | 'expense'
export type TxStatus = 'previsto' | 'pendente' | 'pago' | 'recebido' | 'cancelado'

export type ReportTx = {
  id: string
  kind: TxKind
  amount: string
  currency: string
  status: TxStatus
  date: string
  category_id: string | null
  owner_id: string | null
  account_id: string
}

export type ConvertedTotal = {
  minor: number
  currency: string
  estimated: boolean
  quotesUsed: { rate: number; source: string; fetchedAt: string }[]
}

function toDisplay(
  amount: string,
  currency: string,
  displayCurrency: string,
  quotes: Map<string, Quote>,
  quotesUsed: { rate: number; source: string; fetchedAt: string }[],
): number {
  if (currency === displayCurrency) return toMinorUnits(amount, currency)
  const direct = quotes.get(`${currency}->${displayCurrency}`)
  if (direct) {
    const converted = convertByQuote(toMinorUnits(amount, currency), currency, direct)
    quotesUsed.push({ rate: converted.rate, source: converted.source, fetchedAt: converted.fetchedAt })
    return converted.convertedMinor
  }
  const inverse = quotes.get(`${displayCurrency}->${currency}`)
  if (inverse && inverse.rate > 0) {
    const minor = toMinorUnits(amount, currency)
    const convertedMinor = Math.round((minor / inverse.rate))
    quotesUsed.push({ rate: inverse.rate, source: inverse.source, fetchedAt: inverse.fetchedAt })
    return convertedMinor
  }
  throw new Error(`Sem cotação ${currency}→${displayCurrency}.`)
}

export type Consolidation = {
  incomeRealized: ConvertedTotal
  expenseRealized: ConvertedTotal
  incomePlanned: ConvertedTotal
  expensePlanned: ConvertedTotal
  balance: ConvertedTotal
  pendingCount: number
  overdueCount: number
}

const REALIZED: TxStatus[] = ['pago', 'recebido']
const PLANNED: TxStatus[] = ['previsto', 'pendente']

function emptyTotal(currency: string): ConvertedTotal {
  return { minor: 0, currency, estimated: false, quotesUsed: [] }
}

export function consolidate(
  transactions: ReportTx[],
  displayCurrency: string,
  quotes: Map<string, Quote>,
  today: string,
): Consolidation {
  const incomeRealized = emptyTotal(displayCurrency)
  const expenseRealized = emptyTotal(displayCurrency)
  const incomePlanned = emptyTotal(displayCurrency)
  const expensePlanned = emptyTotal(displayCurrency)
  let pendingCount = 0
  let overdueCount = 0

  for (const tx of transactions) {
    if (tx.status === 'cancelado') continue
    const bucket = REALIZED.includes(tx.status)
      ? tx.kind === 'income'
        ? incomeRealized
        : expenseRealized
      : PLANNED.includes(tx.status)
        ? tx.kind === 'income'
          ? incomePlanned
          : expensePlanned
        : null
    if (!bucket) continue

    const minor = toDisplay(tx.amount, tx.currency, displayCurrency, quotes, bucket.quotesUsed)
    bucket.minor = addMinor(bucket.minor, minor)
    if (bucket.quotesUsed.length > 0) bucket.estimated = true

    if (PLANNED.includes(tx.status)) {
      pendingCount += 1
      if (tx.date < today) overdueCount += 1
    }
  }

  const balanceMinor = addMinor(
    incomeRealized.minor - expenseRealized.minor,
    0,
  )
  const balance: ConvertedTotal = {
    minor: balanceMinor,
    currency: displayCurrency,
    estimated: incomeRealized.estimated || expenseRealized.estimated,
    quotesUsed: [...incomeRealized.quotesUsed, ...expenseRealized.quotesUsed],
  }

  return {
    incomeRealized,
    expenseRealized,
    incomePlanned,
    expensePlanned,
    balance,
    pendingCount,
    overdueCount,
  }
}

export function groupBy(
  transactions: ReportTx[],
  key: 'category_id' | 'owner_id' | 'account_id',
  displayCurrency: string,
  quotes: Map<string, Quote>,
): Map<string, ConvertedTotal> {
  const groups = new Map<string, ConvertedTotal>()
  for (const tx of transactions) {
    if (tx.status === 'cancelado') continue
    const groupKey: string = tx[key] ?? 'sem-grupo'
    const total = groups.get(groupKey) ?? emptyTotal(displayCurrency)
    const signed = tx.kind === 'income' ? 1 : -1
    const minor = toDisplay(tx.amount, tx.currency, displayCurrency, quotes, total.quotesUsed)
    total.minor = addMinor(total.minor, signed * minor)
    if (total.quotesUsed.length > 0) total.estimated = true
    groups.set(groupKey, total)
  }
  return groups
}

/** Saldo de uma conta: abertura + entradas pagas − saídas pagas + transfer in − transfer out. */
export function accountBalance(
  openingMinor: number,
  movements: { kind: 'in' | 'out'; minor: number; confirmed: boolean }[],
): { current: number; pendingIn: number; pendingOut: number } {
  let current = openingMinor
  let pendingIn = 0
  let pendingOut = 0
  for (const movement of movements) {
    if (!movement.confirmed) {
      if (movement.kind === 'in') pendingIn = addMinor(pendingIn, movement.minor)
      else pendingOut = addMinor(pendingOut, movement.minor)
      continue
    }
    current = movement.kind === 'in' ? addMinor(current, movement.minor) : addMinor(current, -movement.minor)
  }
  return { current, pendingIn, pendingOut }
}
