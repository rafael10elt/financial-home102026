// Identificação interna por perfil. O UUID enviado pelo cliente é spoofável;
// usado apenas no app doméstico de baixa segurança.
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type AuthContext = {
  user: { id: string; user_metadata: { display_name: string } }
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
  const profileId = request.headers.get('x-profile-id') ?? ''
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(profileId)) {
    throw new HttpError(401, 'PROFILE_REQUIRED')
  }
  const service = serviceClient()
  const { data, error } = await service
    .from('profiles_fh')
    .select('id, display_name')
    .eq('id', profileId)
    .maybeSingle()
  if (error || !data) throw new HttpError(401, 'PROFILE_NOT_FOUND')
  return {
    user: { id: data.id, user_metadata: { display_name: data.display_name } },
    userClient: service,
    serviceClient: service,
  }
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
      'access-control-allow-headers': 'authorization, apikey, content-type, x-profile-id, x-client-info',
      'access-control-allow-methods': 'POST, OPTIONS',
    },
  })
}
