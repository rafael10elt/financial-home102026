// groq-config — gerencia a chave Groq SEM expô-la ao frontend.
// Ações: status | set | test | remove. Uma chave global, configurável pelo dono.
// A chave em texto trafega apenas nesta chamada autenticada (HTTPS) e é
// criptografada (AES-256-GCM) antes de persistir em ai_config_fh.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { decryptText, encryptText } from '../_shared/crypto.ts'
import { HttpError, jsonResponse, requireUser, serviceClient } from '../_shared/auth.ts'

type Action = 'status' | 'set' | 'test' | 'remove'
const DEFAULT_MODEL = 'openai/gpt-oss-20b'
const SUPPORTED_CHAT_MODELS = new Set([
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
  'qwen/qwen3.8-27b',
])

type SetBody = {
  action: 'set'
  key?: string
  model?: string
}

type OtherBody = {
  action: Exclude<Action, 'set'>
  model?: string
}

async function assertOwner(userId: string): Promise<void> {
  const service = serviceClient()
  const { data: profile, error: profileError } = await service
    .from('profiles_fh')
    .select('household_id')
    .eq('id', userId)
    .maybeSingle()
  if (profileError || !profile?.household_id) throw new HttpError(403, 'NOT_HOUSEHOLD_OWNER')
  const { data, error } = await service
    .from('households_fh')
    .select('created_by')
    .eq('id', profile.household_id)
    .maybeSingle()
  if (error || !data) throw new HttpError(403, 'NOT_HOUSEHOLD_OWNER')
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
    if (!SUPPORTED_CHAT_MODELS.has(model)) return { ok: false, code: 'MODEL_NOT_SUPPORTED' }
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Responda apenas: OK' }],
        max_completion_tokens: 8,
        tools: [{
          type: 'function',
          function: {
            name: 'smoke_test',
            description: 'Verificação de suporte a ferramentas.',
            parameters: { type: 'object', properties: {} },
          },
        }],
        tool_choice: 'auto',
      }),
    })
    if (!response.ok) {
      const body = await response.text()
      if (response.status === 400 || response.status === 404) {
        return { ok: false, code: /model|decommission|not found/i.test(body) ? 'MODEL_NOT_SUPPORTED' : 'GROQ_ERROR' }
      }
      return { ok: false, code: mapGroqError(response.status) }
    }
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
    const { action } = body
    if (!action) throw new HttpError(400, 'ACTION_REQUIRED')

    if (action !== 'status') await assertOwner(user.id)
    const service = serviceClient()

    if (action === 'status') {
      const { data } = await service
        .from('ai_config_fh')
        .select('key_last4,model,encrypted_key')
        .eq('config_id', 'global')
        .maybeSingle()
      const row = data as { key_last4: string | null; model: string; encrypted_key: string | null } | null
      const environmentKey = Deno.env.get('GROQ_API_KEY')?.trim() ?? ''
      return jsonResponse({
        configured: Boolean(row?.encrypted_key || environmentKey),
        key_last4: row?.encrypted_key ? row.key_last4 : environmentKey ? environmentKey.slice(-4) : null,
        model: row?.model ?? DEFAULT_MODEL,
      })
    }

    if (action === 'set') {
      const suppliedKey = (body as SetBody).key?.trim() ?? ''
      const model = (body as SetBody).model?.trim() || DEFAULT_MODEL
      if (suppliedKey && (!suppliedKey.startsWith('gsk_') || suppliedKey.length < 20)) {
        return jsonResponse({ error: 'INVALID_KEY_FORMAT' }, 400)
      }
      const { data: currentConfig } = await service
        .from('ai_config_fh')
        .select('encrypted_key,key_last4')
        .eq('config_id', 'global')
        .maybeSingle()
      const current = currentConfig as { encrypted_key: string | null; key_last4: string | null } | null
      const key = suppliedKey || (current?.encrypted_key ? await decryptText(current.encrypted_key) : Deno.env.get('GROQ_API_KEY')?.trim() ?? '')
      if (!key) return jsonResponse({ error: 'NO_KEY' }, 400)
      // Faz uma chamada real de chat; listar modelos não garante acesso de inferência.
      const probe = await testKey(key, model)
      if (!probe.ok) return jsonResponse({ error: probe.code ?? 'GROQ_ERROR' }, 400)
      let encrypted = current?.encrypted_key ?? null
      let keyLast4 = current?.key_last4 ?? null
      if (suppliedKey) {
        try {
          encrypted = await encryptText(key)
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('GROQ_ENC_KEY')) {
            throw new HttpError(503, 'ENCRYPTION_KEY_NOT_CONFIGURED')
          }
          throw error
        }
        keyLast4 = key.slice(-4)
      }
      const { error } = await service.from('ai_config_fh').upsert(
        {
          config_id: 'global',
          provider: 'groq',
          encrypted_key: encrypted,
          key_last4: keyLast4,
          model,
        },
        { onConflict: 'config_id' },
      )
      if (error) throw new HttpError(500, 'DB_ERROR')
      return jsonResponse({ configured: true, key_last4: keyLast4, model })
    }

    if (action === 'test') {
      const { data } = await service
        .from('ai_config_fh')
        .select('encrypted_key,model')
        .eq('config_id', 'global')
        .maybeSingle()
      const row = data as { encrypted_key: string | null; model: string } | null
      const key = row?.encrypted_key
        ? await decryptText(row.encrypted_key)
        : Deno.env.get('GROQ_API_KEY')?.trim()
      if (!key) return jsonResponse({ error: 'NO_KEY' }, 400)
      const model = (body as OtherBody).model?.trim() || row?.model || DEFAULT_MODEL
      const probe = await testKey(key, model)
      if (!probe.ok) return jsonResponse({ error: probe.code ?? 'GROQ_ERROR' }, 400)
      return jsonResponse({ ok: true, model })
    }

    if (action === 'remove') {
      const { error } = await service
        .from('ai_config_fh')
        .upsert(
          { config_id: 'global', provider: 'groq', encrypted_key: null, key_last4: null },
          { onConflict: 'config_id' },
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
