import { describe, expect, it } from 'vitest'
import { buildDueNotifications, type DueItem } from './dueNotifications'

const NOW = Date.parse('2026-10-14T12:00:00Z')

function item(partial: Partial<DueItem> & { id: string }): DueItem {
  return { kind: 'task', title: 'Item', dueAt: null, done: false, ...partial }
}

describe('buildDueNotifications', () => {
  it('gera aviso para vencimento dentro da antecedência', () => {
    const drafts = buildDueNotifications(
      [item({ id: 'a', title: 'Pagar conta', dueAt: '2026-10-14T18:00:00Z' })],
      NOW,
      24,
    )
    expect(drafts).toHaveLength(1)
    expect(drafts[0]?.type).toBe('due_soon')
    expect(drafts[0]?.dedupe_key).toBe('task:a:2026-10-14:soon')
  })

  it('ignora vencimento fora da antecedência', () => {
    const drafts = buildDueNotifications(
      [item({ id: 'a', dueAt: '2026-10-20T18:00:00Z' })],
      NOW,
      24,
    )
    expect(drafts).toEqual([])
  })

  it('gera aviso de atraso para vencidos recentes', () => {
    const drafts = buildDueNotifications(
      [item({ id: 'b', dueAt: '2026-10-13T09:00:00Z' })],
      NOW,
      24,
    )
    expect(drafts).toHaveLength(1)
    expect(drafts[0]?.type).toBe('task_overdue')
  })

  it('ignora atrasos antigos (fora da janela de 7 dias)', () => {
    const drafts = buildDueNotifications(
      [item({ id: 'c', dueAt: '2026-09-01T09:00:00Z' })],
      NOW,
      24,
    )
    expect(drafts).toEqual([])
  })

  it('ignora concluídos e itens sem data', () => {
    const drafts = buildDueNotifications(
      [
        item({ id: 'd', dueAt: '2026-10-14T13:00:00Z', done: true }),
        item({ id: 'e', dueAt: null }),
        item({ id: 'f', dueAt: 'não-é-data' }),
      ],
      NOW,
      24,
    )
    expect(drafts).toEqual([])
  })

  it('é determinístico: mesma entrada gera as mesmas chaves', () => {
    const items = [item({ id: 'a', dueAt: '2026-10-14T18:00:00Z' })]
    const first = buildDueNotifications(items, NOW, 24)
    const second = buildDueNotifications(items, NOW, 24)
    expect(second).toEqual(first)
  })
})
