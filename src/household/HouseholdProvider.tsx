import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/context'
import { HouseholdContext, type HouseholdContextValue } from './context'
import {
  createHousehold as createHouseholdRequest,
  fetchHousehold,
  fetchMembers,
  joinHousehold as joinHouseholdRequest,
  type HouseholdState,
} from './service'

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { supabase, user, status } = useAuth()
  const [state, setState] = useState<HouseholdState>({ kind: 'none' })
  const requestId = useRef(0)

  const refresh = useCallback(async (): Promise<{ found: boolean; error: string | null }> => {
    if (!supabase || !user) {
      requestId.current += 1
      setState({ kind: 'none' })
      return { found: false, error: null }
    }
    const current = ++requestId.current
    setState({ kind: 'loading' })

    const { data: household, error } = await fetchHousehold(supabase, user.id)
    if (current !== requestId.current) return { found: false, error: 'A consulta foi substituída por uma sessão mais recente.' }

    if (error || !household) {
      if (error) {
        setState({ kind: 'error', message: error })
        return { found: false, error }
      }
      setState({ kind: 'none' })
      return { found: false, error: null }
    }

    const { data: members, error: membersError } = await fetchMembers(supabase, household.id)
    if (current !== requestId.current) return { found: false, error: 'A consulta foi substituída por uma sessão mais recente.' }

    setState({
      kind: 'ready',
      household,
      members: membersError ? [] : members,
      joinCodeVisible: household.created_by === user.id,
    })
    return { found: true, error: null }
  }, [supabase, user])

  useEffect(() => {
    if (status === 'authenticated' || status === 'anonymous') {
      // Deferido para fora do corpo síncrono do efeito (regra react-hooks).
      queueMicrotask(() => {
        void refresh()
      })
      return
    }
    if (status === 'unconfigured') queueMicrotask(() => setState({ kind: 'none' }))
  }, [status, refresh])

  const createHousehold = useCallback<HouseholdContextValue['createHousehold']>(
    async (name) => {
      if (!supabase) return { error: 'Supabase não configurado.' }
      const { error } = await createHouseholdRequest(supabase, name.trim())
      if (error) return { error }
      const result = await refresh()
      if (result.error) return { error: `A casa foi criada, mas não foi possível confirmar o vínculo: ${result.error}` }
      if (!result.found) return { error: 'A casa foi criada, mas não apareceu na consulta ao banco. Atualize a tela e confira o vínculo do perfil.' }
      return { error: null }
    },
    [supabase, refresh],
  )

  const joinHousehold = useCallback<HouseholdContextValue['joinHousehold']>(
    async (code) => {
      if (!supabase) return { error: 'Supabase não configurado.' }
      const { error } = await joinHouseholdRequest(supabase, code.trim().toUpperCase())
      if (error) return { error }
      const result = await refresh()
      if (result.error) return { error: `O código foi aceito, mas não foi possível confirmar a casa: ${result.error}` }
      if (!result.found) return { error: 'O código foi aceito, mas a casa não apareceu na consulta ao banco.' }
      return { error: null }
    },
    [supabase, refresh],
  )

  const value = useMemo<HouseholdContextValue>(
    () => ({ state, refresh, createHousehold, joinHousehold }),
    [state, refresh, createHousehold, joinHousehold],
  )

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>
}
