import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env, isSupabaseConfigured } from '../config/env'

let client: SupabaseClient | null = null

/** Seleciona o perfil de uso local; não cria nem mantém uma sessão Supabase Auth. */
export function activateProfile(profileId: string | null): void {
  if (profileId) localStorage.setItem('fh.active-profile-id', profileId)
  else localStorage.removeItem('fh.active-profile-id')
  client = null
}

/**
 * Retorna o cliente Supabase ou `null` quando o ambiente não está configurado.
 * A UI deve mostrar o estado real de "não configurado" em vez de simular acesso.
 */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      global: {
        headers: localStorage.getItem('fh.active-profile-id')
          ? { 'x-profile-id': localStorage.getItem('fh.active-profile-id')! }
          : {},
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  }
  return client
}

/** Cliente temporário para carregar avatar do perfil escolhido antes do login local. */
export function getSupabaseForProfile(profileId: string): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    global: { headers: { 'x-profile-id': profileId } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
