/**
 * Resumo diário da casa para o n8n (ou cópia manual).
 * Montado no frontend a partir dos dados já carregados — contém apenas
 * totais e próximos vencimentos, nunca o banco inteiro nem segredos.
 */

export type DigestInput = {
  date: string
  tasksOpen: number
  tasksOverdue: { title: string; dueAt: string | null }[]
  eventsToday: { title: string; time: string }[]
  remindersToday: { title: string; time: string }[]
  finance: { incomeMinor: number; expenseMinor: number; pending: number; overdue: number; currency: string }
  moods: { user: string; mood: string }[]
  unreadNotifications: number
}

export type DigestPayload = DigestInput & {
  generated_at: string
  source: 'financial-home-102026'
}

export function buildDigest(input: DigestInput, now: number = Date.now()): DigestPayload {
  return {
    ...input,
    tasksOpen: Math.max(0, Math.floor(input.tasksOpen)),
    finance: { ...input.finance },
    generated_at: new Date(now).toISOString(),
    source: 'financial-home-102026',
  }
}
