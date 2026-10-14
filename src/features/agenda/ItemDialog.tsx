import { useState, type FormEvent } from 'react'
import { useI18n } from '../../i18n'
import { Button } from '../../ui/Button'
import { Field, Input } from '../../ui/Input'
import { Modal } from '../../ui/Modal'
import type { Frequency } from '../../agenda/recurrence'
import type { RecurrenceRuleInput } from '../../data/agenda'
import type { Category, AgendaEvent, AgendaTask, AgendaReminder } from '../../agenda/useAgenda'

export type ItemKind = 'event' | 'task' | 'reminder'

type Member = { user_id: string; display_name: string | null }

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromLocalInput(value: string): string {
  return new Date(value).toISOString()
}

export function ItemDialog({
  kind,
  initial,
  categories,
  members,
  busy,
  serverError,
  onClose,
  onSave,
  onCreateCategory,
}: {
  kind: ItemKind
  initial: AgendaEvent | AgendaTask | AgendaReminder | null
  categories: Category[]
  members: Member[]
  busy: boolean
  serverError: string | null
  onClose: () => void
  onSave: (values: Record<string, unknown>, rule: RecurrenceRuleInput | null) => void
  onCreateCategory: (name: string) => Promise<{ error: string | null; id?: string }>
}) {
  const { t } = useI18n()

  const asEvent = kind === 'event' ? (initial as AgendaEvent | null) : null
  const asTask = kind === 'task' ? (initial as AgendaTask | null) : null
  const asReminder = kind === 'reminder' ? (initial as AgendaReminder | null) : null

  const [title, setTitle] = useState(initial?.title ?? '')
  const [notes, setNotes] = useState(
    asEvent?.description ?? asTask?.notes ?? asReminder?.notes ?? '',
  )
  const [location, setLocation] = useState(asEvent?.location ?? '')
  const [start, setStart] = useState(() =>
    toLocalInput(asEvent?.start_at ?? asTask?.due_at ?? asReminder?.remind_at ?? null),
  )
  const [end, setEnd] = useState(() => toLocalInput(asEvent?.end_at ?? null))
  const [allDay, setAllDay] = useState(asEvent?.all_day ?? false)
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>(
    asTask?.priority ?? 'medium',
  )
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? '')
  const [newCategory, setNewCategory] = useState('')
  const [visibility, setVisibility] = useState<'shared' | 'personal'>(
    initial?.visibility ?? 'shared',
  )
  const [ownerId, setOwnerId] = useState(initial?.owner_id ?? '')
  const [frequency, setFrequency] = useState<'none' | Frequency>(
    initial?.recurrence_rule_id ? 'daily' : 'none',
  )
  const [intervalN, setIntervalN] = useState('1')
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [endMode, setEndMode] = useState<'never' | 'date' | 'count'>('never')
  const [endDate, setEndDate] = useState('')
  const [endCount, setEndCount] = useState('10')
  const [formError, setFormError] = useState<string | null>(null)

  const dialogTitle =
    kind === 'event'
      ? initial
        ? t('agenda.editEvent')
        : t('agenda.newEvent')
      : kind === 'task'
        ? initial
          ? t('agenda.editTask')
          : t('agenda.newTask')
        : initial
          ? t('agenda.editReminder')
          : t('agenda.newReminder')

  function toggleWeekday(day: number) {
    setWeekdays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort(),
    )
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)

    if (!title.trim()) {
      setFormError(t('common.required'))
      return
    }

    let finalCategoryId = categoryId || null
    if (newCategory.trim()) {
      const created = await onCreateCategory(newCategory.trim())
      if (created.error || !created.id) {
        setFormError(created.error ?? t('common.required'))
        return
      }
      finalCategoryId = created.id
    }

    const values: Record<string, unknown> = {
      title: title.trim(),
      category_id: finalCategoryId,
      visibility,
      owner_id: ownerId || null,
    }

    if (kind === 'event') {
      if (!start) {
        setFormError(t('common.required'))
        return
      }
      values.description = notes.trim() || null
      values.location = location.trim() || null
      values.start_at = fromLocalInput(start)
      values.end_at = end ? fromLocalInput(end) : null
      values.all_day = allDay
    } else if (kind === 'task') {
      values.notes = notes.trim() || null
      values.due_at = start ? fromLocalInput(start) : null
      values.priority = priority
    } else {
      if (!start) {
        setFormError(t('common.required'))
        return
      }
      values.notes = notes.trim() || null
      values.remind_at = fromLocalInput(start)
    }

    let rule: RecurrenceRuleInput | null = null
    if (frequency !== 'none' && !initial) {
      const startDate = (kind === 'event' ? values.start_at : values.due_at ?? values.remind_at) as
        | string
        | null
      if (!startDate) {
        setFormError(t('common.required'))
        return
      }
      rule = {
        frequency,
        interval_n: Math.max(1, Number.parseInt(intervalN, 10) || 1),
        days_of_week: frequency === 'weekly' && weekdays.length > 0 ? weekdays : null,
        month_day: null,
        start_date: (startDate as string).slice(0, 10),
        end_date: endMode === 'date' && endDate ? endDate : null,
        occurrence_count:
          endMode === 'count' ? Math.max(1, Number.parseInt(endCount, 10) || 1) : null,
        timezone: 'Europe/Dublin',
      }
    }

    onSave(values, rule)
  }

  const inputClass =
    'h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground'

  return (
    <Modal title={dialogTitle} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Field label={t('agenda.titleField')} error={!title.trim() ? t('common.required') : null}>
          {(aria) => (
            <Input {...aria} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
          )}
        </Field>

        {kind === 'event' && (
          <>
            <Field label={t('agenda.description')}>
              {(aria) => (
                <textarea
                  {...aria}
                  value={notes}
                  rows={2}
                  maxLength={2000}
                  onChange={(e) => setNotes(e.target.value)}
                  className={`${inputClass} h-auto py-2`}
                />
              )}
            </Field>
            <Field label={t('agenda.location')}>
              {(aria) => (
                <Input
                  {...aria}
                  value={location}
                  maxLength={200}
                  onChange={(e) => setLocation(e.target.value)}
                />
              )}
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t('agenda.start')}>
                {(aria) => (
                  <Input
                    {...aria}
                    type="datetime-local"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                  />
                )}
              </Field>
              <Field label={t('agenda.end')}>
                {(aria) => (
                  <Input
                    {...aria}
                    type="datetime-local"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                )}
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
              />
              {t('agenda.allDay')}
            </label>
          </>
        )}

        {kind === 'task' && (
          <>
            <Field label={t('agenda.notes')}>
              {(aria) => (
                <textarea
                  {...aria}
                  value={notes}
                  rows={2}
                  maxLength={2000}
                  onChange={(e) => setNotes(e.target.value)}
                  className={`${inputClass} h-auto py-2`}
                />
              )}
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t('agenda.dueAt')}>
                {(aria) => (
                  <Input
                    {...aria}
                    type="datetime-local"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                  />
                )}
              </Field>
              <Field label={t('agenda.priority')}>
                {(aria) => (
                  <select
                    {...aria}
                    value={priority}
                    onChange={(e) =>
                      setPriority(e.target.value as 'low' | 'medium' | 'high' | 'urgent')
                    }
                    className={inputClass}
                  >
                    {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
                      <option key={p} value={p}>
                        {t(`agenda.priority.${p}`)}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
          </>
        )}

        {kind === 'reminder' && (
          <>
            <Field label={t('agenda.notes')}>
              {(aria) => (
                <textarea
                  {...aria}
                  value={notes}
                  rows={2}
                  maxLength={2000}
                  onChange={(e) => setNotes(e.target.value)}
                  className={`${inputClass} h-auto py-2`}
                />
              )}
            </Field>
            <Field label={t('agenda.remindAt')}>
              {(aria) => (
                <Input
                  {...aria}
                  type="datetime-local"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              )}
            </Field>
          </>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('agenda.category')}>
            {(aria) => (
              <select
                {...aria}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={inputClass}
              >
                <option value="">—</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={`${t('agenda.category')} (nova)`}>
            {(aria) => (
              <Input
                {...aria}
                value={newCategory}
                maxLength={40}
                placeholder="—"
                onChange={(e) => setNewCategory(e.target.value)}
              />
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
          <Field label={t('agenda.owner')}>
            {(aria) => (
              <select
                {...aria}
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className={inputClass}
              >
                <option value="">{t('agenda.owner.unassigned')}</option>
                {members.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.display_name ?? member.user_id.slice(0, 8)}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>

        {!initial && (
          <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
            <legend className="px-1 text-sm font-medium">{t('agenda.recurrence')}</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm">
                {t('agenda.recurrence')}
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as 'none' | Frequency)}
                  className={inputClass}
                >
                  <option value="none">{t('agenda.recurrence.none')}</option>
                  <option value="daily">{t('agenda.recurrence.daily')}</option>
                  <option value="weekly">{t('agenda.recurrence.weekly')}</option>
                  <option value="monthly">{t('agenda.recurrence.monthly')}</option>
                  <option value="yearly">{t('agenda.recurrence.yearly')}</option>
                </select>
              </label>
              {frequency !== 'none' && (
                <label className="flex flex-col gap-1.5 text-sm">
                  {t('agenda.recurrence.intervalUnit')}
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={intervalN}
                    onChange={(e) => setIntervalN(e.target.value)}
                  />
                </label>
              )}
            </div>

            {frequency === 'weekly' && (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('agenda.recurrence.weekdays')}>
                {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={weekdays.includes(day)}
                    onClick={() => toggleWeekday(day)}
                    className={
                      weekdays.includes(day)
                        ? 'rounded-md border border-primary bg-accent px-2.5 py-1 text-xs font-medium'
                        : 'rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground'
                    }
                  >
                    {t(`agenda.weekday.${day}` as 'agenda.weekday.0')}
                  </button>
                ))}
              </div>
            )}

            {frequency !== 'none' && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>{t('agenda.recurrence.end')}:</span>
                {(['never', 'date', 'count'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={endMode === mode}
                    onClick={() => setEndMode(mode)}
                    className={
                      endMode === mode
                        ? 'rounded-md border border-primary bg-accent px-2.5 py-1 text-xs font-medium'
                        : 'rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground'
                    }
                  >
                    {mode === 'never'
                      ? t('agenda.recurrence.endNever')
                      : mode === 'date'
                        ? t('agenda.recurrence.endDate')
                        : t('agenda.recurrence.endCount')}
                  </button>
                ))}
                {endMode === 'date' && (
                  <Input
                    type="date"
                    aria-label={t('agenda.recurrence.endDate')}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-auto"
                  />
                )}
                {endMode === 'count' && (
                  <Input
                    type="number"
                    aria-label={t('agenda.recurrence.endCount')}
                    min={1}
                    value={endCount}
                    onChange={(e) => setEndCount(e.target.value)}
                    className="w-24"
                  />
                )}
              </div>
            )}
          </fieldset>
        )}

        {(formError || serverError) && (
          <p role="alert" className="text-sm text-destructive">
            {formError ?? serverError}
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
