import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/context'
import { useHousehold } from '../household/context'
import { useI18n } from '../i18n'
import {
  computeEnergyEstimate,
  monthStartKey,
  normalizeReadings,
  parseDecimal,
  readingDeltas,
  toDateKey,
  type EnergyConfig,
  type EnergyReading,
} from '../energy/energy'
import { formatMoney } from '../finance/money'
import { Button } from './Button'
import { Card, CardTitle } from './Card'
import { Field, Input } from './Input'
import { Modal } from './Modal'
import { useToast } from './toastContext'

type EnergyRow = {
  household_id: string
  currency: string
  price_per_kwh: string | number
  fixed_fee: string | number
  initial_reading: string | number
  current_reading: string | number
  cycle_start: string
  readings: unknown
}

type EnergyForm = {
  currency: string
  pricePerKwh: number
  fixedFee: number
  initialReading: number
  currentReading: number
  cycleStart: string
}

const CURRENCIES = ['EUR', 'BRL', 'USD', 'GBP'] as const
const selectClass = 'h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground'

function safeCurrency(value: string | null | undefined): string {
  return value && (CURRENCIES as readonly string[]).includes(value) ? value : 'EUR'
}

function rowToConfig(row: EnergyRow | null): EnergyConfig {
  return {
    currency: safeCurrency(row?.currency),
    pricePerKwh: parseDecimal(row?.price_per_kwh),
    fixedFee: parseDecimal(row?.fixed_fee),
    initialReading: parseDecimal(row?.initial_reading),
    currentReading: parseDecimal(row?.current_reading),
    cycleStart: row?.cycle_start ?? monthStartKey(),
    readings: normalizeReadings(row?.readings),
  }
}

function mergeReadings(existing: unknown, reading: number, previous: number | null): EnergyReading[] {
  const list = normalizeReadings(existing)
  if (reading <= 0) return list
  if (previous !== null && Math.abs(reading - previous) < 0.0005) return list
  const today = toDateKey()
  const next = list.filter((entry) => entry.date !== today)
  next.push({ date: today, reading })
  return next.sort((a, b) => a.date.localeCompare(b.date)).slice(-24)
}

