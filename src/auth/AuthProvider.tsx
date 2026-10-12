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
        await supabase.auth.signOut()
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
        if (key.startsWith('fh.') && key !== 'fh.preferences') localStorage.removeItem(key)
      }
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
    }),
    [status, session, supabase, signIn, signUp, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
