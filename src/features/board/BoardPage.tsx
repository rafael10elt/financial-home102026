import { useMemo, useState } from 'react'
import { useAuth } from '../../auth/context'
import { useAgendaData, type AgendaTask } from '../../agenda/useAgenda'
import { useHousehold } from '../../household/context'
import { useI18n } from '../../i18n'
import { taskInputSchema, type RecurrenceRuleInput } from '../../data/agenda'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { Modal } from '../../ui/Modal'
import { useToast } from '../../ui/toastContext'
import { ItemDialog } from '../agenda/ItemDialog'

type TaskStatus = 'open' | 'in_progress' | 'done'
type TaskDialog = { task: AgendaTask | null }

const lanes: { status: TaskStatus; key: 'board.todo' | 'board.doing' | 'board.done'; tone: string }[] = [
  { status: 'open', key: 'board.todo', tone: 'border-slate-400/50' },
  { status: 'in_progress', key: 'board.doing', tone: 'border-sky-500/50' },
  { status: 'done', key: 'board.done', tone: 'border-emerald-500/50' },
]

function formatDue(iso: string | null, locale: string): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)
}

export function BoardPage() {
  const { t, locale } = useI18n()
  const { state: householdState } = useHousehold()
  const { user } = useAuth()
  const agenda = useAgendaData()
  const { notify } = useToast()
  const [dialog, setDialog] = useState<TaskDialog | null>(null)
  const [deleteTask, setDeleteTask] = useState<AgendaTask | null>(null)
  const [busy, setBusy] = useState(false)
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)

  const members = householdState.kind === 'ready'
    ? householdState.members.map((member) => ({ user_id: member.user_id, display_name: member.display_name }))
    : []
  const tasksByStatus = useMemo(() => {
    const visible = agenda.tasks.filter((task) => task.status !== 'cancelled')
    return new Map(lanes.map((lane) => [lane.status, visible.filter((task) => task.status === lane.status)]))
  }, [agenda.tasks])

  const categoryName = (categoryId: string | null) => agenda.categories.find((category) => category.id === categoryId)?.name ?? t('agenda.category')
  const memberName = (userId: string | null) => !userId
    ? t('agenda.owner.unassigned')
    : members.find((member) => member.user_id === userId)?.display_name ?? t('agenda.owner.unassigned')
  const isHouseholdOwner = householdState.kind === 'ready' && householdState.members.some((member) => member.user_id === user?.id && member.role === 'owner')

  async function moveTask(task: AgendaTask, status: TaskStatus) {
    if (task.status === status) return
    const { error } = await agenda.setTaskStatus(task.id, status)
    if (error) {
      notify('error', t('board.title'), t('agenda.saveError', { message: error }))
      return
    }
    notify('success', t('board.title'), t('board.moved', { status: t(lanes.find((lane) => lane.status === status)!.key) }))
  }

  async function saveTask(values: Record<string, unknown>, rule: RecurrenceRuleInput | null) {
    if (!dialog) return
    setBusy(true)
    const result = await agenda.saveItem('tasks_fh', taskInputSchema, values, rule, dialog.task?.id ?? null)
    setBusy(false)
    if (result.error) {
      notify('error', t('board.title'), t('agenda.saveError', { message: result.error }))
      return
    }
    setDialog(null)
    notify('success', t('board.title'), t(dialog.task ? 'board.taskUpdated' : 'board.taskCreated'))
  }

  async function confirmDelete() {
    if (!deleteTask) return
    setBusy(true)
    const result = await agenda.removeItem('tasks_fh', deleteTask.id)
    setBusy(false)
    setDeleteTask(null)
    if (result.error) {
      notify('error', t('board.title'), t('agenda.saveError', { message: result.error }))
      return
    }
    notify('success', t('board.title'), t('board.taskDeleted'))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h1 className="text-xl font-semibold">{t('board.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('board.description')}</p>
        </div>
        <Button className="ml-auto" onClick={() => setDialog({ task: null })}>＋ {t('agenda.newTask')}</Button>
      </div>

      {agenda.status === 'loading' && <Card><p className="text-sm text-muted-foreground">{t('common.loading')}</p></Card>}
      {agenda.status === 'error' && <Card><p className="text-sm text-destructive" role="alert">{t('agenda.saveError', { message: agenda.error ?? '' })}</p><Button className="mt-3" variant="secondary" size="sm" onClick={() => void agenda.reload()}>{t('common.retry')}</Button></Card>}

      {agenda.status === 'ready' && <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-3">
        {lanes.map((lane) => {
          const tasks = tasksByStatus.get(lane.status) ?? []
          return <section key={lane.status} className={`flex min-h-48 min-w-0 flex-col rounded-xl border-t-4 ${lane.tone} bg-muted/30 p-3`}
            aria-label={t(lane.key)}
            onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }}
            onDrop={(event) => {
              event.preventDefault()
              const id = event.dataTransfer.getData('text/plain') || draggedTaskId
              const task = agenda.tasks.find((item) => item.id === id)
              if (task) void moveTask(task, lane.status)
              setDraggedTaskId(null)
            }}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="font-semibold">{t(lane.key)}</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">{tasks.length}</span>
            </div>
            {tasks.length === 0 && <p className="py-5 text-center text-sm text-muted-foreground">{t('board.laneEmpty')}</p>}
            <ul className="flex min-w-0 flex-col gap-2">
              {tasks.map((task) => <li key={task.id} draggable
                onDragStart={(event) => { setDraggedTaskId(task.id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', task.id) }}
                onDragEnd={() => setDraggedTaskId(null)}
                className={`min-w-0 rounded-lg border border-border bg-card p-3 shadow-sm ${draggedTaskId === task.id ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="min-w-0 break-words font-medium">{task.title}</h3>
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px]">{t(`agenda.priority.${task.priority}`)}</span>
                </div>
                {task.notes && <p className="mt-1 line-clamp-3 break-words text-xs text-muted-foreground">{task.notes}</p>}
                <dl className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                  {task.due_at && <div className="flex justify-between gap-2"><dt>{t('agenda.dueAt')}</dt><dd className={task.due_at < new Date().toISOString() && task.status !== 'done' ? 'text-destructive' : ''}>{formatDue(task.due_at, locale)}</dd></div>}
                  <div className="flex justify-between gap-2"><dt>{t('agenda.category')}</dt><dd className="truncate">{categoryName(task.category_id)}</dd></div>
                  <div className="flex justify-between gap-2"><dt>{t('agenda.owner')}</dt><dd className="truncate">{memberName(task.owner_id)}</dd></div>
                </dl>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <label className="sr-only" htmlFor={`board-status-${task.id}`}>{t('board.moveTask', { name: task.title })}</label>
                  <select id={`board-status-${task.id}`} value={task.status} disabled={busy} onChange={(event) => void moveTask(task, event.target.value as TaskStatus)} className="h-8 min-w-0 flex-1 rounded-md border border-input bg-card px-2 text-xs">
                    {lanes.map((option) => <option key={option.status} value={option.status}>{t(option.key)}</option>)}
                  </select>
                  {(task.created_by === user?.id || task.owner_id === user?.id || isHouseholdOwner) && <>
                    <Button size="sm" variant="secondary" onClick={() => setDialog({ task })}>{t('agenda.editTask')}</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteTask(task)} aria-label={`${t('agenda.delete')}: ${task.title}`}>×</Button>
                  </>}
                </div>
              </li>)}
            </ul>
          </section>
        })}
      </div>}

      {dialog && <ItemDialog kind="task" initial={dialog.task} categories={agenda.categories} members={members} busy={busy} serverError={null} onClose={() => setDialog(null)} onSave={(values, rule) => void saveTask(values, rule)} onCreateCategory={async (name) => {
        const result = await agenda.createCategory({ domain: 'agenda', name, kind: null, color: null, icon: null })
        return { error: result.error }
      }} />}

      {deleteTask && <Modal title={t('board.deleteTitle')} onClose={() => setDeleteTask(null)}>
        <p className="text-sm text-muted-foreground">{t('board.deleteConfirm', { name: deleteTask.title })}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteTask(null)}>{t('common.cancel')}</Button>
          <Button variant="destructive" disabled={busy} onClick={() => void confirmDelete()}>{t('agenda.delete')}</Button>
        </div>
      </Modal>}
    </div>
  )
}
