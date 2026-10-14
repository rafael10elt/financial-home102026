import { describe, expect, it } from 'vitest'
import { mapBackendError, toolInfo, validateToolArgs, TOOL_CATALOG } from './tools'

describe('tool catalog', () => {
  it('marca exatamente as tools financeiras destrutivas como sensíveis', () => {
    const sensitive = TOOL_CATALOG.filter((tool) => tool.sensitive).map((tool) => tool.name)
    expect(sensitive).toEqual(['finance_transaction_update', 'finance_transaction_delete'])
  })

  it('criação financeira NÃO é sensível (sempre nasce pendente)', () => {
    expect(toolInfo('finance_transaction_create')?.sensitive).toBe(false)
  })

  it('valida campos obrigatórios', () => {
    expect(validateToolArgs('task_create', { title: 'X' })).toBeNull()
    expect(validateToolArgs('task_create', {})).toContain('title')
    expect(validateToolArgs('nope', {})).toContain('desconhecida')
  })

  it('mapeia erros do backend para estados de UI', () => {
    expect(mapBackendError('NO_KEY')).toBe('no-key')
    expect(mapBackendError('INVALID_KEY')).toBe('invalid')
    expect(mapBackendError('QUOTA_EXCEEDED')).toBe('quota')
    expect(mapBackendError('MODEL_NOT_SUPPORTED')).toBe('model')
    expect(mapBackendError('GROQ_UNAVAILABLE')).toBe('unavailable')
    expect(mapBackendError('BOGUS')).toBe('unknown')
  })
})
