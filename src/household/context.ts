import { createContext, useContext } from 'react'
import type { HouseholdState } from './service'

export type HouseholdContextValue = {
  state: HouseholdState
  refresh: () => Promise<void>
  createHousehold: (name: string) => Promise<{ error: string | null }>
  joinHousehold: (code: string) => Promise<{ error: string | null }>
}

export const HouseholdContext = createContext<HouseholdContextValue | null>(null)

export function useHousehold(): HouseholdContextValue {
  const context = useContext(HouseholdContext)
  if (!context) throw new Error('useHousehold deve ser usado dentro de HouseholdProvider')
  return context
}
