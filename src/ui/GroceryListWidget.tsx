import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/context'
import { useHousehold } from '../household/context'
import { useI18n } from '../i18n'
import { useVoice } from '../assistant/useVoice'
import { env } from '../config/env'
import { Button } from './Button'
import { Card, CardTitle } from './Card'
import { Modal } from './Modal'
import { useToast } from './toastContext'

type GroceryItem = { id: string; name: string; is_checked: boolean; created_at: string }

export function GroceryListWidget() {
  const { t } = useI18n()
  const { supabase, user } = useAuth()
  const { state: householdState } = useHousehold()
  const { notify } = useToast()
  const householdId = householdState.kind === 'ready' ? householdState.household.id : null
  const [items, setItems] = useState<GroceryItem[]>([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [aiProcessing, setAiProcessing] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const lastLoadError = useRef<string | null>(null)
  const audioTranscriptRef = useRef('')

  const refresh = useCallback(async () => {
    if (!supabase || !householdId) { setItems([]); setLoading(false); return }
    const { data, error } = await supabase.from('grocery_items_fh').select('id,name,is_checked,created_at').eq('household_id', householdId).order('created_at', { ascending: true })
    if (error) {
      setLoadError(true)
      if (lastLoadError.current !== error.message) {
        lastLoadError.current = error.message
        notify('error', t('overview.grocery.title'), t('overview.grocery.loadError', { message: error.message }))
      }
      setLoading(false)
      return
    }
    lastLoadError.current = null
    setLoadError(false)
    setItems((data ?? []) as GroceryItem[])
    setLoading(false)
  }, [householdId, notify, supabase, t])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 12_000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const processAudioWithAi = async (spokenText: string) => {
    const clean = spokenText.trim()
    if (!clean || !supabase || !householdId || !user) return
    setAiProcessing(true)
    try {
      const base = `${env.supabaseUrl.replace(/\/$/, '')}/functions/v1`
      const response = await fetch(`${base}/groq-chat`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          apikey: env.supabaseAnonKey,
          Authorization: `Bearer ${env.supabaseAnonKey}`,
          'x-profile-id': user.id,
        },
        body: JSON.stringify({ action: 'parse_grocery', text: clean }),
      })

      const data = await response.json()
      if (!response.ok || !Array.isArray(data?.items)) {
        throw new Error(data?.error ?? 'Não foi possível interpretar o áudio.')
      }

      const parsedItems: string[] = data.items
      if (parsedItems.length === 0) {
        notify('info', t('overview.grocery.title'), 'Nenhum item identificado na fala.')
        return
      }

      const payload = parsedItems.map((itemName) => ({
        household_id: householdId,
        name: itemName,
        created_by: user.id,
      }))

      const { error: insertError } = await supabase.from('grocery_items_fh').insert(payload)
      if (insertError) throw new Error(insertError.message)

      await refresh()
      notify('success', t('overview.grocery.title'), `${parsedItems.length} item(ns) adicionado(s): ${parsedItems.join(', ')}`)
    } catch (err: unknown) {
      notify('error', t('overview.grocery.title'), err instanceof Error ? err.message : 'Falha ao processar com IA.')
    } finally {
      setAiProcessing(false)
      audioTranscriptRef.current = ''
    }
  }

  const voice = useVoice((finalText) => {
    if (finalText) {
      audioTranscriptRef.current = finalText
    }
  })

  // Detecta quando a fala terminou automaticamente pelo navegador
  const prevListening = useRef(voice.listening)
  useEffect(() => {
    if (prevListening.current && !voice.listening) {
      const textToProcess = audioTranscriptRef.current || voice.transcript
      if (textToProcess && !aiProcessing) {
        void processAudioWithAi(textToProcess)
      }
    }
    prevListening.current = voice.listening
  }, [voice.listening, voice.transcript, aiProcessing])

  const handleMicClick = () => {
    if (voice.listening) {
      voice.stopListening()
      setTimeout(() => {
        const textToProcess = audioTranscriptRef.current || voice.transcript
        if (textToProcess && !aiProcessing) {
          void processAudioWithAi(textToProcess)
        }
      }, 250)
    } else {
      audioTranscriptRef.current = ''
      voice.startListening()
    }
  }

  // Adição manual digitada
  async function addItem(event: FormEvent) {
    event.preventDefault()
    const cleanName = name.trim().slice(0, 120)
    if (!cleanName || !supabase || !householdId || !user) return
    setBusy(true)
    const { error } = await supabase.from('grocery_items_fh').insert({ household_id: householdId, name: cleanName, created_by: user.id })
    setBusy(false)
    if (error) { notify('error', t('overview.grocery.title'), t('overview.grocery.saveError', { message: error.message })); return }
    setName('')
    await refresh()
    notify('success', t('overview.grocery.title'), t('overview.grocery.added'))
  }

  async function toggle(item: GroceryItem) {
    if (!supabase || !householdId) return
    const { error } = await supabase.from('grocery_items_fh').update({ is_checked: !item.is_checked }).eq('id', item.id).eq('household_id', householdId)
    if (error) { notify('error', t('overview.grocery.title'), t('overview.grocery.saveError', { message: error.message })); return }
    setItems((current) => current.map((row) => row.id === item.id ? { ...row, is_checked: !row.is_checked } : row))
  }

  async function clearChecked() {
    if (!supabase || !householdId) return
    setBusy(true)
    const { error } = await supabase.from('grocery_items_fh').delete().eq('household_id', householdId).eq('is_checked', true)
    setBusy(false)
    setConfirmClear(false)
    if (error) { notify('error', t('overview.grocery.title'), t('overview.grocery.deleteError', { message: error.message })); return }
    await refresh()
    notify('success', t('overview.grocery.title'), t('overview.grocery.cleared'))
  }

  const checkedCount = items.filter((item) => item.is_checked).length
  return (
    <>
      <Card>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{t('overview.grocery.title')}</CardTitle>
          {checkedCount > 0 && <Button size="sm" variant="secondary" disabled={busy} onClick={() => setConfirmClear(true)}>{t('overview.grocery.clearChecked', { count: checkedCount })}</Button>}
        </div>

        <form className="mt-3 flex gap-2" onSubmit={(event) => void addItem(event)}>
          <input
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('overview.grocery.placeholder')}
            aria-label={t('overview.grocery.placeholder')}
            disabled={aiProcessing}
          />
          {voice.supportedRecognition && (
            <Button
              type="button"
              variant={voice.listening ? 'destructive' : 'secondary'}
              onClick={handleMicClick}
              disabled={busy || aiProcessing}
              aria-label={voice.listening ? 'Concluir fala e processar com IA' : 'Falar lista com IA'}
              title={voice.listening ? 'Clique para concluir e processar' : 'Gravar por voz (IA)'}
            >
              {voice.listening ? '■' : '🎤'}
            </Button>
          )}
          <Button type="submit" aria-label={t('overview.grocery.add')} disabled={busy || aiProcessing || !name.trim()}>＋</Button>
        </form>

        {voice.listening && (
          <p className="mt-2 animate-pulse text-xs text-destructive" role="status">
            ● Ouvindo... Fale os itens e clique no botão para concluir.
          </p>
        )}
        {aiProcessing && (
          <p className="mt-2 animate-pulse text-xs text-primary" role="status">
            ✦ IA organizando e separando os itens da lista...
          </p>
        )}

        {loadError && <p className="mt-3 text-sm text-destructive" role="alert">{t('overview.grocery.unavailable')}</p>}
        {loading ? <p className="mt-3 text-sm text-muted-foreground">{t('common.loading')}</p> : loadError ? null : items.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{t('overview.grocery.empty')}</p> : (
          <ul className="mt-3 flex flex-col divide-y divide-[var(--border)]">
            {items.map((item) => <li key={item.id} className="flex items-center gap-3 py-2 text-sm">
              <input type="checkbox" checked={item.is_checked} onChange={() => void toggle(item)} aria-label={t('overview.grocery.markItem', { name: item.name })} />
              <span className={`min-w-0 flex-1 break-words ${item.is_checked ? 'text-muted-foreground line-through' : ''}`}>{item.name}</span>
            </li>)}
          </ul>
        )}
      </Card>
      {confirmClear && <Modal title={t('overview.grocery.clearTitle')} onClose={() => setConfirmClear(false)}>
        <p className="text-sm text-muted-foreground">{t('overview.grocery.clearConfirm', { count: checkedCount })}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmClear(false)}>{t('common.cancel')}</Button>
          <Button variant="destructive" disabled={busy} onClick={() => void clearChecked()}>{t('overview.grocery.clearAction')}</Button>
        </div>
      </Modal>}
    </>
  )
}