import { createContext, useContext } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

export type LocalProfile = {
  id: string
  email: string | null
  user_metadata: { display_name: string }
}

export type AuthStatus = 'unconfigured' | 'loading' | 'authenticated' | 'anonymous'

export type AuthContextValue = {
  status: AuthStatus
  user: LocalProfile | null
  supabase: SupabaseClient | null
  signOut: () => Promise<void>
  selectProfile: (name: string) => Promise<{ error: string | null }>
  profileName: string | null
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return context
}
