// Autenticação das Edge Functions: valida o JWT do chamador e devolve
// o usuário + um cliente Supabase com o token dele (RLS = usuário).
import { createClient, type SupabaseClient, type User } from 'https://esm.sh/@supabase/supabase-js@2'

export type AuthContext = {
  user: User
  userClient: SupabaseClient
  serviceClient: SupabaseClient
}

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !serviceKey) throw new Error('Segredos do Supabase ausentes na função.')
  return createClient(url, serviceKey, { auth: { persistSession: false } })
}

export async function requireUser(request: Request): Promise<AuthContext> {
  const header = request.headers.get('Authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) throw new HttpError(401, 'NO_SESSION')

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  if (!url || !anonKey) throw new Error('Segredos do Supabase ausentes na função.')

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  })
  const { data, error } = await userClient.auth.getUser()
  if (error || !data.user) throw new HttpError(401, 'NO_SESSION')
  return { user: data.user, userClient, serviceClient: serviceClient() }
}

export class HttpError extends Error {
  status: number
  code: string
  constructor(status: number, code: string) {
    super(code)
    this.status = status
    this.code = code
  }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, content-type',
      'access-control-allow-methods': 'POST, OPTIONS',
    },
  })
}
