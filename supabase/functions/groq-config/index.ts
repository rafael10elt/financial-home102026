// groq-config — gerencia a chave Groq SEM expô-la ao frontend.
// Ações: status | set | test | remove. Somente o dono da casa.
// A chave em texto trafega apenas nesta chamada autenticada (HTTPS) e é
// criptografada (AES-256-GCM) antes de persistir em ai_config_fh.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { decryptText, encryptText } from '../_shared/crypto.ts'
import { HttpError, jsonResponse, requireUser, serviceClient } from '../_shared/auth.ts'

type Action = 'status' | 'set' | 'test' | 'remove'

type SetBody = {
  action: 'set'
  household_id: string
  key: string
  model?: string
}

type OtherBody = {
  action: Exclude<Action, 'set'>
  household_id: string
}

async function assertOwner(householdId: string, userId: string): Promise<void> {
  const service = serviceClient()
  const { data, error } = await service
    .from('households_fh')
    .select('created_by')
    .eq('id', householdId)
    .maybeSingle()
  if (error || !data) throw new HttpError(404, 'HOUSEHOLD_NOT_FOUND')
  if ((data as { created_by: string }).created_by !== userId) {
    throw new HttpError(403, 'NOT_HOUSEHOLD_OWNER')
  }
}

function mapGroqError(status: number): string {
  if (status === 401) return 'INVALID_KEY'
  if (status === 429) return 'QUOTA_EXCEEDED'
  if (status === 404) return 'MODEL_NOT_SUPPORTED'
  if (status >= 500) return 'GROQ_UNAVAILABLE'
  return 'GROQ_ERROR'
}

async function testKey(key: string, model: string): Promise<{ ok: boolean; code?: string }> {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
    })
    if (!response.ok) return { ok: false, code: mapGroqError(response.status) }
    const payload = (await response.json()) as { data?: { id: string }[] }
    const models = new Set((payload.data ?? []).map((m) => m.id))
    if (!models.has(model)) return { ok: false, code: 'MODEL_NOT_SUPPORTED' }
    return { ok: true }
  } catch {
    return { ok: false, code: 'GROQ_UNAVAILABLE' }
  }
}

serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return jsonResponse({ ok: true })
  if (request.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405)

  try {
    const { user } = await requireUser(request)
    const body = (await request.json()) as SetBody | OtherBody
    const { action, household_id: householdId } = body
    if (!householdId) throw new HttpError(400, 'HOUSEHOLD_REQUIRED')

    await assertOwner(householdId, user.id)
    const service = serviceClient()

    if (action === 'status') {
      const { data } = await service
        .from('ai_config_fh')
        .select('key_last4,model,encrypted_key')
        .eq('household_id', householdId)
        .maybeSingle()
      const row = data as { key_last4: string | null; model: string; encrypted_key: string | null } | null
      const environmentKey = Deno.env.get('GROQ_API_KEY')?.trim() ?? ''
      return jsonResponse({
        configured: Boolean(row?.encrypted_key || environmentKey),
        key_last4: row?.encrypted_key ? row.key_last4 : environmentKey ? environmentKey.slice(-4) : null,
        model: row?.model ?? 'llama-3.3-70b-versatile',
      })
    }

    if (action === 'set') {
      const key = (body as SetBody).key?.trim() ?? ''
      const model = (body as SetBody).model?.trim() || 'llama-3.3-70b-versatile'
      if (!key.startsWith('gsk_') || key.length < 20) {
        return jsonResponse({ error: 'INVALID_KEY_FORMAT' }, 400)
      }
      // Valida a chave ANTES de persistir: nunca guardamos chave inválida.
      const probe = await testKey(key, model)
      if (!probe.ok) return jsonResponse({ error: probe.code ?? 'GROQ_ERROR' }, 400)
      const encrypted = await encryptText(key)
      const { error } = await service.from('ai_config_fh').upsert(
        {
          household_id: householdId,
          provider: 'groq',
          encrypted_key: encrypted,
          key_last4: key.slice(-4),
          model,
        },
        { onConflict: 'household_id' },
      )
      if (error) throw new HttpError(500, 'DB_ERROR')
      return jsonResponse({ configured: true, key_last4: key.slice(-4), model })
    }

    if (action === 'test') {
      const { data } = await service
        .from('ai_config_fh')
        .select('encrypted_key,model')
        .eq('household_id', householdId)
        .maybeSingle()
      const row = data as { encrypted_key: string | null; model: string } | null
      const key = row?.encrypted_key
        ? await decryptText(row.encrypted_key)
        : Deno.env.get('GROQ_API_KEY')?.trim()
      if (!key) return jsonResponse({ error: 'NO_KEY' }, 400)
      const model = row?.model ?? 'llama-3.3-70b-versatile'
      const probe = await testKey(key, model)
      if (!probe.ok) return jsonResponse({ error: probe.code ?? 'GROQ_ERROR' }, 400)
      return jsonResponse({ ok: true, model })
    }

    if (action === 'remove') {
      const { error } = await service
        .from('ai_config_fh')
        .upsert(
          { household_id: householdId, provider: 'groq', encrypted_key: null, key_last4: null },
          { onConflict: 'household_id' },
        )
      if (error) throw new HttpError(500, 'DB_ERROR')
      return jsonResponse({ configured: false })
    }

    return jsonResponse({ error: 'UNKNOWN_ACTION' }, 400)
  } catch (error) {
    if (error instanceof HttpError) return jsonResponse({ error: error.code }, error.status)
    console.error('[groq-config]', error)
    return jsonResponse({ error: 'INTERNAL_ERROR' }, 500)
  }
})
