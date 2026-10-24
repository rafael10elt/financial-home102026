import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { activateProfile, getSupabase } from '../supabase/client'
import { AuthContext, type AuthContextValue, type AuthStatus, type LocalProfile } from './context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabase()
  const savedId = localStorage.getItem('fh.active-profile-id')
  const [user, setUser] = useState<LocalProfile | null>(null)
  const [status, setStatus] = useState<AuthStatus>(supabase ? (savedId ? 'loading' : 'anonymous') : 'unconfigured')
  const [profileName, setProfileName] = useState<string | null>(() => localStorage.getItem('fh.active-profile'))

  useEffect(() => {
    if (!supabase || !savedId) return
    let cancelled = false
    void supabase.from('profiles_fh').select('id, display_name').eq('id', savedId).maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          activateProfile(null)
          localStorage.removeItem('fh.active-profile')
          setProfileName(null)
          setStatus('anonymous')
          return
        }
        const profile: LocalProfile = {
          id: data.id,
          email: null,
          user_metadata: { display_name: data.display_name },
        }
        setUser(profile)
        setProfileName(data.display_name)
        localStorage.setItem('fh.active-profile', data.display_name)
        setStatus('authenticated')
      })
    return () => { cancelled = true }
  }, [supabase, savedId])

  const selectProfile = useCallback<AuthContextValue['selectProfile']>(async (name) => {
    if (!supabase) return { error: 'Supabase não configurado.' }
    const normalized = name.trim()
    if (!normalized) return { error: 'Escolha um perfil.' }
    const { data, error } = await supabase
      .from('profiles_fh')
      .select('id, display_name')
      .eq('display_name', normalized)
      .maybeSingle()
    if (error) return { error: `Não foi possível consultar o perfil: ${error.message}` }
    if (!data) return { error: `O perfil “${normalized}” não existe em profiles_fh. Confira os perfis iniciais no banco.sql.` }

    activateProfile(data.id)
    localStorage.setItem('fh.active-profile', data.display_name)
    setUser({ id: data.id, email: null, user_metadata: { display_name: data.display_name } })
    setProfileName(data.display_name)
    setStatus('authenticated')
    return { error: null }
  }, [supabase])

  const signOut = useCallback(async () => {
    activateProfile(null)
    setUser(null)
    setProfileName(null)
    setStatus('anonymous')
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration()
        await registration?.update()
        navigator.serviceWorker.controller?.postMessage('fh:clear-private')
      }
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('fh.') && key !== 'fh.preferences') localStorage.removeItem(key)
      }
      sessionStorage.clear()
    } catch {
      // Armazenamento indisponível: segue sem cache local.
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, supabase, signOut, selectProfile, profileName }),
    [status, user, supabase, signOut, selectProfile, profileName],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
