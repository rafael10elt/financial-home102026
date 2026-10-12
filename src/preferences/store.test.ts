import { describe, expect, it } from 'vitest'
import { mergePreferences, defaultPreferences } from './store'

describe('mergePreferences', () => {
  it('usa padrões quando não há nada persistido', () => {
    expect(mergePreferences(undefined, undefined)).toEqual({
      ...defaultPreferences,
      pendingSync: false,
    })
  })

  it('descarta valores inválidos', () => {
    const result = mergePreferences(
      { theme: 'neon', fontScale: 'huge', locale: 'fr' },
      { theme: 'dark', fontScale: 'lg', locale: 'en' },
    )
    expect(result).toEqual({
      theme: 'dark',
      fontScale: 'lg',
      locale: 'en',
      pendingSync: false,
    })
  })

  it('preserva pendência de sincronização', () => {
    const result = mergePreferences({ theme: 'dark', pendingSync: true }, undefined)
    expect(result.pendingSync).toBe(true)
    expect(result.theme).toBe('dark')
  })
})
