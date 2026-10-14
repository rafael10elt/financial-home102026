/**
 * Importação de CSV: parse, mapeamento de colunas e detecção de duplicatas.
 *
 * Tudo aqui é puro e revisável: nenhuma linha vira lançamento sem passar
 * pela prévia e pela confirmação explícita do usuário na interface.
 */

export type CsvDialect = {
  separator: ',' | ';' | '\t' | '|'
  dateFormat: 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY'
  decimalSeparator: '.' | ','
}

export type ColumnMapping = {
  date: number | null
  description: number | null
  amount: number | null
  currency: number | null
  category: number | null
}

export type ParsedRow = {
  lineNo: number
  raw: string[]
  date: string | null
  description: string | null
  amountMinor: number | null
  amountText: string | null
  currency: string | null
  categoryName: string | null
  errors: string[]
}

export type DuplicateHit = { rowIndex: number; existingId: string; reason: string }

export const DEFAULT_DIALECT: CsvDialect = {
  separator: ';',
  dateFormat: 'DD/MM/YYYY',
  decimalSeparator: ',',
}

export function sniffSeparator(header: string): CsvDialect['separator'] {
  const counts: Record<string, number> = { ';': 0, ',': 0, '\t': 0, '|': 0 }
  for (const char of header) {
    if (char in counts) counts[char] += 1
  }
  let best: CsvDialect['separator'] = ';'
  let bestCount = -1
  for (const sep of [';', ',', '\t', '|'] as const) {
    if (counts[sep] > bestCount) {
      bestCount = counts[sep]
      best = sep
    }
  }
  return best
}

/** Parser CSV com suporte a aspas e quebras de linha dentro de campo. */
export function parseCsv(text: string, separator: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  const pushField = () => {
    row.push(field)
    field = ''
  }
  const pushRow = () => {
    pushField()
    if (row.length > 1 || row[0]?.trim() !== '') rows.push(row)
    row = []
  }

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i] as string
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === separator) {
      pushField()
    } else if (char === '\r') {
      // Ignora; o \n fecha a linha.
    } else if (char === '\n') {
      pushRow()
    } else {
      field += char
    }
  }
  if (field !== '' || row.length > 0) pushRow()
  return rows
}

export function guessMapping(header: string[]): ColumnMapping {
  const normalized = header.map((h) =>
    h.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''),
  )
  const find = (...words: string[]): number | null => {
    for (let i = 0; i < normalized.length; i += 1) {
      if (words.some((w) => (normalized[i] ?? '').includes(w))) return i
    }
    return null
  }
  return {
    date: find('data', 'date', 'dt'),
    description: find('desc', 'historico', 'memo', 'lancamento', 'title'),
    amount: find('valor', 'amount', 'value', 'montante'),
    currency: find('moeda', 'currency', 'coin'),
    category: find('categoria', 'category', 'cat'),
  }
}

function parseDate(raw: string, format: CsvDialect['dateFormat']): string | null {
  const text = raw.trim()

  function parts(match: RegExpExecArray | null, order: ['d' | 'm' | 'y', 'd' | 'm' | 'y', 'd' | 'm' | 'y']): [string, string, string] | null {
    if (!match) return null
    const values: Record<'d' | 'm' | 'y', string> = { d: '', m: '', y: '' }
    values[order[0]] = match[1] as string
    values[order[1]] = match[2] as string
    values[order[2]] = match[3] as string
    return [values.d, values.m, values.y]
  }

  const parsed =
    format === 'DD/MM/YYYY'
      ? parts(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(text), ['d', 'm', 'y'])
      : format === 'YYYY-MM-DD'
        ? parts(/^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text), ['y', 'm', 'd'])
        : parts(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(text), ['m', 'd', 'y'])

  if (!parsed) return null
  const [day, month, year] = parsed
  const d = Number(day)
  const m = Number(month)
  const y = Number(year)
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > 2100) return null
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const check = new Date(Date.UTC(y, m - 1, d))
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    return null
  }
  return iso
}

function parseAmount(raw: string, decimalSeparator: '.' | ','): number | null {
  let text = raw.trim()
  if (text === '') return null
  // Remove separador de milhar (o oposto do decimal) e espaços.
  const thousand = decimalSeparator === ',' ? '.' : ','
  text = text.replace(/\s/g, '').replaceAll(thousand, '')
  if (decimalSeparator === ',') text = text.replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null
  const decimals = (text.split('.')[1] ?? '').length
  const minor = Math.round(Number(text) * 100)
  if (!Number.isSafeInteger(minor)) return null
  // Mais de 2 casas decimais: arredonda, mas sinaliza via texto original.
  void decimals
  return minor
}

const KNOWN_CURRENCIES = new Set(['EUR', 'BRL', 'USD', 'GBP'])

export function mapRows(
  rows: string[][],
  mapping: ColumnMapping,
  dialect: CsvDialect,
  defaultCurrency: string,
): ParsedRow[] {
  return rows.map((raw, index) => {
    const errors: string[] = []
    const cell = (column: number | null): string | null => {
      if (column === null || column >= raw.length) return null
      const value = (raw[column] ?? '').trim()
      return value === '' ? null : value
    }

    const dateText = cell(mapping.date)
    const date = dateText ? parseDate(dateText, dialect.dateFormat) : null
    if (mapping.date !== null && dateText && !date) errors.push(`Data inválida: "${dateText}".`)

    const description = cell(mapping.description)

    const amountText = cell(mapping.amount)
    const amountMinor = amountText ? parseAmount(amountText, dialect.decimalSeparator) : null
    if (mapping.amount !== null && amountText && amountMinor === null) {
      errors.push(`Valor inválido: "${amountText}".`)
    }

    const currencyRaw = (cell(mapping.currency) ?? defaultCurrency).toUpperCase()
    const currency = KNOWN_CURRENCIES.has(currencyRaw) ? currencyRaw : null
    if (!currency) errors.push(`Moeda desconhecida: "${currencyRaw}".`)

    return {
      lineNo: index + 1,
      raw,
      date,
      description,
      amountMinor,
      amountText,
      currency,
      categoryName: cell(mapping.category),
      errors,
    }
  })
}

/** Normaliza descrição para comparar possíveis duplicatas. */
export function normalizeDescription(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * Detecta possíveis duplicatas contra lançamentos existentes.
 * Critério conservador: mesma data + mesmo valor em centavos + descrição
 * normalizada igual. Resultado é SUGESTÃO para revisão, nunca bloqueio.
 */
export function detectDuplicates(
  rows: ParsedRow[],
  existing: { id: string; date: string; amountMinor: number; description: string }[],
): DuplicateHit[] {
  const byKey = new Map<string, string>()
  for (const tx of existing) {
    byKey.set(`${tx.date}|${tx.amountMinor}|${normalizeDescription(tx.description)}`, tx.id)
  }
  const hits: DuplicateHit[] = []
  rows.forEach((row, rowIndex) => {
    if (!row.date || row.amountMinor === null || !row.description) return
    const key = `${row.date}|${row.amountMinor}|${normalizeDescription(row.description)}`
    const existingId = byKey.get(key)
    if (existingId) {
      hits.push({ rowIndex, existingId, reason: 'Data, valor e descrição idênticos.' })
    }
  })
  return hits
}
