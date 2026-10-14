import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Outbox offline: rascunhos e operações seguras aguardando sincronização.
 *
 * Escopo deliberado (Mapa §16): apenas CRIAÇÕES de tarefas, lembretes,
 * eventos, dicas, fofocas e posts (texto) + ATUALIZAÇÕES de tarefas e posts.
 * Lançamentos financeiros e mídia exigem conexão (consistência/auditoria).
 *
 * Idempotência:
 * - Criações usam o ID da operação como ID da linha: retry após falha de
 *   rede encontra a linha já inserida (conflito de unicidade = sucesso).
 * - Atualizações comparam `updated_at` do servidor com a base local:
 *   servidor mais novo = estado `conflict` com as duas versões visíveis.
 */

export type OpState = 'pending' | 'syncing' | 'synced' | 'conflict' | 'failed'

export type OpKind =
  | 'task.create'
  | 'reminder.create'
  | 'event.create'
  | 'tip.create'
  | 'gossip.create'
  | 'post.create'
  | 'task.update'
  | 'post.update'

export type OutboxOp = {
  id: string
  kind: OpKind
  household_id: string
  user_id: string
  target_id: string | null
  payload: Record<string, unknown>
  base_updated_at: string | null
  state: OpState
  attempts: number
  error: string | null
  server_snapshot: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export const MAX_ATTEMPTS = 5
const PRUNE_AFTER_MS = 7 * 24 * 60 * 60 * 1000

const TABLE_FOR_KIND: Record<OpKind, string> = {
  'task.create': 'tasks_fh',
  'reminder.create': 'reminders_fh',
  'event.create': 'events_fh',
  'tip.create': 'tips_fh',
  'gossip.create': 'gossip_fh',
  'post.create': 'posts_fh',
  'task.update': 'tasks_fh',
  'post.update': 'posts_fh',
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000_000)}`
}

export function newOp(
  kind: OpKind,
  householdId: string,
  userId: string,
  payload: Record<string, unknown>,
  targetId: string | null = null,
  baseUpdatedAt: string | null = null,
): OutboxOp {
  const now = new Date().toISOString()
  return {
    id: randomId(),
    kind,
    household_id: householdId,
    user_id: userId,
    target_id: targetId,
    payload,
    base_updated_at: baseUpdatedAt,
    state: 'pending',
    attempts: 0,
    error: null,
    server_snapshot: null,
    created_at: now,
    updated_at: now,
  }
}

/** Classifica erro de insert para decidir o próximo estado. */
export function classifyInsertError(message: string): 'duplicate' | 'denied' | 'fatal' {
  if (/duplicate key|unique constraint|already exists|conflict/i.test(message)) return 'duplicate'
  if (/row-level security|permission|policy|jwt|auth/i.test(message)) return 'denied'
  return 'fatal'
}

/** Há conflito se o servidor mudou depois da base local. */
export function detectUpdateConflict(baseUpdatedAt: string | null, serverUpdatedAt: string | null): boolean {
  if (!baseUpdatedAt || !serverUpdatedAt) return false
  return Date.parse(serverUpdatedAt) > Date.parse(baseUpdatedAt)
}

export function pendingCount(ops: OutboxOp[]): number {
  return ops.filter((op) => op.state === 'pending' || op.state === 'failed' || op.state === 'conflict').length
}

type OutboxStore = {
  ops: OutboxOp[]
  syncing: boolean
  enqueue: (op: OutboxOp) => void
  setOpState: (id: string, patch: Partial<OutboxOp>) => void
  removeOp: (id: string) => void
  clearAll: () => void
  prune: () => void
}

export const useOutbox = create<OutboxStore>()(
  persist(
    (set) => ({
      ops: [],
      syncing: false,
      enqueue: (op) => set((state) => ({ ops: [...state.ops, op] })),
      setOpState: (id, patch) =>
        set((state) => ({
          ops: state.ops.map((op) =>
            op.id === id ? { ...op, ...patch, updated_at: new Date().toISOString() } : op,
          ),
        })),
      removeOp: (id) => set((state) => ({ ops: state.ops.filter((op) => op.id !== id) })),
      clearAll: () => set({ ops: [], syncing: false }),
      prune: () =>
        set((state) => ({
          ops: state.ops.filter(
            (op) =>
              op.state !== 'synced' ||
              Date.now() - Date.parse(op.updated_at) < PRUNE_AFTER_MS,
          ),
        })),
    }),
    { name: 'fh.outbox.v1', partialize: (state) => ({ ops: state.ops }) as OutboxStore },
  ),
)

/** Executa uma operação contra o Supabase. Retorna o próximo estado + erro. */
export async function executeOp(
  supabase: SupabaseClient,
  op: OutboxOp,
): Promise<{ state: OpState; error: string | null; server?: Record<string, unknown> }> {
  const table = TABLE_FOR_KIND[op.kind]

  if (op.kind.endsWith('.create')) {
    const { error } = await supabase.from(table).insert({
      ...op.payload,
      id: op.id,
      household_id: op.household_id,
      created_by: op.user_id,
    })
    if (!error) return { state: 'synced', error: null }
    const kind = classifyInsertError(error.message)
    // Duplicata = outro retry já inseriu: idempotente, conta como sincronizado.
    if (kind === 'duplicate') return { state: 'synced', error: null }
    if (kind === 'denied') return { state: 'failed', error: error.message }
    return { state: op.attempts + 1 >= MAX_ATTEMPTS ? 'failed' : 'pending', error: error.message }
  }

  // update
  const targetId = op.target_id ?? (op.payload['id'] as string | undefined)
  if (!targetId) return { state: 'failed', error: 'Atualização sem id do registro.' }
  const { data: server, error: readError } = await supabase
    .from(table)
    .select('updated_at')
    .eq('id', targetId)
    .maybeSingle()
  if (readError) {
    return { state: op.attempts + 1 >= MAX_ATTEMPTS ? 'failed' : 'pending', error: readError.message }
  }
  const serverRow = server as { updated_at?: string } | null
  if (!serverRow) return { state: 'failed', error: 'Registro não existe mais no servidor.' }
  if (detectUpdateConflict(op.base_updated_at, serverRow.updated_at ?? null)) {
    const { data: full } = await supabase.from(table).select('*').eq('id', targetId).maybeSingle()
    return { state: 'conflict', error: null, server: (full ?? {}) as Record<string, unknown> }
  }
  const { id: _dropped, ...payload } = op.payload
  void _dropped
  const { error: updateError } = await supabase.from(table).update(payload).eq('id', targetId)
  if (updateError) {
    const kind = classifyInsertError(updateError.message)
    if (kind === 'denied') return { state: 'failed', error: updateError.message }
    return { state: op.attempts + 1 >= MAX_ATTEMPTS ? 'failed' : 'pending', error: updateError.message }
  }
  return { state: 'synced', error: null }
}

/** Sincroniza todas as pendentes em FIFO. Nunca lança exceção. */
export async function syncOutbox(supabase: SupabaseClient): Promise<{ synced: number; failed: number; conflicts: number }> {
  const store = useOutbox.getState()
  if (store.syncing) return { synced: 0, failed: 0, conflicts: 0 }
  useOutbox.setState({ syncing: true })

  let synced = 0
  let failed = 0
  let conflicts = 0

  try {
    const queue = useOutbox
      .getState()
      .ops.filter((op) => op.state === 'pending')
      .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))

    for (const op of queue) {
      useOutbox.getState().setOpState(op.id, { state: 'syncing', attempts: op.attempts + 1, error: null })
      const current = useOutbox.getState().ops.find((o) => o.id === op.id)
      if (!current) continue
      try {
        const result = await executeOp(supabase, { ...current, attempts: current.attempts })
        useOutbox.getState().setOpState(op.id, {
          state: result.state,
          error: result.error,
          server_snapshot: result.server ?? null,
        })
        if (result.state === 'synced') synced += 1
        else if (result.state === 'conflict') conflicts += 1
        else if (result.state === 'failed') failed += 1
      } catch (error) {
        useOutbox.getState().setOpState(op.id, {
          state: current.attempts + 1 >= MAX_ATTEMPTS ? 'failed' : 'pending',
          error: error instanceof Error ? error.message : String(error),
        })
        failed += 1
      }
    }
    useOutbox.getState().prune()
  } finally {
    useOutbox.setState({ syncing: false })
  }

  return { synced, failed, conflicts }
}

/** Resolução de conflito: 'mine' força a atualização; 'theirs' descarta a op local. */
export async function resolveConflict(
  supabase: SupabaseClient,
  opId: string,
  choice: 'mine' | 'theirs',
): Promise<{ error: string | null }> {
  const op = useOutbox.getState().ops.find((o) => o.id === opId)
  if (!op || op.state !== 'conflict') return { error: 'Operação não está em conflito.' }
  if (choice === 'theirs') {
    useOutbox.getState().removeOp(opId)
    return { error: null }
  }
  const table = TABLE_FOR_KIND[op.kind]
  const targetId = op.target_id ?? (op.payload['id'] as string | undefined)
  if (!targetId) return { error: 'Atualização sem id do registro.' }
  const { id: _dropped, ...payload } = op.payload
  void _dropped
  const { error } = await supabase.from(table).update(payload).eq('id', targetId)
  if (error) {
    useOutbox.getState().setOpState(opId, { state: 'failed', error: error.message })
    return { error: error.message }
  }
  useOutbox.getState().removeOp(opId)
  return { error: null }
}
