import { useState, type FormEvent, type ReactNode } from 'react'
import { useI18n } from '../../i18n'
import { Button } from '../../ui/Button'
import { Field, Input } from '../../ui/Input'
import { Modal } from '../../ui/Modal'
import { inputClass, parseAmountInput, type Category, type Member } from './financeForm'
import type { Account, FinanceMerchant, Goal, Transaction } from '../../finance/useFinance'

export type { Category, Member }

function Shell({
  title,
  onClose,
  busy,
  error,
  onSubmit,
  children,
}: {
  title: string
  onClose: () => void
  busy: boolean
  error: string | null
  onSubmit: (event: FormEvent) => void
  children: ReactNode
}) {
  const { t } = useI18n()
  return (
    <Modal title={title} onClose={onClose} wide>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {children}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? t('common.loading') : t('common.save')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function PersonSelect({
  label,
  value,
  members,
  onChange,
}: {
  label: string
  value: string
  members: Member[]
  onChange: (value: string) => void
}) {
  const { t } = useI18n()
  return (
    <Field label={label}>
      {(aria) => (
        <select {...aria} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
          <option value="">{t('fin.unassigned')}</option>
          {members.map((member) => (
            <option key={member.user_id} value={member.user_id}>
              {member.display_name ?? member.user_id.slice(0, 8)}
            </option>
          ))}
        </select>
      )}
    </Field>
  )
}

function CategorySelect({
  categories,
  value,
  kind,
  onChange,
}: {
  categories: Category[]
  value: string
  kind: 'income' | 'expense' | null
  onChange: (value: string) => void
}) {
  const { t } = useI18n()
  const filtered = kind ? categories.filter((c) => !c.kind || c.kind === kind) : categories
  return (
    <Field label={t('fin.category')}>
      {(aria) => (
        <select {...aria} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
          <option value="">{t('fin.noCategory')}</option>
          {filtered.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      )}
    </Field>
  )
}

export function AccountDialog({
  initial,
  members,
  busy,
  error,
  onClose,
  onSave,
}: {
  initial: Account | null
  members: Member[]
  busy: boolean
  error: string | null
  onClose: () => void
  onSave: (values: Record<string, unknown>) => void
}) {
  const { t } = useI18n()
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<'checking' | 'savings' | 'cash' | 'other'>(initial?.type ?? 'checking')
  const [currency, setCurrency] = useState(initial?.currency ?? 'EUR')
  const [opening, setOpening] = useState(initial?.opening_balance ?? '0.00')
  const [visibility, setVisibility] = useState<'shared' | 'personal'>(initial?.visibility ?? 'shared')
  const [ownerId, setOwnerId] = useState(initial?.owner_id ?? '')
  const [formError, setFormError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setFormError(t('common.required'))
      return
    }
    const openingParsed = parseAmountInput(opening) ?? (opening.trim() === '' || opening.trim() === '0' ? '0.00' : null)
    if (openingParsed === null && opening.trim() !== '' && Number(opening.replace(',', '.')) !== 0) {
      setFormError(t('common.required'))
      return
    }
    onSave({
      name: name.trim(),
      type,
      currency,
      opening_balance: openingParsed ?? '0.00',
      visibility,
      owner_id: ownerId || null,
    })
  }

  return (
    <Shell
      title={initial ? t('fin.editAccount') : t('fin.newAccount')}
      onClose={onClose}
      busy={busy}
      error={formError ?? error}
      onSubmit={submit}
    >
      <Field label={t('fin.accountName')}>
        {(aria) => <Input {...aria} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />}
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label={t('fin.accountType')}>
          {(aria) => (
            <select {...aria} value={type} onChange={(e) => setType(e.target.value as 'checking' | 'savings' | 'cash' | 'other')} className={inputClass}>
              {(['checking', 'savings', 'cash', 'other'] as const).map((value) => (
                <option key={value} value={value}>
                  {t(`fin.accountType.${value}`)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t('fin.currency')}>
          {(aria) => (
            <select {...aria} value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClass}>
              <option value="EUR">EUR</option>
              <option value="BRL">BRL</option>
            </select>
          )}
        </Field>
        <Field label={t('fin.openingBalance')}>
          {(aria) => (
            <Input {...aria} value={opening} inputMode="decimal" onChange={(e) => setOpening(e.target.value)} />
          )}
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t('agenda.visibility')}>
          {(aria) => (
            <select
              {...aria}
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as 'shared' | 'personal')}
              className={inputClass}
            >
              <option value="shared">{t('agenda.visibility.shared')}</option>
              <option value="personal">{t('agenda.visibility.personal')}</option>
            </select>
          )}
        </Field>
        <PersonSelect label={t('fin.owner')} value={ownerId} members={members} onChange={setOwnerId} />
      </div>
    </Shell>
  )
}

const TX_STATUSES = ['previsto', 'pendente', 'pago', 'recebido', 'cancelado'] as const

export function TransactionDialog({
  initial,
  accounts,
  categories,
  merchants,
  members,
  defaultKind,
  busy,
  error,
  onClose,
  onSave,
}: {
  initial: Transaction | null
  accounts: Account[]
  categories: Category[]
  merchants: FinanceMerchant[]
  members: Member[]
  defaultKind: 'income' | 'expense'
  busy: boolean
  error: string | null
  onClose: () => void
  onSave: (values: Record<string, unknown>) => void
}) {
  const { t } = useI18n()
  const [kind, setKind] = useState<'income' | 'expense'>(initial?.kind ?? defaultKind)
  const [amount, setAmount] = useState(initial?.amount ?? '')
  const [currency, setCurrency] = useState(initial?.currency ?? accounts[0]?.currency ?? 'EUR')
  const [status, setStatus] = useState<(typeof TX_STATUSES)[number]>(initial?.status ?? 'pendente')
  const [description, setDescription] = useState(initial?.description ?? '')
  const defaultExpenseCategory = categories.find(
    (category) => category.kind === 'expense' && category.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR') === 'alimentacao',
  ) ?? categories.find((category) => category.kind === 'expense' || !category.kind)
  const [categoryId, setCategoryId] = useState<string | null>(initial ? initial.category_id ?? '' : null)
  const selectedCategoryId = categoryId ?? (kind === 'expense' ? defaultExpenseCategory?.id ?? '' : '')
  const [merchantId, setMerchantId] = useState(initial?.merchant_id ?? '')
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10))
  const [accountId, setAccountId] = useState(initial?.account_id ?? accounts[0]?.id ?? '')
  const [ownerId, setOwnerId] = useState(initial?.owner_id ?? '')
  const [formError, setFormError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseAmountInput(amount)
    if (!description.trim() || !parsed || !date || !accountId) {
      setFormError(t('common.required'))
      return
    }
    const paid = status === 'pago' || status === 'recebido'
    onSave({
      kind,
      amount: parsed,
      currency,
      status,
      description: description.trim(),
      category_id: selectedCategoryId || null,
      merchant_id: merchantId || null,
      date,
      paid_at: paid ? (initial?.paid_at ?? new Date().toISOString()) : null,
      account_id: accountId,
      owner_id: ownerId || null,
    })
  }

  return (
    <Shell
      title={initial ? t('fin.editTransaction') : t('fin.newTransaction')}
      onClose={onClose}
      busy={busy}
      error={formError ?? error}
      onSubmit={submit}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label={t('fin.kind')}>
          {(aria) => (
            <select {...aria} value={kind} onChange={(e) => setKind(e.target.value as 'income' | 'expense')} className={inputClass}>
              <option value="expense">{t('fin.expense')}</option>
              <option value="income">{t('fin.income')}</option>
            </select>
          )}
        </Field>
        <Field label={t('fin.amount')}>
          {(aria) => (
            <Input {...aria} value={amount} inputMode="decimal" placeholder="0,00" onChange={(e) => setAmount(e.target.value)} />
          )}
        </Field>
        <Field label={t('fin.currency')}>
          {(aria) => (
            <select {...aria} value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClass}>
              <option value="EUR">EUR</option>
              <option value="BRL">BRL</option>
            </select>
          )}
        </Field>
      </div>
      <Field label={t('fin.description')}>
        {(aria) => (
          <Input {...aria} value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} />
        )}
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label={t('fin.date')}>
          {(aria) => <Input {...aria} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        <Field label={t('fin.status')}>
          {(aria) => (
            <select {...aria} value={status} onChange={(e) => setStatus(e.target.value as (typeof TX_STATUSES)[number])} className={inputClass}>
              {TX_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {t(`fin.status.${value}`)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t('fin.account')}>
          {(aria) => (
            <select {...aria} value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputClass}>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.currency})
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CategorySelect categories={categories} value={selectedCategoryId} kind={kind} onChange={(value) => { setCategoryId(value); setMerchantId('') }} />
        <PersonSelect label={t('fin.owner')} value={ownerId} members={members} onChange={setOwnerId} />
      </div>
      {selectedCategoryId && (
        <Field label={t('fin.merchants.name')}>
          {(aria) => (
            <select {...aria} value={merchantId} onChange={(e) => setMerchantId(e.target.value)} className={inputClass}>
              <option value="">{t('fin.merchants.none')}</option>
              {merchants.filter((merchant) => merchant.category_id === selectedCategoryId).map((merchant) => (
                <option key={merchant.id} value={merchant.id}>{merchant.name}</option>
              ))}
            </select>
          )}
        </Field>
      )}
    </Shell>
  )
}

export function RecurrenceDialog({
  initial,
  accounts,
  categories,
  members,
  busy,
  error,
  onClose,
  onSave,
}: {
  initial: import('../../finance/useFinance').FRecurrence | null
  accounts: Account[]
  categories: Category[]
  members: Member[]
  busy: boolean
  error: string | null
  onClose: () => void
  onSave: (values: Record<string, unknown>) => void
}) {
  const { t } = useI18n()
  const [kind, setKind] = useState<'income' | 'expense'>(initial?.kind ?? 'expense')
  const [amount, setAmount] = useState(initial?.amount ?? '')
  const [currency, setCurrency] = useState(initial?.currency ?? accounts[0]?.currency ?? 'EUR')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? '')
  const [accountId, setAccountId] = useState(initial?.account_id ?? accounts[0]?.id ?? '')
  const [ownerId, setOwnerId] = useState(initial?.owner_id ?? '')
  const [frequency, setFrequency] = useState<import('../../finance/frecurrence').FinanceFrequency>(initial?.frequency ?? 'monthly')
  const [intervalN, setIntervalN] = useState(String(initial?.interval_n ?? 1))
  const [startDate, setStartDate] = useState(initial?.start_date ?? new Date().toISOString().slice(0, 10))
  const [endMode, setEndMode] = useState<'never' | 'date' | 'count'>(initial?.end_date ? 'date' : initial?.occurrence_count ? 'count' : 'never')
  const [endDate, setEndDate] = useState(initial?.end_date ?? '')
  const [endCount, setEndCount] = useState(String(initial?.occurrence_count ?? 12))
  const [formError, setFormError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseAmountInput(amount)
    if (!description.trim() || !parsed || !startDate || !accountId) {
      setFormError(t('common.required'))
      return
    }
    onSave({
      kind,
      amount: parsed,
      currency,
      description: description.trim(),
      category_id: categoryId || null,
      account_id: accountId,
      owner_id: ownerId || null,
      frequency,
      interval_n: Math.max(1, Number.parseInt(intervalN, 10) || 1),
      start_date: startDate,
      end_date: endMode === 'date' && endDate ? endDate : null,
      occurrence_count: endMode === 'count' ? Math.max(1, Number.parseInt(endCount, 10) || 1) : null,
      active: initial?.active ?? true,
    })
  }

  return (
    <Shell
      title={initial ? t('fin.editRecurrence') : t('fin.newRecurrence')}
      onClose={onClose}
      busy={busy}
      error={formError ?? error}
      onSubmit={submit}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label={t('fin.kind')}>
          {(aria) => (
            <select {...aria} value={kind} onChange={(e) => setKind(e.target.value as 'income' | 'expense')} className={inputClass}>
              <option value="expense">{t('fin.expense')}</option>
              <option value="income">{t('fin.income')}</option>
            </select>
          )}
        </Field>
        <Field label={t('fin.amount')}>
          {(aria) => (
            <Input {...aria} value={amount} inputMode="decimal" placeholder="0,00" onChange={(e) => setAmount(e.target.value)} />
          )}
        </Field>
        <Field label={t('fin.currency')}>
          {(aria) => (
            <select {...aria} value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClass}>
              <option value="EUR">EUR</option>
              <option value="BRL">BRL</option>
            </select>
          )}
        </Field>
      </div>
      <Field label={t('fin.description')}>
        {(aria) => (
          <Input {...aria} value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} />
        )}
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t('agenda.recurrence')}>
          {(aria) => (
            <select {...aria} value={frequency} onChange={(e) => setFrequency(e.target.value as import('../../finance/frecurrence').FinanceFrequency)} className={inputClass}>
              <option value="daily">{t('agenda.recurrence.daily')}</option>
              <option value="weekly">{t('agenda.recurrence.weekly')}</option>
              <option value="monthly">{t('agenda.recurrence.monthly')}</option>
              <option value="yearly">{t('agenda.recurrence.yearly')}</option>
            </select>
          )}
        </Field>
        <Field label={t('agenda.recurrence.intervalUnit')}>
          {(aria) => (
            <Input {...aria} type="number" min={1} max={365} value={intervalN} onChange={(e) => setIntervalN(e.target.value)} />
          )}
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t('fin.date')}>
          {(aria) => <Input {...aria} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />}
        </Field>
        <Field label={t('agenda.recurrence.end')}>
          {(aria) => (
            <select {...aria} value={endMode} onChange={(e) => setEndMode(e.target.value as 'never' | 'date' | 'count')} className={inputClass}>
              <option value="never">{t('agenda.recurrence.endNever')}</option>
              <option value="date">{t('agenda.recurrence.endDate')}</option>
              <option value="count">{t('agenda.recurrence.endCount')}</option>
            </select>
          )}
        </Field>
      </div>
      {endMode === 'date' && (
        <Field label={t('agenda.recurrence.endDate')}>
          {(aria) => <Input {...aria} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />}
        </Field>
      )}
      {endMode === 'count' && (
        <Field label={t('agenda.recurrence.endCount')}>
          {(aria) => <Input {...aria} type="number" min={1} value={endCount} onChange={(e) => setEndCount(e.target.value)} />}
        </Field>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label={t('fin.account')}>
          {(aria) => (
            <select {...aria} value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputClass}>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.currency})
                </option>
              ))}
            </select>
          )}
        </Field>
        <CategorySelect categories={categories} value={categoryId} kind={kind} onChange={setCategoryId} />
        <PersonSelect label={t('fin.owner')} value={ownerId} members={members} onChange={setOwnerId} />
      </div>
    </Shell>
  )
}

