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

  const refresh = useCallback(async () => {
    if (!supabase || !user) {
      setState({ kind: 'none' })
      return
    }
    const current = ++requestId.current
    setState({ kind: 'loading' })

    const { data: household, error } = await fetchHousehold(supabase, user.id)
    if (current !== requestId.current) return

    if (error || !household) {
      setState({ kind: 'none' })
      return
    }

    const { data: members, error: membersError } = await fetchMembers(supabase, household.id)
    if (current !== requestId.current) return

    setState({
      kind: 'ready',
      household,
      members: membersError ? [] : members,
      joinCodeVisible: household.created_by === user.id,
    })
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
      if (!error) await refresh()
      return { error }
    },
    [supabase, refresh],
  )

  const joinHousehold = useCallback<HouseholdContextValue['joinHousehold']>(
    async (code) => {
      if (!supabase) return { error: 'Supabase não configurado.' }
      const { error } = await joinHouseholdRequest(supabase, code.trim().toUpperCase())
      if (!error) await refresh()
      return { error }
    },
    [supabase, refresh],
  )

  const value = useMemo<HouseholdContextValue>(
    () => ({ state, refresh, createHousehold, joinHousehold }),
    [state, refresh, createHousehold, joinHousehold],
  )

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>
}
