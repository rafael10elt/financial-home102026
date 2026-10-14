/**
 * Extração de texto de PDF (importação financeira).
 *
 * - pdfjs-dist é carregado por import dinâmico: não pesa no bundle inicial.
 * - Extraímos SOMENTE o texto embutido. OCR/IA ficam para a Fase 5 e serão
 *   oferecidos explicitamente, nunca silenciosos.
 * - O texto vira CANDIDATOS por heurística (data + valor pt-BR por linha);
 *   tudo passa pela prévia e confirmação antes de gravar.
 */

export type PdfCandidate = {
  date: string | null
  description: string
  amountMinor: number | null
  amountText: string | null
}

export function parsePdfLines(text: string): PdfCandidate[] {
  const candidates: PdfCandidate[] = []
  const lines = text.split(/\r?\n/)

  const datePattern = /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/
  const amountPattern = /(-?\d{1,3}(?:\.\d{3})*,\d{2})/

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line.length < 8) continue
    const dateMatch = datePattern.exec(line)
    const amountMatch = amountPattern.exec(line)
    if (!dateMatch || !amountMatch) continue

    const [, day, month, yearShort] = dateMatch as unknown as [string, string, string, string]
    const year = yearShort.length === 2 ? `20${yearShort}` : yearShort
    const d = Number(day)
    const m = Number(month)
    const y = Number(year)
    const check = new Date(Date.UTC(y, m - 1, d))
    const date =
      check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d
        ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        : null
    if (!date) continue

    const amountText = (amountMatch[1] ?? '').replace(/\./g, '').replace(',', '.')
    const amountMinor = Math.round(Number(amountText) * 100)
    if (!Number.isSafeInteger(amountMinor)) continue

    const description = line
      .replace(dateMatch[0] ?? '', '')
      .replace(amountMatch[0] ?? '', '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200)

    candidates.push({ date, description, amountMinor, amountText: amountMatch[1] ?? null })
  }

  return candidates
}

export async function extractPdfText(file: File): Promise<{ text: string } | { error: string }> {
  try {
    if (file.size > 10 * 1024 * 1024) return { error: 'Arquivo maior que 10 MB.' }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return { error: 'O arquivo não é um PDF.' }
    }

    const pdfjs = (await import('pdfjs-dist')) as unknown as {
      getDocument: (options: { data: ArrayBuffer }) => { promise: Promise<PdfDocument> }
      GlobalWorkerOptions: { workerSrc: string }
      version: string
    }
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      // Worker empacotado localmente (funciona offline); CDN como reserva.
      try {
        const local = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')) as { default: string }
        pdfjs.GlobalWorkerOptions.workerSrc = local.default
      } catch {
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`
      }
    }

    const buffer = await file.arrayBuffer()
    const document = await pdfjs.getDocument({ data: buffer }).promise
    const pages = Math.min(document.numPages, 20)
    const chunks: string[] = []
    for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      const strings = content.items
        .map((item) => {
          const record = item as { str?: unknown }
          return typeof record.str === 'string' ? record.str : ''
        })
        .filter(Boolean)
      chunks.push(strings.join(' '))
    }
    const text = chunks.join('\n').replace(/[ \t]+/g, ' ').trim()
    if (!text) {
      return {
        error: 'Nenhum texto embutido encontrado. PDFs escaneados exigem OCR (Fase 5).',
      }
    }
    return { text }
  } catch (unknownError) {
    return {
      error: unknownError instanceof Error ? unknownError.message : 'Falha ao ler o PDF.',
    }
  }
}

type PdfDocument = {
  numPages: number
  getPage: (pageNumber: number) => Promise<PdfPage>
}

type PdfPage = {
  getTextContent: () => Promise<{ items: unknown[] }>
}
