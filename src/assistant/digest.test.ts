import { describe, expect, it } from 'vitest'
import { buildDigest } from './digest'

describe('buildDigest', () => {
  it('monta o payload com metadados e sem segredos', () => {
    const payload = buildDigest(
      {
        date: '2026-10-14',
        tasksOpen: 3,
        tasksOverdue: [{ title: 'Conta', dueAt: '2026-10-13' }],
        eventsToday: [],
        remindersToday: [],
        finance: { incomeMinor: 10000, expenseMinor: 3000, pending: 2, overdue: 1, currency: 'EUR' },
        moods: [{ user: 'u1', mood: 'feliz' }],
        unreadNotifications: 1,
      },
      Date.parse('2026-10-14T08:00:00Z'),
    )
    expect(payload.generated_at).toBe('2026-10-14T08:00:00.000Z')
    expect(payload.source).toBe('financial-home-102026')
    expect(JSON.stringify(payload)).not.toMatch(/gsk_|Bearer|password|secret/i)
  })
})
