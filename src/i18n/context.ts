import { createContext, useContext } from 'react'
import type { TranslationKey } from './pt-BR'
import type { Locale, TranslateParams } from './translate'

export type { Locale } from './translate'

export type I18nValue = {
  locale: Locale
  t: (key: TranslationKey, params?: TranslateParams) => string
}

export const I18nContext = createContext<I18nValue | null>(null)

export function useI18n(): I18nValue {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n deve ser usado dentro de I18nProvider')
  return context
}
