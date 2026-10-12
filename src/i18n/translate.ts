import { ptBR, type TranslationKey } from './pt-BR'
import { en } from './en'

export type Locale = 'pt-BR' | 'en'

const dictionaries: Record<Locale, Record<TranslationKey, string>> = {
  'pt-BR': ptBR,
  en,
}

export type TranslateParams = Record<string, string | number>

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  )
}

export function translate(locale: Locale, key: TranslationKey, params?: TranslateParams): string {
  const dictionary = dictionaries[locale] ?? dictionaries['pt-BR']
  const template = dictionary[key] ?? ptBR[key]
  if (template === undefined) {
    if (import.meta.env.DEV) console.warn(`[i18n] chave ausente: ${key}`)
    return key
  }
  return interpolate(template, params)
}
