import { describe, expect, it } from 'vitest'
import { accountBalance, consolidate, groupBy, type ReportTx } from './reports'

function tx(partial: Partial<ReportTx> & { id: string }): ReportTx {
  return {
    kind: 'expense',
    amount: '10.00',
    currency: 'EUR',
    status: 'pago',
    date: '2026-10-10',
    category_id: null,
    owner_id: null,
    account_id: 'acc-1',
    ...partial,
  }
}

describe('consolidate', () => {
  it('separa realizado de previsto e ignora cancelados', () => {
    const result = consolidate(
      [
        tx({ id: 'a', kind: 'income', amount: '100.00', status: 'recebido' }),
        tx({ id: 'b', kind: 'expense', amount: '30.00', status: 'pago' }),
        tx({ id: 'c', kind: 'expense', amount: '50.00', status: 'pendente', date: '2026-10-20' }),
        tx({ id: 'd', kind: 'expense', amount: '999.00', status: 'cancelado' }),
      ],
      'EUR',
      new Map(),
      '2026-10-14',
    )
    expect(result.incomeRealized.minor).toBe(10000)
    expect(result.expenseRealized.minor).toBe(3000)
    expect(result.expensePlanned.minor).toBe(5000)
    expect(result.balance.minor).toBe(7000)
    expect(result.pendingCount).toBe(1)
    expect(result.overdueCount).toBe(0)
  })

  it('deriva vencidos (pendente com data passada)', () => {
    const result = consolidate(
      [tx({ id: 'a', status: 'pendente', date: '2026-10-01' })],
      'EUR',
      new Map(),
      '2026-10-14',
    )
    expect(result.overdueCount).toBe(1)
    expect(result.pendingCount).toBe(1)
  })

  it('converte moedas e marca estimativa', () => {
    const result = consolidate(
      [tx({ id: 'a', kind: 'income', amount: '100.00', currency: 'BRL', status: 'recebido' })],
      'EUR',
      new Map([
        ['BRL->EUR', { base: 'BRL', target: 'EUR', rate: 0.165, source: 'manual', fetchedAt: 'x', manual: true }],
      ]),
      '2026-10-14',
    )
    expect(result.incomeRealized.minor).toBe(1650)
    expect(result.incomeRealized.estimated).toBe(true)
  })

  it('falha alto quando falta cotação (não inventa conversão)', () => {
    expect(() =>
      consolidate(
        [tx({ id: 'a', amount: '100.00', currency: 'BRL', status: 'recebido' })],
        'EUR',
        new Map(),
        '2026-10-14',
      ),
    ).toThrow(/cotação/)
  })
})

describe('groupBy', () => {
  it('agrupa por categoria com sinal (receita soma, despesa subtrai)', () => {
    const groups = groupBy(
      [
        tx({ id: 'a', kind: 'income', amount: '100.00', category_id: 'salario' }),
        tx({ id: 'b', kind: 'expense', amount: '40.00', category_id: 'salario' }),
      ],
      'category_id',
      'EUR',
      new Map(),
    )
    expect(groups.get('salario')?.minor).toBe(6000)
  })
})

describe('accountBalance', () => {
  it('soma abertura + confirmados e separa pendentes', () => {
    const result = accountBalance(10000, [
      { kind: 'in', minor: 5000, confirmed: true },
      { kind: 'out', minor: 2000, confirmed: true },
      { kind: 'in', minor: 3000, confirmed: false },
      { kind: 'out', minor: 1000, confirmed: false },
    ])
    expect(result.current).toBe(13000)
    expect(result.pendingIn).toBe(3000)
    expect(result.pendingOut).toBe(1000)
  })
})