export function TransferDialog({
  accounts,
  busy,
  error,
  onClose,
  onSave,
}: {
  accounts: Account[]
  busy: boolean
  error: string | null
  onClose: () => void
  onSave: (values: Record<string, unknown>) => void
}) {
  const { t } = useI18n()
  const [from, setFrom] = useState(accounts[0]?.id ?? '')
  const [to, setTo] = useState(accounts[1]?.id ?? accounts[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [toAmount, setToAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const fromAccount = accounts.find((a) => a.id === from)
  const toAccount = accounts.find((a) => a.id === to)
  const crossCurrency = fromAccount && toAccount && fromAccount.currency !== toAccount.currency

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseAmountInput(amount)
    if (!parsed || !from || !to || from === to || !date) {
      setFormError(t('common.required'))
      return
    }
    let toParsed: string | null = null
    if (crossCurrency) {
      toParsed = parseAmountInput(toAmount)
      if (!toParsed) {
        setFormError(t('common.required'))
        return
      }
    }
    onSave({
      from_account: from,
      to_account: to,
      amount: parsed,
      currency: fromAccount?.currency ?? 'EUR',
      to_amount: toParsed,
      to_currency: toParsed ? (toAccount?.currency ?? null) : null,
      fee: '0',
      date,
      description: description.trim() || null,
    })
  }

  return (
    <Shell
      title={t('fin.newTransfer')}
      onClose={onClose}
      busy={busy}
      error={formError ?? error}
      onSubmit={submit}
    >
      <p className="text-xs text-muted-foreground">{t('fin.transferNote')}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t('fin.from')}>
          {(aria) => (
            <select {...aria} value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass}>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.currency})
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t('fin.to')}>
          {(aria) => (
            <select {...aria} value={to} onChange={(e) => setTo(e.target.value)} className={inputClass}>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.currency})
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label={`${t('fin.amount')} (${fromAccount?.currency ?? ''})`}>
          {(aria) => (
            <Input {...aria} value={amount} inputMode="decimal" placeholder="0,00" onChange={(e) => setAmount(e.target.value)} />
          )}
        </Field>
        {crossCurrency && (
          <Field label={`${t('fin.toAmount')} (${toAccount?.currency ?? ''})`}>
            {(aria) => (
              <Input {...aria} value={toAmount} inputMode="decimal" placeholder="0,00" onChange={(e) => setToAmount(e.target.value)} />
            )}
          </Field>
        )}
        <Field label={t('fin.date')}>
          {(aria) => <Input {...aria} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
      </div>
      <Field label={t('fin.description')}>
        {(aria) => (
          <Input {...aria} value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} />
        )}
      </Field>
    </Shell>
  )
}

