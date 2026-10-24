import { useState } from 'react'
import { useI18n } from '../../i18n'
import { useAuth } from '../../auth/context'
import { useHousehold } from '../../household/context'
import { env } from '../../config/env'
import { Button } from '../../ui/Button'
import { Card, CardDescription, CardTitle } from '../../ui/Card'
import { Field, Input } from '../../ui/Input'

type KeyState =
  | { checked: false }
  | { checked: true; configured: boolean; key_last4: string | null; model: string }

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

export function GroqKeySection({ onChanged }: { onChanged: () => void }) {
  const { t } = useI18n()
  const { supabase, user } = useAuth()
  const { state: householdState } = useHousehold()

  const householdId = householdState.kind === 'ready' ? householdState.household.id : null
  const isOwner =
    householdState.kind === 'ready' && householdState.household.created_by === user?.id

  const [state, setState] = useState<KeyState>({ checked: false })
  const [key, setKey] = useState('')
  const [model, setModel] = useState('llama-3.3-70b-versatile')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [messageError, setMessageError] = useState(false)

  async function refresh() {
    if (!supabase || !householdId) return
    setBusy(true)
    try {
      const { data } = await callConfig(user?.id ?? '', { action: 'status', household_id: householdId })
      setState({
        checked: true,
        configured: Boolean(data?.configured),
        key_last4: (data?.key_last4 as string | null) ?? null,
        model: (data?.model as string | undefined) ?? 'llama-3.3-70b-versatile',
      })
      if (typeof data?.model === 'string') setModel(data.model)
    } catch {
      setState({ checked: true, configured: false, key_last4: null, model: '' })
      setMessage(t('ai.backendMissing'))
      setMessageError(true)
    } finally {
      setBusy(false)
    }
  }

  // Consulta o estado ao abrir (sem expor nada sensível).
  if (!state.checked && supabase && householdId && !busy) {
    void refresh()
  }

  const configured = state.checked && state.configured

  async function save() {
    if (!supabase || !householdId) return
    setBusy(true)
    setMessage(null)
    try {
      const { data, status } = await callConfig(user?.id ?? '', {
        action: 'set',
        household_id: householdId,
        key: key.trim(),
        model: model.trim() || undefined,
      })
      if (status !== 200 || !data || data.error) {
        setMessage(mapError(String(data?.error ?? 'UNKNOWN')))
        setMessageError(true)
        return
      }
      setKey('')
      setMessage(t('ai.keySaved'))
      setMessageError(false)
      await refresh()
      onChanged()
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
      const { data, status } = await callConfig(user?.id ?? '', { action: 'test', household_id: householdId })
      if (status === 200 && data && !data.error) {
        setMessage(t('ai.keyTestOk', { model: String(data.model ?? model) }))
        setMessageError(false)
      } else {
        setMessage(mapError(String(data?.error ?? 'UNKNOWN')))
        setMessageError(true)
      }
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!supabase || !householdId) return
    setBusy(true)
    try {
      await callConfig(user?.id ?? '', { action: 'remove', household_id: householdId })
      setMessage(t('ai.keyMissing'))
      setMessageError(false)
      await refresh()
      onChanged()
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
              <Input
                {...aria}
                value={model}
                spellCheck={false}
                onChange={(e) => setModel(e.target.value)}
              />
            )}
          </Field>

          {message && (
            <p role={messageError ? 'alert' : 'status'} className={`text-sm ${messageError ? 'text-destructive' : 'text-muted-foreground'}`}>
              {message}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void save()} disabled={busy || !key.trim()}>
              {t('ai.keySave')}
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
