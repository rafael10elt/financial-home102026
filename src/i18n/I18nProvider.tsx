import { useCallback, useMemo, type ReactNode } from 'react'
import type { TranslationKey } from './pt-BR'
import { translate, type TranslateParams } from './translate'
import { I18nContext, type I18nValue } from './context'
import { usePreferences } from '../preferences/store'

export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = usePreferences((state) => state.locale)

  const t = useCallback(
    (key: TranslationKey, params?: TranslateParams) => translate(locale, key, params),
    [locale],
  )

  const value = useMemo<I18nValue>(() => ({ locale, t }), [locale, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
