/**
 * Gerador de notificações internas a partir de tarefas, lembretes e eventos.
 *
 * Função pura e idempotente: cada minuta carrega uma `dedupe_key` estável
 * (`tipo:id:data:motivo`), e a tabela `notifications_fh` tem unicidade em
 * (user_id, dedupe_key) — rodar o gerador N vezes nunca duplica avisos.
 *
 * Regras:
 * - Tarefas abertas vencidas há até 7 dias geram `task_overdue` (uma por dia).
 * - Tarefas/lembretes/eventos com vencimento dentro de `leadHours` geram
 *   `due_soon` (uma por item/dia).
 * - Tarefas concluídas/canceladas, lembretes dispensados e itens sem data
 *   são ignorados.
 */

export type DueItemKind = 'task' | 'reminder' | 'event'

export type DueItem = {
  kind: DueItemKind
  id: string
  title: string
  dueAt: string | null
  done: boolean
}

export type NotificationDraft = {
  type: 'task_overdue' | 'due_soon'
  title: string
  body: string
  ref_type: DueItemKind
  ref_id: string
  dedupe_key: string
}

const OVERDUE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

function dayKey(instant: number): string {
  return new Date(instant).toISOString().slice(0, 10)
}

function formatWhen(due: number, now: number, timeZone: string): string {
  const sameDay = dayKey(due) === dayKey(now)
  const time = new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(due))
  if (sameDay) return `hoje às ${time}`
  const date = new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(due))
  return `${date} às ${time}`
}

export function buildDueNotifications(
  items: DueItem[],
  now: number,
  leadHours: number,
  timeZone = 'Europe/Dublin',
): NotificationDraft[] {
  const drafts: NotificationDraft[] = []
  const leadMs = Math.max(0, leadHours) * 60 * 60 * 1000

  for (const item of items) {
    if (item.done || !item.dueAt) continue
    const due = Date.parse(item.dueAt)
    if (Number.isNaN(due)) continue

    const when = formatWhen(due, now, timeZone)

    if (due < now && now - due <= OVERDUE_WINDOW_MS) {
      drafts.push({
        type: 'task_overdue',
        title: `Em atraso: ${item.title}`,
        body: `Vencia ${when}.`,
        ref_type: item.kind,
        ref_id: item.id,
        dedupe_key: `${item.kind}:${item.id}:${dayKey(now)}:overdue`,
      })
    } else if (due >= now && due - now <= leadMs) {
      drafts.push({
        type: 'due_soon',
        title: `A vencer: ${item.title}`,
        body: `Vence ${when}.`,
        ref_type: item.kind,
        ref_id: item.id,
        dedupe_key: `${item.kind}:${item.id}:${dayKey(due)}:soon`,
      })
    }
  }

  return drafts
}
