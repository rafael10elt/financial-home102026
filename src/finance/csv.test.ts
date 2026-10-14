import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DIALECT,
  detectDuplicates,
  guessMapping,
  mapRows,
  normalizeDescription,
  parseCsv,
  sniffSeparator,
  type ColumnMapping,
} from './csv'

const mapping: ColumnMapping = { date: 0, description: 1, amount: 2, currency: 3, category: null }

describe('parseCsv', () => {
  it('separa campos com ponto e vírgula, ponto decimal e aspas', () => {
    const rows = parseCsv('data;descricao;valor\n12/10/2026;"Mercado, centro";123,45\n', ';')
    expect(rows).toEqual([
      ['data', 'descricao', 'valor'],
      ['12/10/2026', 'Mercado, centro', '123,45'],
    ])
  })

  it('detecta o separador pelo cabeçalho', () => {
    expect(sniffSeparator('data;descricao;valor')).toBe(';')
    expect(sniffSeparator('date,description,amount')).toBe(',')
  })
})

describe('guessMapping', () => {
  it('acha colunas por nome em pt e en', () => {
    expect(guessMapping(['Data', 'Histórico', 'Valor', 'Moeda'])).toEqual({
      date: 0,
      description: 1,
      amount: 2,
      currency: 3,
      category: null,
    })
    expect(guessMapping(['date', 'memo', 'amount'])).toMatchObject({ date: 0, amount: 2 })
  })
})

describe('mapRows', () => {
  it('converte data e valor pt-BR', () => {
    const [row] = mapRows([['12/10/2026', 'Mercado', '123,45', 'EUR']], mapping, DEFAULT_DIALECT, 'EUR')
    expect(row?.date).toBe('2026-10-12')
    expect(row?.amountMinor).toBe(12345)
    expect(row?.errors).toEqual([])
  })

  it('aponta erros sem bloquear as demais linhas', () => {
    const rows = mapRows(
      [
        ['32/13/2026', 'Ruim', 'abc', 'EUR'],
        ['12/10/2026', 'Boa', '10,00', 'EUR'],
      ],
      mapping,
      DEFAULT_DIALECT,
      'EUR',
    )
    expect(rows[0]?.errors.length).toBeGreaterThan(0)
    expect(rows[0]?.date).toBeNull()
    expect(rows[1]?.errors).toEqual([])
  })

  it('rejeita data inexistente como 31/02', () => {
    const [row] = mapRows([['31/02/2026', 'X', '1,00', 'EUR']], mapping, DEFAULT_DIALECT, 'EUR')
    expect(row?.date).toBeNull()
  })
})

describe('duplicates', () => {
  it('normaliza descrição ignorando acento e caixa', () => {
    expect(normalizeDescription('Mercadó  SÃO  Paulo!')).toBe('mercado sao paulo')
  })

  it('sugere duplicata por data + valor + descrição', () => {
    const rows = mapRows([['12/10/2026', 'Mercado', '123,45', 'EUR']], mapping, DEFAULT_DIALECT, 'EUR')
    const hits = detectDuplicates(rows, [
      { id: 'tx-1', date: '2026-10-12', amountMinor: 12345, description: 'mercado' },
      { id: 'tx-2', date: '2026-10-11', amountMinor: 12345, description: 'mercado' },
    ])
    expect(hits).toEqual([
      { rowIndex: 0, existingId: 'tx-1', reason: 'Data, valor e descrição idênticos.' },
    ])
  })
})
