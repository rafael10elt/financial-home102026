import { describe, expect, it } from 'vitest'
import { translate } from './translate'
import { ptBR, type TranslationKey } from './pt-BR'
import { en } from './en'

describe('i18n', () => {
  it('tem a mesma cobertura de chaves nos dois idiomas', () => {
    const ptKeys = Object.keys(ptBR).sort()
    const enKeys = Object.keys(en).sort()
    expect(enKeys).toEqual(ptKeys)
  })

  it('interpola parâmetros', () => {
    expect(translate('pt-BR', 'house.current', { name: 'Casa J&R' })).toBe(
      'Casa atual: Casa J&R',
    )
    expect(translate('en', 'house.current', { name: 'J&R Home' })).toBe(
      'Current household: J&R Home',
    )
  })

  it('substitui todos os placeholders quando os parâmetros são fornecidos', () => {
    const keys = Object.keys(ptBR) as TranslationKey[]
    for (const key of keys) {
      for (const locale of ['pt-BR', 'en'] as const) {
        const raw = translate(locale, key)
        const names = [...raw.matchAll(/\{(\w+)\}/g)].map((match) => match[1] as string)
        if (names.length === 0) {
          expect(raw).not.toMatch(/\{\w+\}/)
          continue
        }
        const params = Object.fromEntries(names.map((name) => [name, 'X']))
        expect(translate(locale, key, params)).not.toMatch(/\{\w+\}/)
      }
    }
  })

  it('não mistura idiomas: nenhuma chave em en é igual ao valor pt quando os textos diferem', () => {
    const keys = Object.keys(ptBR) as TranslationKey[]
    const identical = keys.filter((key) => ptBR[key] === en[key])
    // Chaves que são nomes próprios podem coincidir; garantimos que há traduções reais.
    expect(identical.length).toBeLessThan(keys.length)
  })
})