export function GoalDialog({
  initial,
  members,
  busy,
  error,
  onClose,
  onSave,
}: {
  initial: Goal | null
  members: Member[]
  busy: boolean
  error: string | null
  onClose: () => void
  onSave: (values: Record<string, unknown>) => void
}) {
  const { t } = useI18n()
  const [name, setName] = useState(initial?.name ?? '')
  const [target, setTarget] = useState(initial?.target_amount ?? '')
  const [currency, setCurrency] = useState(initial?.currency ?? 'EUR')
  const [deadline, setDeadline] = useState(initial?.deadline ?? '')
  const [visibility, setVisibility] = useState<'shared' | 'personal'>(initial?.visibility ?? 'shared')
  const [ownerId, setOwnerId] = useState(initial?.owner_id ?? '')
  const [formError, setFormError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseAmountInput(target)
    if (!name.trim() || !parsed) {
      setFormError(t('common.required'))
      return
    }
    onSave({
      name: name.trim(),
      target_amount: parsed,
      currency,
      deadline: deadline || null,
      visibility,
      owner_id: ownerId || null,
    })
  }

  return (
    <Shell
      title={initial ? t('fin.editGoal') : t('fin.newGoal')}
      onClose={onClose}
      busy={busy}
      error={formError ?? error}
      onSubmit={submit}
    >
      <p className="text-xs text-muted-foreground">{t('fin.goalNote')}</p>
      <Field label={t('fin.accountName')}>
        {(aria) => <Input {...aria} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />}
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label={t('fin.target')}>
          {(aria) => (
            <Input {...aria} value={target} inputMode="decimal" placeholder="0,00" onChange={(e) => setTarget(e.target.value)} />
          )}
        </Field>
        <Field label={t('fin.currency')}>
          {(aria) => (
            <select {...aria} value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClass}>
              <option value="EUR">EUR</option>
              <option value="BRL">BRL</option>
            </select>
          )}
        </Field>
        <Field label={t('fin.deadline')}>
          {(aria) => <Input {...aria} type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />}
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t('agenda.visibility')}>
          {(aria) => (
            <select
              {...aria}
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as 'shared' | 'personal')}
              className={inputClass}
            >
              <option value="shared">{t('agenda.visibility.shared')}</option>
              <option value="personal">{t('agenda.visibility.personal')}</option>
            </select>
          )}
        </Field>
        <PersonSelect label={t('fin.owner')} value={ownerId} members={members} onChange={setOwnerId} />
      </div>
    </Shell>
  )
}

