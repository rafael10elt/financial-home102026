export const inputClass =
  'h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground'

export type Member = { user_id: string; display_name: string | null }

export type Category = { id: string; name: string; kind: string | null }

/** Normaliza entrada monetária ("1.234,56" ou "1234.56") para "1234.56". */
export function parseAmountInput(raw: string | number): string | null {
  let text = String(raw).trim().replace(/\s/g, '')
  if (text === '') return null
  const hasComma = text.includes(',')
  const hasDot = text.includes('.')
  if (hasComma && hasDot) {
    // O último separador é o decimal.
    if (text.lastIndexOf(',') > text.lastIndexOf('.')) {
      text = text.replace(/\./g, '').replace(',', '.')
    } else {
      text = text.replace(/,/g, '')
    }
  } else if (hasComma) {
    text = text.replace(',', '.')
  }
  if (!/^-?\d+(\.\d{1,2})?$/.test(text)) return null
  const value = Number(text)
  if (!Number.isFinite(value) || value <= 0) return null
  return value.toFixed(2)
}
