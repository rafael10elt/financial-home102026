/**
 * Espelho frontend do catálogo de tools (a fonte autoritativa é a Edge
 * Function `groq-chat`). Usado para validar argumentos localmente e rotular
 * quais ações exigem confirmação — nunca para executar nada diretamente.
 */

export type ToolInfo = {
  name: string
  description: string
  sensitive: boolean
  required: string[]
}

export const TOOL_CATALOG: ToolInfo[] = [
  { name: 'agenda_today', description: 'Agenda dos próximos 7 dias', sensitive: false, required: [] },
  { name: 'tasks_open', description: 'Tarefas abertas', sensitive: false, required: [] },
  { name: 'finance_summary', description: 'Resumo do mês', sensitive: false, required: [] },
  { name: 'finance_pending', description: 'Lançamentos pendentes', sensitive: false, required: [] },
  { name: 'goals_progress', description: 'Progresso das metas', sensitive: false, required: [] },
  { name: 'moods_recent', description: 'Humores recentes', sensitive: false, required: [] },
  { name: 'task_create', description: 'Criar tarefa', sensitive: false, required: ['title'] },
  { name: 'reminder_create', description: 'Criar lembrete', sensitive: false, required: ['title', 'remind_at'] },
  { name: 'event_create', description: 'Criar evento', sensitive: false, required: ['title', 'start_at'] },
  { name: 'mood_log', description: 'Registrar humor', sensitive: false, required: ['mood_name'] },
  { name: 'finance_transaction_create', description: 'Criar lançamento (sempre pendente)', sensitive: false, required: ['kind', 'amount', 'description', 'account_id', 'date'] },
  { name: 'finance_transaction_update', description: 'Alterar lançamento', sensitive: true, required: ['id'] },
  { name: 'finance_transaction_delete', description: 'Excluir lançamento', sensitive: true, required: ['id'] },
]

export function toolInfo(name: string): ToolInfo | null {
  return TOOL_CATALOG.find((tool) => tool.name === name) ?? null
}

/** Valida presença dos campos obrigatórios antes de exibir a prévia. */
export function validateToolArgs(name: string, args: Record<string, unknown>): string | null {
  const info = toolInfo(name)
  if (!info) return `Ferramenta desconhecida: ${name}.`
  for (const field of info.required) {
    const value = args[field]
    if (value === undefined || value === null || String(value).trim() === '') {
      return `Campo obrigatório ausente: ${field}.`
    }
  }
  return null
}

export type PendingConfirmation = {
  action_id: string
  tool: string
  preview: string
}

export type ChatResponse =
  | { ok: true; reply: string; confirmations: PendingConfirmation[]; executed?: string }
  | { ok: false; code: string; detail?: string }

export function mapBackendError(code: string): 'no-key' | 'invalid' | 'quota' | 'model' | 'unavailable' | 'session' | 'unknown' {
  switch (code) {
    case 'NO_KEY':
      return 'no-key'
    case 'INVALID_KEY':
    case 'INVALID_KEY_FORMAT':
      return 'invalid'
    case 'QUOTA_EXCEEDED':
      return 'quota'
    case 'MODEL_NOT_SUPPORTED':
      return 'model'
    case 'GROQ_UNAVAILABLE':
    case 'TOOL_FAILED':
      return 'unavailable'
    case 'NO_SESSION':
      return 'session'
    default:
      return 'unknown'
  }
}