export function ContributeDialog({
  busy,
  error,
  onClose,
  onSave,
}: {
  busy: boolean
  error: string | null
  onClose: () => void
  onSave: (values: Record<string, unknown>) => void
}) {
  const { t } = useI18n()
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseAmountInput(amount)
    if (!parsed || !date) {
      setFormError(t('common.required'))
      return
    }
    onSave({ amount: parsed, date, note: note.trim() || null })
  }

  return (
    <Shell
      title={t('fin.contribute')}
      onClose={onClose}
      busy={busy}
      error={formError ?? error}
      onSubmit={submit}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t('fin.amount')}>
          {(aria) => (
            <Input {...aria} value={amount} inputMode="decimal" placeholder="0,00" onChange={(e) => setAmount(e.target.value)} />
          )}
        </Field>
        <Field label={t('fin.date')}>
          {(aria) => <Input {...aria} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
      </div>
      <Field label={t('fin.contributionNote')}>
        {(aria) => <Input {...aria} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />}
      </Field>
    </Shell>
  )
}

export function RateDialog({
  busy,
  error,
  onClose,
  onSave,
}: {
  busy: boolean
  error: string | null
  onClose: () => void
  onSave: (values: Record<string, unknown>) => void
}) {
  const { t } = useI18n()
  const [base, setBase] = useState('BRL')
  const [target, setTarget] = useState('EUR')
  const [rate, setRate] = useState('')
  const [source, setSource] = useState('manual')
  const [formError, setFormError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = Number(rate.replace(',', '.'))
    if (!Number.isFinite(parsed) || parsed <= 0 || base === target) {
      setFormError(t('common.required'))
      return
    }
    onSave({
      base,
      target,
      rate: parsed.toFixed(6),
      source: source.trim() || 'manual',
      manual: true,
      fetched_at: new Date().toISOString(),
    })
  }

  return (
    <Shell
      title={t('fin.newRate')}
      onClose={onClose}
      busy={busy}
      error={formError ?? error}
      onSubmit={submit}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label={t('fin.from')}>
          {(aria) => (
            <select {...aria} value={base} onChange={(e) => setBase(e.target.value)} className={inputClass}>
              <option value="BRL">BRL</option>
              <option value="EUR">EUR</option>
            </select>
          )}
        </Field>
        <Field label={t('fin.to')}>
          {(aria) => (
            <select {...aria} value={target} onChange={(e) => setTarget(e.target.value)} className={inputClass}>
              <option value="EUR">EUR</option>
              <option value="BRL">BRL</option>
            </select>
          )}
        </Field>
        <Field label={`${t('fin.reference')} (ex.: 0,1650)`}>
          {(aria) => (
            <Input {...aria} value={rate} inputMode="decimal" onChange={(e) => setRate(e.target.value)} />
          )}
        </Field>
      </div>
      <Field label={t('fin.source')}>
        {(aria) => <Input {...aria} value={source} maxLength={80} onChange={(e) => setSource(e.target.value)} />}
      </Field>
    </Shell>
  )
}

