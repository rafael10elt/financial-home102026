import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env, isSupabaseConfigured } from '../config/env'

let client: SupabaseClient | null = null

/**
 * Retorna o cliente Supabase ou `null` quando o ambiente não está configurado.
 * A UI deve mostrar o estado real de "não configurado" em vez de simular acesso.
 */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return client
}
