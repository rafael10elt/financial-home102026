import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Locale } from '../i18n'

export type ThemeSetting = 'light' | 'dark' | 'system'
export type FontScale = 'sm' | 'md' | 'lg' | 'xl'

export type PreferencesState = {
  theme: ThemeSetting
  fontScale: FontScale
  locale: Locale
}

export type PreferencesStore = PreferencesState & {
  /** Representa alteraÃ§Ãµes ainda nÃ£o confirmadas pelo backend. */
  pendingSync: boolean
  set: (patch: Partial<PreferencesState>) => void
  /** Aplica preferÃªncias vindas do banco sem marcar pendÃªncia. */
  hydrateFromCloud: (state: Partial<PreferencesState>) => void
  markSynced: () => void
  markSyncFailed: () => void
}

export const defaultPreferences: PreferencesState = {
  theme: 'system',
  fontScale: 'md',
  locale: 'pt-BR',
}

export const mergePreferences = (
  persisted: unknown,
  incoming: unknown,
): PreferencesState & { pendingSync: boolean } => {
  const base = { ...defaultPreferences, pendingSync: false }
  const pick = (source: unknown): Partial<PreferencesState & { pendingSync: boolean }> => {
    if (!source || typeof source !== 'object') return {}
    const record = source as Record<string, unknown>
    const result: Partial<PreferencesState & { pendingSync: boolean }> = {}
    if (record.theme === 'light' || record.theme === 'dark' || record.theme === 'system') {
      result.theme = record.theme
    }
    if (record.fontScale === 'sm' || record.fontScale === 'md' || record.fontScale === 'lg' || record.fontScale === 'xl') {
      result.fontScale = record.fontScale
    }
    if (record.locale === 'pt-BR' || record.locale === 'en') result.locale = record.locale
    if (typeof record.pendingSync === 'boolean') result.pendingSync = record.pendingSync
    return result
  }
  return { ...base, ...pick(persisted), ...pick(incoming) }
}

function applyDom(state: PreferencesState): void {
  const root = document.documentElement
  const resolved =
    state.theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : state.theme
  root.dataset.theme = resolved
  const sizes: Record<FontScale, string> = { sm: '14px', md: '16px', lg: '18px', xl: '20px' }
  root.style.fontSize = sizes[state.fontScale]
  root.lang = state.locale
}

export const usePreferences = create<PreferencesStore>()(
  persist(
    (set, get) => ({
      ...defaultPreferences,
      pendingSync: false,
      set: (patch) => {
        const next = resolveState(get(), patch)
        set({ ...patch, pendingSync: true })
        applyDom(next)
      },
      hydrateFromCloud: (state) => {
        const next = resolveState(get(), state)
        set({ ...state, pendingSync: false })
        applyDom(next)
      },
      markSynced: () => set({ pendingSync: false }),
      markSyncFailed: () => set({ pendingSync: true }),
    }),
    {
      name: 'fh.preferences',
      partialize: (store) => ({
        theme: store.theme,
        fontScale: store.fontScale,
        locale: store.locale,
        pendingSync: store.pendingSync,
      }),
      merge: (persisted, current) => {
        const merged = mergePreferences(persisted, current)
        const store = { ...current, ...merged } as PreferencesStore
        queueMicrotask(() => applyDom(store))
        return store
      },
    },
  ),
)

function pickState(source: Partial<PreferencesState>): Partial<PreferencesState> {
  const result: Partial<PreferencesState> = {}
  if (source.theme !== undefined) result.theme = source.theme
  if (source.fontScale !== undefined) result.fontScale = source.fontScale
  if (source.locale !== undefined) result.locale = source.locale
  return result
}

function resolveState(
  base: PreferencesState,
  patch: Partial<PreferencesState>,
): PreferencesState {
  return { ...base, ...pickState(patch) }
}

export function applyPreferencesToDom(state: PreferencesState): void {
  applyDom(state)
}