export function OperationDialog({
  busy,
  error,
  onClose,
  onSave,
}: {
  busy: boolean
  error: string | null
  onClose: () => void
  onSave: (values: Record<string, unknown>) => void
}) {
  const { t } = useI18n()
  const [fromAmount, setFromAmount] = useState('')
  const [fromCurrency, setFromCurrency] = useState('BRL')
  const [toAmount, setToAmount] = useState('')
  const [toCurrency, setToCurrency] = useState('EUR')
  const [fee, setFee] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [source, setSource] = useState('')
  const [notes, setNotes] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const fromParsed = parseAmountInput(fromAmount)
    const toParsed = parseAmountInput(toAmount)
    const feeParsed = fee.trim() === '' ? '0.00' : parseAmountInput(fee)
    if (!fromParsed || !toParsed || feeParsed === null || !date || fromCurrency === toCurrency) {
      setFormError(t('common.required'))
      return
    }
    onSave({
      from_amount: fromParsed,
      from_currency: fromCurrency,
      to_amount: toParsed,
      to_currency: toCurrency,
      fee: feeParsed,
      date,
      source: source.trim() || null,
      notes: notes.trim() || null,
    })
  }

  return (
    <Shell
      title={t('fin.newOperation')}
      onClose={onClose}
      busy={busy}
      error={formError ?? error}
      onSubmit={submit}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t('fin.fromAmount')}>
          {(aria) => (
            <Input {...aria} value={fromAmount} inputMode="decimal" placeholder="0,00" onChange={(e) => setFromAmount(e.target.value)} />
          )}
        </Field>
        <Field label={t('fin.from')}>
          {(aria) => (
            <select {...aria} value={fromCurrency} onChange={(e) => setFromCurrency(e.target.value)} className={inputClass}>
              <option value="BRL">BRL</option>
              <option value="EUR">EUR</option>
            </select>
          )}
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t('fin.toAmountOp')}>
          {(aria) => (
            <Input {...aria} value={toAmount} inputMode="decimal" placeholder="0,00" onChange={(e) => setToAmount(e.target.value)} />
          )}
        </Field>
        <Field label={t('fin.to')}>
          {(aria) => (
            <select {...aria} value={toCurrency} onChange={(e) => setToCurrency(e.target.value)} className={inputClass}>
              <option value="EUR">EUR</option>
              <option value="BRL">BRL</option>
            </select>
          )}
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t('fin.fee')}>
          {(aria) => (
            <Input {...aria} value={fee} inputMode="decimal" placeholder="0,00" onChange={(e) => setFee(e.target.value)} />
          )}
        </Field>
        <Field label={t('fin.date')}>
          {(aria) => <Input {...aria} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t('fin.source')}>
          {(aria) => <Input {...aria} value={source} maxLength={80} onChange={(e) => setSource(e.target.value)} />}
        </Field>
        <Field label={t('fin.contributionNote')}>
          {(aria) => <Input {...aria} value={notes} maxLength={200} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
      </div>
    </Shell>
  )
}
