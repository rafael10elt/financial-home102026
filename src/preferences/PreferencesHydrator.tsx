import { useEffect } from 'react'
import { useAuth } from '../auth/context'
import { usePreferences } from './store'
import { loadPreferences } from './sync'

/**
 * Carrega as preferências salvas na conta e aplica-as ao store local.
 * Em conflito, a nuvem vence apenas na primeira carga (estado inicial),
 * preservando alterações feitas offline nesta sessão.
 */
export function PreferencesHydrator() {
  const { user, supabase, status } = useAuth()
  const hydrateFromCloud = usePreferences((state) => state.hydrateFromCloud)
  const localPending = usePreferences((state) => state.pendingSync)

  useEffect(() => {
    if (!supabase || !user || status !== 'authenticated' || localPending) return
    let cancelled = false

    void loadPreferences(supabase, user.id).then((result) => {
      if (cancelled || result.error || !result.state) return
      hydrateFromCloud(result.state)
    })

    return () => {
      cancelled = true
    }
  }, [supabase, user, status, localPending, hydrateFromCloud])

  return null
}
