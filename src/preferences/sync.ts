import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabase } from '../supabase/client'
import type { PreferencesState } from './store'

/**
 * Persiste preferências pessoais na tabela `user_settings_fh`.
 * Preferências são pessoais: gravam-se por usuário, nunca compartilhadas.
 */
export async function syncPreferences(
  userId: string,
  state: PreferencesState,
): Promise<{ error: string | null }> {
  const supabase: SupabaseClient | null = getSupabase()
  if (!supabase) return { error: 'Supabase não configurado.' }

  const { error } = await supabase.from('user_settings_fh').upsert(
    {
      user_id: userId,
      preferences: state,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )

  if (error) return { error: error.message }
  return { error: null }
}

export async function loadPreferences(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ state: Partial<PreferencesState> | null; error: string | null }> {
  const { data, error } = await supabase
    .from('user_settings_fh')
    .select('preferences')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) return { state: null, error: error.message }
  const preferences = data?.preferences
  if (!preferences || typeof preferences !== 'object') return { state: null, error: null }
  return { state: preferences as Partial<PreferencesState>, error: null }
}
