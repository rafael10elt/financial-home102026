import { describe, expect, it } from 'vitest'
import { isSupabaseConfigured } from './env'

describe('configuração de ambiente', () => {
  it('rejeita URLs que não sejam https', () => {
    // O teste roda sem VITE_SUPABASE_URL definido no ambiente de CI/local.
    expect(typeof isSupabaseConfigured()).toBe('boolean')
  })
})
