import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { useAuth } from '../../auth/context'
import { useHousehold } from '../../household/context'
import {
  useAgendaData,
  type AgendaEvent,
  type AgendaReminder,
  type AgendaTask,
} from '../../agenda/useAgenda'
import { expandRecurrence } from '../../agenda/recurrence'
import { newOp, useOutbox } from '../../offline/outbox'
import {
  eventInputSchema,
  reminderInputSchema,
  taskInputSchema,
  type RecurrenceRuleInput,
} from '../../data/agenda'
import { Button } from '../../ui/Button'
import { Card, CardTitle } from '../../ui/Card'
import { Input } from '../../ui/Input'
import { Modal } from '../../ui/Modal'
import { ItemDialog, type ItemKind } from './ItemDialog'
import { CalendarView } from './CalendarView'

type Tab = 'today' | 'calendar' | 'tasks' | 'reminders'

function localDayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function addDaysKey(base: string, days: number): string {
  const [y, m, d] = base.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  return localDayKey(date)
}

function formatTime(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date)
}

export function AgendaPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const { state: householdState } = useHousehold()
  const agenda = useAgendaData()
  const [searchParams, setSearchParams] = useSearchParams()

  const [tab, setTab] = useState<Tab>('today')
  const [manualDialog, setManualDialog] = useState<{
    kind: ItemKind
    editing: AgendaEvent | AgendaTask | AgendaReminder | null
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{
    kind: ItemKind
    id: string
  } | null>(null)
  const [postpone, setPostpone] = useState<{ ruleId: string; date: string } | null>(null)
  const [postponeValue, setPostponeValue] = useState('')
  const [selectedDay, setSelectedDay] = useState(() => localDayKey(new Date()))

  const [filterOwner, setFilterOwner] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterVisibility, setFilterVisibility] = useState('')

  const members =
    householdState.kind === 'ready'
      ? householdState.members.map((m) => ({ user_id: m.user_id, display_name: m.display_name }))
      : []

  const memberName = (userId: string | null) => {
    if (!userId) return t('agenda.owner.unassigned')
    if (userId === user?.id) return 'você'
    return members.find((m) => m.user_id === userId)?.display_name ?? userId.slice(0, 8)
  }

  const categoryName = (categoryId: string | null) =>
    agenda.categories.find((c) => c.id === categoryId)?.name ?? '—'

  // Ação rápida (?novo=tarefa|evento|lembrete): deriva o diálogo do parâmetro
  // de rota durante a renderização, sem efeito — fechar limpa o parâmetro.
  const novoParam = searchParams.get('novo')
  const quickKind: ItemKind | null =
    novoParam === 'tarefa' ? 'task' : novoParam === 'evento' ? 'event' : novoParam === 'lembrete' ? 'reminder' : null
  const dialog = manualDialog ?? (quickKind ? { kind: quickKind, editing: null } : null)

  function closeDialog() {
    setManualDialog(null)
    setServerError(null)
    if (searchParams.has('novo')) setSearchParams({}, { replace: true })
  }

  const rulesById = useMemo(
    () => new Map(agenda.rules.map((rule) => [rule.id, rule])),
    [agenda.rules],
  )
  const exceptionsByRule = useMemo(() => {
    const map = new Map<string, { original_date: string; action: 'skipped' | 'postponed'; new_start_at: string | null }[]>()
    for (const exception of agenda.exceptions) {
      const list = map.get(exception.rule_id) ?? []
      list.push(exception)
      map.set(exception.rule_id, list)
    }
    return map
  }, [agenda.exceptions])

  function matchesFilters(item: { owner_id: string | null; category_id: string | null; visibility: string }): boolean {
    if (filterOwner && item.owner_id !== filterOwner) return false
    if (filterCategory && item.category_id !== filterCategory) return false
    if (filterVisibility && item.visibility !== filterVisibility) return false
    return true
  }

  const todayKey = localDayKey(new Date())
  const windowEnd = addDaysKey(todayKey, 30)

  const eventOccurrences = useMemo(() => {
    const result: { event: AgendaEvent; date: string; postponedTo: string | null }[] = []
    for (const event of agenda.events) {
      if (!matchesFilters(event)) continue
      if (event.recurrence_rule_id) {
        const rule = rulesById.get(event.recurrence_rule_id)
        if (!rule) continue
        for (const occurrence of expandRecurrence(
          rule,
          exceptionsByRule.get(event.recurrence_rule_id) ?? [],
          todayKey,
          windowEnd,
        )) {
          result.push({ event, date: occurrence.date, postponedTo: occurrence.postponedTo })
        }
      } else {
        const dateKey = localDayKey(new Date(event.start_at))
        if (dateKey >= todayKey && dateKey <= windowEnd) {
          result.push({ event, date: dateKey, postponedTo: null })
        }
      }
    }
    result.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agenda.events, rulesById, exceptionsByRule, filterOwner, filterCategory, filterVisibility])

  const todayOccurrences = useMemo(
    () => eventOccurrences.filter((o) => o.date === todayKey),
    [eventOccurrences, todayKey],
  )

  const openTasks = useMemo(
    () =>
      agenda.tasks
        .filter((task) => task.status === 'open' && matchesFilters(task))
        .sort((a, b) => (a.due_at ?? '9999') < (b.due_at ?? '9999') ? -1 : 1),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agenda.tasks, filterOwner, filterCategory, filterVisibility],
  )

  const activeReminders = useMemo(
    () =>
      agenda.reminders
        .filter((reminder) => !reminder.dismissed_at && matchesFilters(reminder))
        .sort((a, b) => (a.remind_at < b.remind_at ? -1 : 1)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agenda.reminders, filterOwner, filterCategory, filterVisibility],
  )

  const calendarMarks = useMemo(() => {
    const marks = new Map<string, number>()
    for (const occurrence of eventOccurrences) {
      marks.set(occurrence.date, (marks.get(occurrence.date) ?? 0) + 1)
    }
    for (const task of openTasks) {
      if (!task.due_at) continue
      const key = localDayKey(new Date(task.due_at))
      marks.set(key, (marks.get(key) ?? 0) + 1)
    }
    for (const reminder of activeReminders) {
      const key = localDayKey(new Date(reminder.remind_at))
      marks.set(key, (marks.get(key) ?? 0) + 1)
    }
    return marks
  }, [eventOccurrences, openTasks, activeReminders])

  const selectedDayItems = useMemo(() => {
    const eventItems = eventOccurrences
      .filter((o) => o.date === selectedDay)
      .map((o) => ({ type: 'event' as const, id: o.event.id, title: o.event.title, time: formatTime(o.event.start_at) }))
    const taskItems = openTasks
      .filter((task) => task.due_at && localDayKey(new Date(task.due_at)) === selectedDay)
      .map((task) => ({ type: 'task' as const, id: task.id, title: task.title, time: formatTime(task.due_at) }))
    const reminderItems = activeReminders
      .filter((reminder) => localDayKey(new Date(reminder.remind_at)) === selectedDay)
      .map((reminder) => ({
        type: 'reminder' as const,
        id: reminder.id,
        title: reminder.title,
        time: formatTime(reminder.remind_at),
      }))
    return [...eventItems, ...taskItems, ...reminderItems]
  }, [eventOccurrences, openTasks, activeReminders, selectedDay])

  async function handleSave(values: Record<string, unknown>, rule: RecurrenceRuleInput | null) {
    if (!dialog) return
    const household = agenda.householdId
    const offline = typeof navigator !== 'undefined' && !navigator.onLine
    const opKind = dialog.kind === 'event' ? 'event.create' : dialog.kind === 'task' ? 'task.create' : 'reminder.create'

    // Offline: enfileira rascunho (sem recorrência — exige conexão).
    if (offline && !dialog.editing && household) {
      if (rule) {
        setServerError(t('sync.recurrenceOnline'))
        return
      }
      const me = user?.id ?? ''
      useOutbox.getState().enqueue(newOp(opKind, household, me, values))
      setServerError(null)
      setNotice(t('sync.savedOffline'))
      closeDialog()
      return
    }

    setBusy(true)
    setServerError(null)
    const table = dialog.kind === 'event' ? 'events_fh' : dialog.kind === 'task' ? 'tasks_fh' : 'reminders_fh'
    const schema =
      dialog.kind === 'event' ? eventInputSchema : dialog.kind === 'task' ? taskInputSchema : reminderInputSchema
    const result = await agenda.saveItem(table, schema, values, rule, dialog.editing?.id ?? null)
    setBusy(false)
    if (result.error) {
      setServerError(t('agenda.saveError', { message: result.error }))
      return
    }
    closeDialog()
  }

  async function handleCreateCategory(name: string): Promise<{ error: string | null; id?: string }> {
    const existing = agenda.categories.find(
      (c) => c.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    )
    if (existing) return { error: null, id: existing.id }
    const result = await agenda.createCategory({ domain: 'agenda', name })
    if (result.error) return { error: result.error }
    const created = agenda.categories.find(
      (c) => c.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    )
    return { error: null, id: created?.id }
  }

  async function handleDelete() {
    if (!confirmDelete) return
    setBusy(true)
    const table =
      confirmDelete.kind === 'event' ? 'events_fh' : confirmDelete.kind === 'task' ? 'tasks_fh' : 'reminders_fh'
    const result = await agenda.removeItem(table, confirmDelete.id)
    setBusy(false)
    setConfirmDelete(null)
    if (result.error) setServerError(t('agenda.saveError', { message: result.error }))
  }

  async function handleToggleTask(task: AgendaTask) {
    const offline = typeof navigator !== 'undefined' && !navigator.onLine
    if (offline && agenda.householdId && user) {
      useOutbox.getState().enqueue(
        newOp('task.update', agenda.householdId, user.id, {
          id: task.id,
          status: task.status === 'open' ? 'done' : 'open',
          completed_at: task.status === 'open' ? new Date().toISOString() : null,
        }, task.id, task.updated_at),
      )
      setNotice(t('sync.savedOffline'))
      return
    }
    const result = await agenda.setTaskStatus(task.id, task.status === 'open' ? 'done' : 'open')
    if (result.error) setServerError(t('agenda.saveError', { message: result.error }))
  }

  async function handleDismissReminder(reminder: AgendaReminder) {
    const result = await agenda.dismissReminder(reminder.id)
    if (result.error) setServerError(t('agenda.saveError', { message: result.error }))
  }

  const filterClass =
    'h-9 rounded-md border border-input bg-card px-2 text-sm text-foreground'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">{t('agenda.title')}</h1>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setManualDialog({ kind: 'task', editing: null })}>
            {t('agenda.newTask')}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setManualDialog({ kind: 'event', editing: null })}>
            {t('agenda.newEvent')}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setManualDialog({ kind: 'reminder', editing: null })}>
            {t('agenda.newReminder')}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('agenda.title')}>
        {(['today', 'calendar', 'tasks', 'reminders'] as Tab[]).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={
              tab === value
                ? 'rounded-md border border-primary bg-accent px-3 py-1.5 text-sm font-medium'
                : 'rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted'
            }
          >
            {value === 'today'
              ? t('agenda.today')
              : value === 'calendar'
                ? t('agenda.calendar')
                : value === 'tasks'
                  ? t('agenda.tasks')
                  : t('agenda.reminders')}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {t('agenda.filter.person')}
          <select value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)} className={filterClass}>
            <option value="">{t('agenda.filter.all')}</option>
            {members.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {member.display_name ?? member.user_id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {t('agenda.filter.category')}
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className={filterClass}>
            <option value="">{t('agenda.filter.all')}</option>
            {agenda.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {t('agenda.filter.visibility')}
          <select
            value={filterVisibility}
            onChange={(e) => setFilterVisibility(e.target.value)}
            className={filterClass}
          >
            <option value="">{t('agenda.filter.all')}</option>
            <option value="shared">{t('agenda.visibility.shared')}</option>
            <option value="personal">{t('agenda.visibility.personal')}</option>
          </select>
        </label>
      </div>

      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}

      {agenda.status === 'loading' && (
        <p className="text-sm text-muted-foreground" role="status">
          {t('common.loading')}
        </p>
      )}

      {agenda.status === 'error' && (
        <Card>
          <p className="text-sm text-destructive" role="alert">
            {t('common.error', { message: agenda.error ?? '' })}
          </p>
          <div className="mt-2">
            <Button size="sm" variant="secondary" onClick={agenda.reload}>
              {t('common.retry')}
            </Button>
          </div>
        </Card>
      )}

      {agenda.status === 'ready' && tab === 'today' && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardTitle className="mb-2">
              {t('agenda.events')} · {t('agenda.today')}
            </CardTitle>
            {todayOccurrences.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('agenda.empty')}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-[var(--border)]">
                {todayOccurrences.map((o, index) => (
                  <li key={`${o.event.id}-${o.date}-${index}`} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <div className="flex flex-col">
                      <span className="font-medium">{o.event.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {o.event.all_day ? t('agenda.allDay') : formatTime(o.event.start_at)}
                        {o.postponedTo ? ` → ${formatDate(o.postponedTo)} ${formatTime(o.postponedTo)}` : ''}
                        {' · '}
                        {categoryName(o.event.category_id)} · {memberName(o.event.owner_id)}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setManualDialog({ kind: 'event', editing: o.event })}
                      >
                        {t('agenda.editEvent')}
                      </Button>
                      {o.event.recurrence_rule_id && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void agenda.skipOccurrence(o.event.recurrence_rule_id as string, o.date)}
                          >
                            {t('agenda.skipOccurrence')}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setPostponeValue('')
                              setPostpone({
                                ruleId: o.event.recurrence_rule_id as string,
                                date: o.date,
                              })
                            }}
                          >
                            {t('agenda.postponeOccurrence')}
                          </Button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardTitle className="mb-2">{t('overview.tasksOpen')}</CardTitle>
            {openTasks.filter((task) => !task.due_at || localDayKey(new Date(task.due_at)) <= addDaysKey(todayKey, 7)).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('agenda.empty')}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-[var(--border)]">
                {openTasks
                  .filter((task) => !task.due_at || localDayKey(new Date(task.due_at)) <= addDaysKey(todayKey, 7))
                  .map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      memberName={memberName}
                      categoryName={categoryName}
                      onToggle={() => void handleToggleTask(task)}
                      onEdit={() => setManualDialog({ kind: 'task', editing: task })}
                      onDelete={() => setConfirmDelete({ kind: 'task', id: task.id })}
                    />
                  ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {agenda.status === 'ready' && tab === 'calendar' && (
        <Card>
          <CalendarView marks={calendarMarks} selected={selectedDay} onSelect={setSelectedDay} />
          <div className="mt-3">
            {selectedDayItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('agenda.empty')}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-[var(--border)]">
                {selectedDayItems.map((item) => (
                  <li key={`${item.type}-${item.id}`} className="flex items-center justify-between py-1.5 text-sm">
                    <span>
                      <span className="mr-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {item.type === 'event'
                          ? t('agenda.events')
                          : item.type === 'task'
                            ? t('agenda.tasks')
                            : t('agenda.reminders')}
                      </span>
                      {item.title}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">{item.time}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      )}

      {agenda.status === 'ready' && tab === 'tasks' && (
        <Card>
          <CardTitle className="mb-2">{t('agenda.tasks')}</CardTitle>
          {openTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('agenda.empty')}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--border)]">
              {openTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  memberName={memberName}
                  categoryName={categoryName}
                  onToggle={() => void handleToggleTask(task)}
                  onEdit={() => setManualDialog({ kind: 'task', editing: task })}
                  onDelete={() => setConfirmDelete({ kind: 'task', id: task.id })}
                />
              ))}
            </ul>
          )}
        </Card>
      )}

      {agenda.status === 'ready' && tab === 'reminders' && (
        <Card>
          <CardTitle className="mb-2">{t('agenda.reminders')}</CardTitle>
          {activeReminders.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('agenda.empty')}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--border)]">
              {activeReminders.map((reminder) => (
                <li key={reminder.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div className="flex flex-col">
                    <span className="font-medium">{reminder.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(reminder.remind_at)} {formatTime(reminder.remind_at)}
                      {' · '}
                      {categoryName(reminder.category_id)} · {memberName(reminder.owner_id)}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setManualDialog({ kind: 'reminder', editing: reminder })}
                    >
                      {t('agenda.editReminder')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleDismissReminder(reminder)}
                    >
                      {t('agenda.dismiss')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {dialog && (
        <ItemDialog
          kind={dialog.kind}
          initial={dialog.editing}
          categories={agenda.categories}
          members={members}
          busy={busy}
          serverError={serverError}
          onClose={closeDialog}
          onSave={(values, rule) => void handleSave(values, rule)}
          onCreateCategory={handleCreateCategory}
        />
      )}

      {confirmDelete && (
        <Modal title={t('agenda.delete')} onClose={() => setConfirmDelete(null)}>
          <p className="mb-4 text-sm text-muted-foreground">{t('agenda.deleteConfirm')}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmDelete(null)} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={busy}>
              {t('agenda.delete')}
            </Button>
          </div>
        </Modal>
      )}

      {postpone && (
        <Modal title={t('agenda.postponeOccurrence')} onClose={() => setPostpone(null)}>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (!postponeValue) return
              void (async () => {
                const result = await agenda.postponeOccurrence(
                  postpone.ruleId,
                  postpone.date,
                  new Date(postponeValue).toISOString(),
                )
                if (result.error) setServerError(result.error)
                setPostpone(null)
              })()
            }}
          >
            <Input
              type="datetime-local"
              aria-label={t('agenda.postponeTo')}
              value={postponeValue}
              onChange={(e) => setPostponeValue(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPostpone(null)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit">{t('common.save')}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function TaskRow({
  task,
  memberName,
  categoryName,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: AgendaTask
  memberName: (id: string | null) => string
  categoryName: (id: string | null) => string
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useI18n()
  const [now] = useState(() => Date.now())
  const overdue = task.due_at !== null && Date.parse(task.due_at) < now

  return (
    <li className="flex items-center justify-between gap-2 py-2 text-sm">
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={false}
          onChange={onToggle}
          aria-label={`${t('agenda.markDone')}: ${task.title}`}
          className="mt-1"
        />
        <div className="flex flex-col">
          <span className="font-medium">{task.title}</span>
          <span className="text-xs text-muted-foreground">
            {overdue ? (
              <strong className="text-destructive">{t('agenda.overdue')} · </strong>
            ) : null}
            {task.due_at ? `${formatDate(task.due_at)} ${formatTime(task.due_at)}` : t('agenda.noDueDate')}
            {` · ${t(`agenda.priority.${task.priority}`)} · ${categoryName(task.category_id)} · ${memberName(task.owner_id)}`}
          </span>
        </div>
      </div>
      <div className="flex gap-1">
        <Button size="sm" variant="secondary" onClick={onEdit}>
          {t('agenda.editTask')}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>
          {t('agenda.delete')}
        </Button>
      </div>
    </li>
  )
}
