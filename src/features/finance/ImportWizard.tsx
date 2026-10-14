import { useMemo, useState } from 'react'
import { useI18n } from '../../i18n'
import { useAuth } from '../../auth/context'
import {
  DEFAULT_DIALECT,
  detectDuplicates,
  guessMapping,
  mapRows,
  parseCsv,
  sniffSeparator,
  type ColumnMapping,
  type CsvDialect,
  type ParsedRow,
} from '../../finance/csv'
import { extractPdfText, parsePdfLines } from '../../finance/pdf'
import { toMinorUnits } from '../../finance/money'
import { Button } from '../../ui/Button'
import { Card, CardDescription, CardTitle } from '../../ui/Card'
import { Field, Input } from '../../ui/Input'
import { inputClass } from './financeForm'
import type { Account, Transaction } from '../../finance/useFinance'

type ReviewRow = {
  key: number
  date: string
  description: string
  amountMinor: number
  amountText: string
  currency: string
  categoryId: string
  kind: 'income' | 'expense'
  selected: boolean
  duplicateOf: string | null
}

export function ImportWizard({
  accounts,
  existing,
  busy,
  error,
  onImport,
  onClose,
}: {
  accounts: Account[]
  existing: Transaction[]
  busy: boolean
  error: string | null
  onImport: (input: {
    filename: string
    source: 'csv' | 'pdf'
    accountId: string
    rows: ReviewRow[]
  }) => Promise<void>
  onClose: () => void
}) {
  const { t } = useI18n()
  const { supabase } = useAuth()

  const [step, setStep] = useState<'file' | 'preview'>('file')
  const [filename, setFilename] = useState('')
  const [source, setSource] = useState<'csv' | 'pdf'>('csv')
  const [fileError, setFileError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [dialect, setDialect] = useState<CsvDialect>(DEFAULT_DIALECT)
  const [mapping, setMapping] = useState<ColumnMapping>({
    date: null,
    description: null,
    amount: null,
    currency: null,
    category: null,
  })
  const [header, setHeader] = useState<string[]>([])
  const [body, setBody] = useState<string[][]>([])
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [defaultKind, setDefaultKind] = useState<'income' | 'expense'>('expense')
  const [defaultCurrency, setDefaultCurrency] = useState(accounts[0]?.currency ?? 'EUR')
  const [rows, setRows] = useState<ReviewRow[]>([])

  const duplicateIndex = useMemo(() => {
    const parsed: { date: string; amountMinor: number; description: string }[] = rows.map((row) => ({
      date: row.date,
      amountMinor: row.amountMinor,
      description: row.description,
    }))
    const asParsed: Parameters<typeof detectDuplicates>[0] = parsed.map((row, index) => ({
      lineNo: index + 1,
      raw: [],
      date: row.date,
      description: row.description,
      amountMinor: row.amountMinor,
      amountText: String(row.amountMinor),
      currency: 'EUR',
      categoryName: null,
      errors: [],
    }))
    const hits = detectDuplicates(
      asParsed,
      existing.map((tx) => ({
        id: tx.id,
        date: tx.date,
        amountMinor: Math.abs(toMinorUnits(tx.amount, tx.currency)),
        description: tx.description,
      })),
    )
    return new Map(hits.map((hit) => [hit.rowIndex, hit.existingId]))
  }, [rows, existing])

  async function handleFile(file: File) {
    setFileError(null)
    if (file.size > 10 * 1024 * 1024) {
      setFileError('Arquivo maior que 10 MB.')
      return
    }
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    const isCsv = file.name.toLowerCase().endsWith('.csv') || file.type.startsWith('text/')
    if (!isPdf && !isCsv) {
      setFileError(t('fin.importFile'))
      return
    }

    setReading(true)
    try {
      if (isPdf) {
        setSource('pdf')
        setFilename(file.name)
        const result = await extractPdfText(file)
        if ('error' in result) {
          setFileError(result.error)
          return
        }
        const candidates = parsePdfLines(result.text)
        if (candidates.length === 0) {
          setFileError(t('fin.importNoRows'))
          return
        }
        setHeader([])
        setBody([])
        setRows(
          candidates.map((candidate, index) => ({
            key: index,
            date: candidate.date ?? '',
            description: candidate.description,
            amountMinor: Math.abs(candidate.amountMinor ?? 0),
            amountText: candidate.amountText ?? '',
            currency: defaultCurrency,
            categoryId: '',
            kind: (candidate.amountMinor ?? 0) < 0 ? 'income' : 'expense',
            selected: candidate.date !== null && candidate.amountMinor !== null,
            duplicateOf: null,
          })),
        )
        setStep('preview')
      } else {
        setSource('csv')
        setFilename(file.name)
        const text = await file.text()
        const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
        const separator = sniffSeparator(firstLine)
        const parsed = parseCsv(text, separator)
        if (parsed.length < 2) {
          setFileError(t('fin.importNoRows'))
          return
        }
        const [head, ...rest] = parsed as [string[], ...string[][]]
        setHeader(head)
        setBody(rest)
        setDialect({ ...DEFAULT_DIALECT, separator })
        setMapping(guessMapping(head))
      }
    } finally {
      setReading(false)
    }
  }

  function buildPreview() {
    const mapped = mapRows(body, mapping, dialect, defaultCurrency)
    const valid: ParsedRow[] = mapped.filter(
      (row) => row.date && row.amountMinor !== null && row.description && row.errors.length === 0,
    )
    if (valid.length === 0) {
      setFileError(t('fin.importNoRows'))
      return
    }
    setRows(
      valid.map((row, index) => ({
        key: index,
        date: row.date as string,
        description: row.description as string,
        amountMinor: Math.abs(row.amountMinor as number),
        amountText: row.amountText ?? '',
        currency: row.currency ?? defaultCurrency,
        categoryId: '',
        kind: (row.amountMinor as number) < 0 ? 'income' : 'expense',
        selected: true,
        duplicateOf: null,
      })),
    )
    setStep('preview')
  }

  function toggleRow(key: number) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, selected: !row.selected } : row)),
    )
  }

  function updateRow(key: number, patch: Partial<ReviewRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  const selectedCount = rows.filter((row) => row.selected).length

  if (step === 'file' || (step === 'preview' && source === 'csv' && rows.length === 0)) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-xs text-muted-foreground">{t('fin.csvHint')}</p>
        <p className="text-xs text-muted-foreground">{t('fin.pdfHint')}</p>

        <Field label={t('fin.importFile')}>
          {(aria) => (
            <Input
              {...aria}
              type="file"
              accept=".csv,.pdf,text/csv,application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleFile(file)
              }}
            />
          )}
        </Field>

        {reading && (
          <p className="text-sm text-muted-foreground" role="status">
            {t('common.loading')}
          </p>
        )}
        {fileError && (
          <p role="alert" className="text-sm text-destructive">
            {fileError}
          </p>
        )}

        {body.length > 0 && (
          <Card>
            <CardTitle className="mb-2">{t('fin.importPreview')}</CardTitle>
            <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Separador">
                {(aria) => (
                  <select
                    {...aria}
                    value={dialect.separator}
                    onChange={(e) =>
                      setDialect({ ...dialect, separator: e.target.value as CsvDialect['separator'] })
                    }
                    className={inputClass}
                  >
                    <option value=";">;</option>
                    <option value=",">,</option>
                    <option value="	">Tab</option>
                    <option value="|">|</option>
                  </select>
                )}
              </Field>
              <Field label="Formato de data">
                {(aria) => (
                  <select
                    {...aria}
                    value={dialect.dateFormat}
                    onChange={(e) =>
                      setDialect({ ...dialect, dateFormat: e.target.value as CsvDialect['dateFormat'] })
                    }
                    className={inputClass}
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  </select>
                )}
              </Field>
              <Field label="Decimal">
                {(aria) => (
                  <select
                    {...aria}
                    value={dialect.decimalSeparator}
                    onChange={(e) =>
                      setDialect({
                        ...dialect,
                        decimalSeparator: e.target.value as '.' | ',',
                      })
                    }
                    className={inputClass}
                  >
                    <option value=",">, (pt-BR)</option>
                    <option value=".">. (en)</option>
                  </select>
                )}
              </Field>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {(['date', 'description', 'amount', 'currency', 'category'] as const).map((field) => (
                <Field key={field} label={field}>
                  {(aria) => (
                    <select
                      {...aria}
                      value={mapping[field] ?? ''}
                      onChange={(e) =>
                        setMapping({
                          ...mapping,
                          [field]: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      className={inputClass}
                    >
                      <option value="">—</option>
                      {header.map((name, index) => (
                        <option key={index} value={index}>
                          {index}: {name}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              ))}
            </div>

            <p className="mb-2 text-xs text-muted-foreground">
              {body.length} linhas · {header.join(' | ').slice(0, 120)}
            </p>
            <Button onClick={buildPreview}>{t('fin.importPreview')}</Button>
          </Card>
        )}

        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardTitle className="mb-1">
          {t('fin.importPreview')} · {filename}
        </CardTitle>
        <CardDescription>
          {t('fin.importOrigin')}: {filename} · {selectedCount}/{rows.length}
        </CardDescription>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label={t('fin.importAccount')}>
          {(aria) => (
            <select
              {...aria}
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value)
                const account = accounts.find((a) => a.id === e.target.value)
                if (account) setDefaultCurrency(account.currency)
              }}
              className={inputClass}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.currency})
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t('fin.importKind')}>
          {(aria) => (
            <select
              {...aria}
              value={defaultKind}
              onChange={(e) => setDefaultKind(e.target.value as 'income' | 'expense')}
              className={inputClass}
            >
              <option value="expense">{t('fin.expense')}</option>
              <option value="income">{t('fin.income')}</option>
            </select>
          )}
        </Field>
        <Field label={t('fin.currency')}>
          {(aria) => (
            <select
              {...aria}
              value={defaultCurrency}
              onChange={(e) => setDefaultCurrency(e.target.value)}
              className={inputClass}
            >
              <option value="EUR">EUR</option>
              <option value="BRL">BRL</option>
            </select>
          )}
        </Field>
      </div>

      {source === 'pdf' && (
        <p className="text-xs text-muted-foreground">{t('fin.pdfOcrNote')}</p>
      )}

      <ul className="flex flex-col gap-2">
        {rows.map((row, index) => {
          const duplicateOf = duplicateIndex.get(index) ?? null
          return (
            <li
              key={row.key}
              className={
                duplicateOf
                  ? 'flex flex-col gap-2 rounded-md border border-destructive/50 bg-destructive/5 p-3'
                  : 'flex flex-col gap-2 rounded-md border border-border p-3'
              }
            >
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={row.selected}
                  onChange={() => toggleRow(row.key)}
                  aria-label={`${t('fin.importAccept')}: ${row.description}`}
                  className="mt-1"
                />
                <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-5">
                  <Input
                    type="date"
                    aria-label={t('fin.date')}
                    value={row.date}
                    onChange={(e) => updateRow(row.key, { date: e.target.value })}
                  />
                  <Input
                    aria-label={t('fin.description')}
                    value={row.description}
                    maxLength={200}
                    onChange={(e) => updateRow(row.key, { description: e.target.value })}
                    className="col-span-2"
                  />
                  <Input
                    aria-label={t('fin.amount')}
                    value={(row.amountMinor / 100).toFixed(2)}
                    inputMode="decimal"
                    onChange={(e) => {
                      const parsed = Number(e.target.value.replace(',', '.'))
                      if (Number.isFinite(parsed) && parsed >= 0) {
                        updateRow(row.key, { amountMinor: Math.round(parsed * 100) })
                      }
                    }}
                  />
                  <select
                    aria-label={t('fin.kind')}
                    value={row.kind}
                    onChange={(e) => updateRow(row.key, { kind: e.target.value as 'income' | 'expense' })}
                    className={inputClass}
                  >
                    <option value="expense">{t('fin.expense')}</option>
                    <option value="income">{t('fin.income')}</option>
                  </select>
                </div>
              </div>
              {duplicateOf && (
                <p className="text-xs text-destructive">
                  {t('fin.importDuplicate')} · {duplicateOf.slice(0, 8)}
                </p>
              )}
            </li>
          )
        })}
      </ul>

      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('fin.importNoRows')}</p>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {supabase === null && (
        <p className="text-xs text-muted-foreground">{t('env.supabaseMissing')}</p>
      )}

      <div className="flex justify-end gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            setStep('file')
            setRows([])
            setBody([])
          }}
        >
          {t('common.retry')}
        </Button>
        <Button
          disabled={busy || selectedCount === 0 || !accountId}
          onClick={() =>
            void onImport({
              filename,
              source,
              accountId,
              rows: rows
                .filter((row) => row.selected)
                .map((row) => ({ ...row, currency: defaultCurrency })),
            })
          }
        >
          {busy ? t('common.loading') : `${t('fin.importConfirm')} (${selectedCount})`}
        </Button>
      </div>
    </div>
  )
}