function formatKwh(value: number, locale: string): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} kWh`
}

function formatUnitPrice(value: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value)
}

function formatShortDate(key: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short' }).format(
    new Date(`${key}T12:00:00`),
  )
}

function EnergyDialog({
  initial,
  busy,
  error,
  onSave,
  onClose,
}: {
  initial: EnergyConfig
  busy: boolean
  error: string | null
  onSave: (values: EnergyForm) => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const [currency, setCurrency] = useState(initial.currency)
  const [price, setPrice] = useState(initial.pricePerKwh > 0 ? String(initial.pricePerKwh) : '')
  const [fee, setFee] = useState(initial.fixedFee > 0 ? String(initial.fixedFee) : '')
  const [initialReading, setInitialReading] = useState(
    initial.initialReading > 0 ? String(initial.initialReading) : '',
  )
  const [currentReading, setCurrentReading] = useState(
    initial.currentReading > 0 ? String(initial.currentReading) : '',
  )
  const [cycleStart, setCycleStart] = useState(initial.cycleStart)
  const [formError, setFormError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const priceValue = parseDecimal(price)
    const feeValue = parseDecimal(fee)
    const initialValue = parseDecimal(initialReading)
    const currentValue = parseDecimal(currentReading)
    if (price.trim() === '' || initialReading.trim() === '' || currentReading.trim() === '') {
      setFormError(t('overview.energy.required'))
      return
    }
    if (priceValue < 0 || feeValue < 0 || initialValue < 0 || currentValue < 0) {
      setFormError(t('overview.energy.invalid'))
      return
    }
    if (currentValue < initialValue) {
      setFormError(t('overview.energy.belowInitial'))
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cycleStart)) {
      setFormError(t('overview.energy.invalid'))
      return
    }
    onSave({
      currency,
      pricePerKwh: priceValue,
      fixedFee: feeValue,
      initialReading: initialValue,
      currentReading: currentValue,
      cycleStart,
    })
  }

  return (
    <Modal title={t('overview.energy.edit')} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <p className="text-sm text-muted-foreground">{t('overview.energy.hint')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('overview.energy.pricePerKwh')}>
            {(aria) => (
              <Input
                {...aria}
                inputMode="decimal"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="0,25"
              />
            )}
          </Field>
          <Field label={t('overview.energy.currency')}>
            {(aria) => (
              <select {...aria} value={currency} onChange={(event) => setCurrency(event.target.value)} className={selectClass}>
                {CURRENCIES.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t('overview.energy.fixedFee')} hint={t('overview.energy.fixedFeeHint')}>
            {(aria) => (
              <Input
                {...aria}
                inputMode="decimal"
                value={fee}
                onChange={(event) => setFee(event.target.value)}
                placeholder="0,00"
              />
            )}
          </Field>
          <Field label={t('overview.energy.cycleStart')}>
            {(aria) => (
              <Input
                {...aria}
                type="date"
                value={cycleStart}
                onChange={(event) => setCycleStart(event.target.value)}
              />
            )}
          </Field>
          <Field label={t('overview.energy.initialReading')}>
            {(aria) => (
              <Input
                {...aria}
                inputMode="decimal"
                value={initialReading}
                onChange={(event) => setInitialReading(event.target.value)}
                placeholder="1000"
              />
            )}
          </Field>
          <Field label={t('overview.energy.currentReading')}>
            {(aria) => (
              <Input
                {...aria}
                inputMode="decimal"
                value={currentReading}
                onChange={(event) => setCurrentReading(event.target.value)}
                placeholder="1123,4"
              />
            )}
          </Field>
        </div>
        {(formError || error) && (
          <p role="alert" className="text-sm text-destructive">{formError ?? error}</p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? t('overview.energy.saving') : t('common.save')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export function EnergyWidget() {
  const { t, locale } = useI18n()
  const { supabase } = useAuth()
  const { state } = useHousehold()
  const { notify } = useToast()
  const householdId = state.kind === 'ready' ? state.household.id : null

  const [row, setRow] = useState<EnergyRow | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase || !householdId) {
      setStatus('idle')
      return
    }
    setStatus((current) => (current === 'ready' ? current : 'loading'))
    setError(null)
    const { data, error: loadError } = await supabase
      .from('energy_settings_fh')
      .select('*')
      .eq('household_id', householdId)
      .maybeSingle()
    if (loadError) {
      setError(loadError.message)
      setStatus('error')
      return
    }
    setRow((data as EnergyRow | null) ?? null)
    setStatus('ready')
  }, [householdId, supabase])

  useEffect(() => {
    let cancelled = false
    // Fora do corpo síncrono do efeito, como nos demais hooks do app.
    queueMicrotask(() => {
      if (!cancelled) void refresh()
    })
    return () => {
      cancelled = true
    }
  }, [refresh])

  async function save(values: EnergyForm) {
    if (!supabase || !householdId) return
    setBusy(true)
    setSaveError(null)
    const readings = mergeReadings(
      row?.readings,
      values.currentReading,
      row ? parseDecimal(row.current_reading) : null,
    )
    const payload = {
      household_id: householdId,
      currency: values.currency,
      price_per_kwh: values.pricePerKwh,
      fixed_fee: values.fixedFee,
      initial_reading: values.initialReading,
      current_reading: values.currentReading,
      cycle_start: values.cycleStart,
      readings,
      updated_at: new Date().toISOString(),
    }
    const { data, error: upsertError } = await supabase
      .from('energy_settings_fh')
      .upsert(payload, { onConflict: 'household_id' })
      .select('*')
      .maybeSingle()
    setBusy(false)
    if (upsertError) {
      setSaveError(t('overview.energy.saveError', { message: upsertError.message }))
      notify('error', t('overview.energy.title'), upsertError.message)
      return
    }
    setRow((data as EnergyRow | null) ?? (payload as unknown as EnergyRow))
    setStatus('ready')
    setEditing(false)
    notify('success', t('overview.energy.title'), t('overview.energy.saved'))
  }

  const config = rowToConfig(row)
  const estimate = computeEnergyEstimate(config)
  const configured = config.pricePerKwh > 0
  const history = readingDeltas(config.readings).slice(-6)
  const historyMax = Math.max(1, ...history.map((entry) => entry.kwh))

  return (
    <>
      <Card>
        <div className="flex items-start justify-between gap-2">
          <CardTitle>{t('overview.energy.title')}</CardTitle>
          {status === 'ready' && configured && (
            <Button size="sm" variant="secondary" onClick={() => { setSaveError(null); setEditing(true) }}>
              {t('overview.energy.configure')}
            </Button>
          )}
        </div>

        {status === 'loading' && (
          <p className="mt-3 text-sm text-muted-foreground">{t('common.loading')}</p>
        )}
        {status === 'error' && (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-sm text-destructive" role="alert">{t('overview.energy.unavailable')}</p>
            <p className="text-xs text-muted-foreground">{t('overview.energy.loadError', { message: error ?? '' })}</p>
            <div>
              <Button size="sm" variant="secondary" onClick={() => void refresh()}>{t('common.retry')}</Button>
            </div>
          </div>
        )}

        {status === 'ready' && !configured && (
          <div className="mt-3 flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">{t('overview.energy.empty')}</p>
            <div>
              <Button size="sm" onClick={() => { setSaveError(null); setEditing(true) }}>
                {t('overview.energy.setup')}
              </Button>
            </div>
          </div>
        )}

        {status === 'ready' && configured && (
          <>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] text-muted-foreground">{t('overview.energy.consumption')}</p>
                <p className="text-2xl font-semibold tabular-nums">{formatKwh(estimate.consumptionKwh, locale)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {t('overview.energy.reading', {
                    initial: formatKwh(config.initialReading, locale),
                    current: formatKwh(config.currentReading, locale),
                  })}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">{t('overview.energy.bill')}</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {formatMoney(estimate.costMinor, config.currency, locale)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t('overview.energy.projection', {
                    value: formatMoney(estimate.projectedCostMinor, config.currency, locale),
                  })}
                </p>
              </div>
            </div>

            <div className="mt-3">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>{t('overview.energy.day', { day: estimate.daysElapsed, total: estimate.cycleDays })}</span>
                <span>{t('overview.energy.daysLeft', { count: estimate.daysLeft })}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${estimate.percent}%` }} />
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{t('overview.energy.dailyAverage', { value: formatKwh(estimate.dailyAverageKwh, locale) })}</span>
              <span>{t('overview.energy.projectedKwh', { value: formatKwh(estimate.projectedKwh, locale) })}</span>
            </div>

            {history.length >= 1 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground">{t('overview.energy.history')}</p>
                <div className="flex h-16 items-end gap-2">
                  {history.map((entry) => (
                    <div key={entry.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t bg-primary/70"
                        style={{ height: `${Math.max(6, Math.round((entry.kwh / historyMax) * 48))}px` }}
                        title={t('overview.energy.barLabel', { date: formatShortDate(entry.date, locale), value: formatKwh(entry.kwh, locale) })}
                        aria-label={t('overview.energy.barLabel', { date: formatShortDate(entry.date, locale), value: formatKwh(entry.kwh, locale) })}
                        role="img"
                      />
                      <span className="truncate text-[10px] text-muted-foreground">{formatShortDate(entry.date, locale)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="mt-3 text-[11px] text-muted-foreground">
              {t('overview.energy.tariff', {
                price: formatUnitPrice(config.pricePerKwh, config.currency, locale),
                fee: formatMoney(Math.round(config.fixedFee * 100), config.currency, locale),
              })}
            </p>
          </>
        )}
      </Card>

      {editing && (
        <EnergyDialog
          initial={config}
          busy={busy}
          error={saveError}
          onSave={(values) => void save(values)}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  )
}
