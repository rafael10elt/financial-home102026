import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import { useAuth } from '../../auth/context'
import { useHousehold } from '../../household/context'
import { env } from '../../config/env'
import { Button } from '../../ui/Button'
import { Card, CardDescription, CardTitle } from '../../ui/Card'
import { Field, Input } from '../../ui/Input'
import { useToast } from '../../ui/ToastProvider'

type KeyState =
  | { checked: false }
  | { checked: true; configured: boolean; key_last4: string | null; model: string }

const GROQ_MODELS = [
  { id: 'openai/gpt-oss-20b', label: 'ai.modelOption.oss20' },
  { id: 'openai/gpt-oss-120b', label: 'ai.modelOption.oss120' },
  { id: 'qwen/qwen3.8-27b', label: 'ai.modelOption.qwen38' },
] as const
const DEFAULT_MODEL = GROQ_MODELS[0].id

async function callConfig(
  profileId: string,
  body: unknown,
): Promise<{ data: Record<string, unknown> | null; status: number }> {
  const base = `${env.supabaseUrl.replace(/\/$/, '')}/functions/v1`
  const response = await fetch(`${base}/groq-config`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: env.supabaseAnonKey,
      Authorization: `Bearer ${env.supabaseAnonKey}`,
      'x-profile-id': profileId,
    },
    body: JSON.stringify(body),
  })
  try {
    const parsed = (await response.json()) as Record<string, unknown>
    return { data: parsed, status: response.status }
  } catch {
    return { data: null, status: response.status }
  }
}

function configError(data: Record<string, unknown> | null, status: number): string {
  if (status === 404) return 'FUNCTION_NOT_DEPLOYED'
  if (status === 401 || status === 403) return 'FUNCTION_AUTH_FAILED'
  return String(data?.error ?? 'BACKEND_UNAVAILABLE')
}

function configErrorMessage(code: string, fallback: string): string {
  if (code === 'FUNCTION_NOT_DEPLOYED') {
    return 'A função groq-config não está implantada no Supabase. Publique-a conforme o README.'
  }
  if (code === 'FUNCTION_AUTH_FAILED') {
    return 'O Supabase rejeitou a chamada. Confira a chave pública configurada no .env e publique novamente a função groq-config.'
  }
  if (code === 'ENCRYPTION_KEY_NOT_CONFIGURED') {
    return 'Falta configurar o segredo GROQ_ENC_KEY nas Edge Functions do Supabase. Veja as instruções no README.'
  }
  return fallback
}

