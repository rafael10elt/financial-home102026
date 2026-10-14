import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  classifyInsertError,
  detectUpdateConflict,
  executeOp,
  newOp,
  pendingCount,
  resolveConflict,
  syncOutbox,
  useOutbox,
  type OutboxOp,
} from './outbox'

function op(partial: Partial<OutboxOp> = {}): OutboxOp {
  return {
    id: 'op-1',
    kind: 'task.create',
    household_id: 'house-1',
    user_id: 'user-1',
    target_id: null,
    payload: { title: 'Teste' },
    base_updated_at: null,
    state: 'pending',
    attempts: 0,
    error: null,
    server_snapshot: null,
    created_at: '2026-10-14T10:00:00Z',
    updated_at: '2026-10-14T10:00:00Z',
    ...partial,
  }
}

function mockClient(behavior: {
  insert?: { error: { message: string } | null }
  selectRow?: unknown
  selectError?: { message: string } | null
  update?: { error: { message: string } | null }
  delete?: { error: { message: string } | null }
}) {
  const chain = {
    insert: vi.fn().mockResolvedValue(behavior.insert ?? { error: null }),
    update: vi
      .fn()
      .mockReturnValue({ eq: vi.fn().mockResolvedValue(behavior.update ?? { error: null }) }),
    delete: vi.fn().mockResolvedValue(behavior.delete ?? { error: null }),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: behavior.selectRow ?? null, error: behavior.selectError ?? null }),
  }
  return { from: vi.fn().mockReturnValue(chain), __chain: chain } as unknown as Parameters<typeof executeOp>[0]
}

describe('classifyInsertError', () => {
  it('duplicata conta como sucesso idempotente', () => {
    expect(classifyInsertError('duplicate key value violates unique constraint')).toBe('duplicate')
  })
  it('RLS negado é falha definitiva', () => {
    expect(classifyInsertError('new row violates row-level security policy')).toBe('denied')
  })
  it('erro de rede/validação volta para a fila', () => {
    expect(classifyInsertError('network timeout')).toBe('fatal')
  })
})

describe('detectUpdateConflict', () => {
  it('servidor mais novo = conflito', () => {
    expect(detectUpdateConflict('2026-10-14T10:00:00Z', '2026-10-14T11:00:00Z')).toBe(true)
    expect(detectUpdateConflict('2026-10-14T11:00:00Z', '2026-10-14T10:00:00Z')).toBe(false)
    expect(detectUpdateConflict(null, '2026-10-14T10:00:00Z')).toBe(false)
  })
})

describe('executeOp', () => {
  it('create com sucesso sincroniza', async () => {
    const result = await executeOp(mockClient({}), op())
    expect(result.state).toBe('synced')
  })

  it('create duplicado (retry) sincroniza sem duplicar', async () => {
    const result = await executeOp(
      mockClient({ insert: { error: { message: 'duplicate key value' } } }),
      op(),
    )
    expect(result.state).toBe('synced')
  })

  it('create negado pelo RLS falha com mensagem', async () => {
    const result = await executeOp(
      mockClient({ insert: { error: { message: 'row-level security' } } }),
      op(),
    )
    expect(result.state).toBe('failed')
  })

  it('update com servidor mais novo gera conflito explícito', async () => {
    const client = mockClient({ selectRow: { updated_at: '2026-10-14T12:00:00Z' } })
    const result = await executeOp(
      client,
      op({ kind: 'task.update', target_id: 'task-1', base_updated_at: '2026-10-14T10:00:00Z' }),
    )
    expect(result.state).toBe('conflict')
  })

  it('update sem mudança no servidor sincroniza', async () => {
    const client = mockClient({ selectRow: { updated_at: '2026-10-14T10:00:00Z' } })
    const result = await executeOp(
      client,
      op({ kind: 'task.update', target_id: 'task-1', base_updated_at: '2026-10-14T10:00:00Z' }),
    )
    expect(result.state).toBe('synced')
  })
})

describe('store', () => {
  beforeEach(() => {
    useOutbox.setState({ ops: [], syncing: false })
    localStorage.clear()
  })

  it('enfileira, conta pendentes e sincroniza a fila', async () => {
    const store = useOutbox.getState()
    store.enqueue(newOp('task.create', 'house-1', 'user-1', { title: 'A' }))
    store.enqueue(newOp('reminder.create', 'house-1', 'user-1', { title: 'B' }))
    expect(pendingCount(useOutbox.getState().ops)).toBe(2)

    const summary = await syncOutbox(mockClient({}))
    expect(summary).toEqual({ synced: 2, failed: 0, conflicts: 0 })
    expect(pendingCount(useOutbox.getState().ops)).toBe(0)
  })

  it('resolve conflito ficando com a versão do servidor', async () => {
    useOutbox.setState({
      ops: [
        op({
          id: 'c1',
          kind: 'task.update',
          target_id: 'task-9',
          state: 'conflict',
          server_snapshot: { title: 'Servidor' },
        }),
      ],
      syncing: false,
    })
    const result = await resolveConflict(mockClient({}), 'c1', 'theirs')
    expect(result.error).toBeNull()
    expect(useOutbox.getState().ops).toHaveLength(0)
  })
})
