/**
 * Acesso tipado às variáveis de ambiente.
 * Somente variáveis públicas (prefixo VITE_) chegam ao bundle.
 * Nenhum segredo pode ser declarado aqui.
 */
const raw = import.meta.env

export const env = {
  supabaseUrl: (raw.VITE_SUPABASE_URL ?? '').trim(),
  supabaseAnonKey: (raw.VITE_SUPABASE_ANON_KEY ?? '').trim(),
} as const

export function isSupabaseConfigured(): boolean {
  return (
    env.supabaseUrl.startsWith('https://') &&
    env.supabaseUrl.length > 'https://'.length &&
    env.supabaseAnonKey.length > 20
  )
}