export function GroqKeySection({ onChanged }: { onChanged: () => void }) {
  const { t } = useI18n()
  const { supabase, user } = useAuth()
  const { state: householdState } = useHousehold()
  const { notify } = useToast()

  const householdId = householdState.kind === 'ready' ? householdState.household.id : null
  const isOwner =
    householdState.kind === 'ready' && householdState.household.created_by === user?.id

  const [state, setState] = useState<KeyState>({ checked: false })
  const [key, setKey] = useState('')
  const [model, setModel] = useState<string>(DEFAULT_MODEL)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [messageError, setMessageError] = useState(false)

  const refresh = useCallback(async () => {
    if (!supabase || !householdId) return
    setBusy(true)
    try {
      const { data, status } = await callConfig(user?.id ?? '', { action: 'status' })
      if (status !== 200 || !data || data.error) {
        throw new Error(configError(data, status))
      }
      setState({
        checked: true,
        configured: Boolean(data?.configured),
        key_last4: (data?.key_last4 as string | null) ?? null,
        model: (data?.model as string | undefined) ?? DEFAULT_MODEL,
      })
      if (typeof data?.model === 'string') {
        setModel(GROQ_MODELS.some((option) => option.id === data.model) ? data.model : DEFAULT_MODEL)
      }
    } catch (error) {
      setState({ checked: true, configured: false, key_last4: null, model: '' })
      const detail = configErrorMessage(error instanceof Error ? error.message : 'BACKEND_UNAVAILABLE', t('ai.backendMissing'))
      setMessage(detail)
      setMessageError(true)
      notify('error', 'Não foi possível consultar a configuração Groq', detail)
    } finally {
      setBusy(false)
    }
  }, [supabase, householdId, user?.id, t, notify])

  // Consulta o estado ao abrir/trocar de casa sem disparar efeitos durante render.
  useEffect(() => {
    if (!supabase || !householdId) return
    setState({ checked: false })
    void refresh()
  }, [supabase, householdId, refresh])

  const configured = state.checked && state.configured

  async function save() {
    if (!supabase || !householdId) return
    const replacingKey = Boolean(key.trim())
    setBusy(true)
    setMessage(null)
    try {
      const { data, status } = await callConfig(user?.id ?? '', {
        action: 'set',
        key: key.trim() || undefined,
        model: model.trim() || undefined,
      })
      if (status !== 200 || !data || data.error) {
        const code = configError(data, status)
        const detail = configErrorMessage(code, mapError(code))
        setMessage(detail)
        setMessageError(true)
        notify('error', replacingKey ? 'Não foi possível salvar a chave Groq' : 'Não foi possível atualizar o modelo', detail)
        return
      }
      setKey('')
      setMessage(replacingKey ? t('ai.keySaved') : t('ai.keyModelSaved'))
      setMessageError(false)
      notify('success', replacingKey ? t('ai.keySaved') : t('ai.keyModelSaved'), `Modelo: ${model}`)
      await refresh()
      onChanged()
    } catch {
      const detail = 'Não foi possível acessar a função groq-config. Verifique se ela foi implantada e se o projeto Supabase está acessível.'
      setMessage(detail)
      setMessageError(true)
      notify('error', 'Falha ao salvar a chave Groq', detail)
    } finally {
      setBusy(false)
    }
  }

  function mapError(code: string): string {
    switch (code) {
      case 'INVALID_KEY':
      case 'INVALID_KEY_FORMAT':
        return t('ai.error.invalid')
      case 'QUOTA_EXCEEDED':
        return t('ai.error.quota')
      case 'MODEL_NOT_SUPPORTED':
        return t('ai.error.model')
      case 'GROQ_UNAVAILABLE':
      case 'GROQ_ERROR':
        return t('ai.error.unavailable')
      case 'NOT_HOUSEHOLD_OWNER':
        return t('ai.keyOwnerOnly')
      default:
        return t('ai.error.unknown')
    }
  }

  async function test() {
    if (!supabase || !householdId) return
    setBusy(true)
    setMessage(null)
    try {
      const { data, status } = await callConfig(user?.id ?? '', { action: 'test', model })
      if (status === 200 && data && !data.error) {
        setMessage(t('ai.keyTestOk', { model: String(data.model ?? model) }))
        setMessageError(false)
        notify('success', 'Conexão Groq validada', String(data.model ?? model))
      } else {
        const code = configError(data, status)
        const detail = configErrorMessage(code, mapError(code))
        setMessage(detail)
        setMessageError(true)
        notify('error', 'Não foi possível validar a conexão Groq', detail)
      }
    } catch {
      const detail = 'Não foi possível acessar a função groq-config. Verifique se ela foi implantada e se o projeto Supabase está acessível.'
      setMessage(detail)
      setMessageError(true)
      notify('error', 'Falha ao validar a conexão Groq', detail)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!supabase || !householdId) return
    setBusy(true)
    try {
      const { data, status } = await callConfig(user?.id ?? '', { action: 'remove' })
      if (status !== 200 || data?.error) throw new Error(String(data?.error ?? 'BACKEND_UNAVAILABLE'))
      setMessage(t('ai.keyMissing'))
      setMessageError(false)
      notify('success', 'Chave Groq removida')
      await refresh()
      onChanged()
    } catch {
      const detail = 'Não foi possível acessar a função groq-config. Verifique se ela foi implantada e se o projeto Supabase está acessível.'
      setMessage(detail)
      setMessageError(true)
      notify('error', 'Falha ao remover a chave Groq', detail)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardTitle className="mb-1">{t('ai.keyTitle')}</CardTitle>
      <CardDescription className="mb-3">{t('ai.keyMasked')}</CardDescription>

      {!isOwner ? (
        <p className="text-sm text-muted-foreground">{t('ai.keyOwnerOnly')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm" role="status">
            {!state.checked
              ? t('common.loading')
              : state.configured
                ? t('ai.keyConfigured', { last4: state.key_last4 ?? '••••' })
                : t('ai.keyMissing')}
          </p>

          <Field label={t('ai.keyInput')}>
            {(aria) => (
              <Input
                {...aria}
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={key}
                placeholder="gsk_…"
                onChange={(e) => setKey(e.target.value)}
              />
            )}
          </Field>

          <Field label={t('ai.model')}>
            {(aria) => (
              <select {...aria} value={model} onChange={(e) => setModel(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground">
                {GROQ_MODELS.map((option) => (
                  <option key={option.id} value={option.id}>{t(option.label)}</option>
                ))}
              </select>
            )}
          </Field>

          {message && (
            <p role={messageError ? 'alert' : 'status'} className={`text-sm ${messageError ? 'text-destructive' : 'text-muted-foreground'}`}>
              {message}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void save()} disabled={busy || (!key.trim() && (!configured || model === state.model))}>
              {key.trim() ? t('ai.keySave') : t('ai.keySaveModel')}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void test()} disabled={busy || !configured}>
              {t('ai.keyTest')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void remove()} disabled={busy || !configured}>
              {t('ai.keyRemove')}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
