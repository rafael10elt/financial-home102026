import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSupabase } from '../supabase/client'
import { AuthContext, type AuthContextValue, type AuthStatus } from './context'

function mapAuthError(error: { message: string } | null): string | null {
  if (!error) return null
  const message = error.message.trim()
  if (/invalid login credentials/i.test(message)) return 'Credenciais inválidas.'
  if (/email not confirmed/i.test(message)) return 'E-mail ainda não confirmado.'
  if (/already registered/i.test(message)) return 'Este e-mail já está cadastrado.'
  if (/password should be at least/i.test(message)) return 'A senha é muito curta.'
  if (/rate limit/i.test(message)) return 'Muitas tentativas. Aguarde alguns minutos.'
  return message
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabase()
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<AuthStatus>(supabase ? 'loading' : 'unconfigured')
  const [profileName, setProfileName] = useState<string | null>(() => localStorage.getItem('fh.active-profile'))
  const initialized = useRef(false)

  useEffect(() => {
    if (!supabase) return
    let cancelled = false

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return
        setSession(data.session)
        setStatus(data.session ? 'authenticated' : 'anonymous')
      })
      .catch(() => {
        if (!cancelled) setStatus('anonymous')
      })
      .finally(() => {
        initialized.current = true
      })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setStatus(nextSession ? 'authenticated' : 'anonymous')
      const active = localStorage.getItem('fh.active-profile')
      if (active && nextSession) {
        localStorage.setItem(`fh.auth.profile.${active.toLocaleLowerCase('pt-BR')}`, JSON.stringify(nextSession))
      }
    })

    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
  }, [supabase])

  const signIn = useCallback<AuthContextValue['signIn']>(
    async (email, password) => {
      if (!supabase) return { error: 'Supabase não configurado.' }
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return { error: mapAuthError(error) }
    },
    [supabase],
  )

  const selectProfile = useCallback<AuthContextValue['selectProfile']>(async (name) => {
    if (!supabase) return { error: 'Supabase não configurado.' }
    const normalized = name.trim()
    if (!normalized) return { error: 'Escolha um perfil válido.' }
    try {
      // Cada perfil mantém uma sessão anônima própria neste navegador. Assim,
      // o banco continua recebendo um auth.uid() diferente por pessoa.
      const storageKey = `fh.auth.profile.${normalized.toLocaleLowerCase('pt-BR')}`
      localStorage.setItem('fh.active-profile', normalized)
      setProfileName(normalized)
      const cached = localStorage.getItem(storageKey)
      if (cached) {
        const previous = JSON.parse(cached) as Session
        const { error } = await supabase.auth.setSession({
          access_token: previous.access_token,
          refresh_token: previous.refresh_token,
        })
        if (!error) {
          localStorage.setItem('fh.active-profile', normalized)
          setProfileName(normalized)
          return { error: null }
        }
        localStorage.removeItem(storageKey)
      }
      // Remove a sessão ativa somente deste navegador; revogar no servidor
      // invalidaria a sessão guardada para a troca posterior deste perfil.
      await supabase.auth.signOut({ scope: 'local' })
      const { data, error } = await supabase.auth.signInAnonymously({
        options: { data: { display_name: normalized } },
      })
      if (error || !data.session) return { error: mapAuthError(error) ?? 'Não foi possível iniciar a sessão.' }
      await supabase.auth.updateUser({ data: { display_name: normalized } })
      localStorage.setItem(storageKey, JSON.stringify(data.session))
      localStorage.setItem('fh.active-profile', normalized)
      setProfileName(normalized)
      return { error: null }
    } catch {
      return { error: 'Não foi possível selecionar esse perfil neste navegador.' }
    }
  }, [supabase])

  const signUp = useCallback<AuthContextValue['signUp']>(
    async (email, password, displayName) => {
      if (!supabase) return { error: 'Supabase não configurado.' }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      })
      const mapped = mapAuthError(error)
      if (mapped) return { error: mapped }
      // Sem sessão quando a confirmação de e-mail está ativa no Supabase.
      if (data.session) return { error: null }
      return { error: 'Conta criada. Confirme o e-mail antes de entrar.' }
    },
    [supabase],
  )

  const signOut = useCallback(async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut({ scope: 'local' })
      } catch {
        // Sessão local já removida; não há o que fazer além de seguir.
      }
    }
    setSession(null)
    setStatus('anonymous')
    // Limpa caches privados e dados locais não persistentes no logout.
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration()
        await registration?.update()
        navigator.serviceWorker.controller?.postMessage('fh:clear-private')
      }
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('fh.') && key !== 'fh.preferences' && !key.startsWith('fh.auth.profile.')) localStorage.removeItem(key)
      }
      localStorage.removeItem('fh.active-profile')
      sessionStorage.clear()
    } catch {
      // Armazenamento indisponível (modo privado etc.): nada a limpar.
    }
  }, [supabase])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      supabase,
      signIn,
      signUp,
      signOut,
      selectProfile,
      profileName,
    }),
    [status, session, supabase, signIn, signUp, signOut, selectProfile, profileName],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
