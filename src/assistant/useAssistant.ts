import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/context'
import { useHousehold } from '../household/context'
import { env } from '../config/env'
import { mapBackendError, type ChatResponse, type PendingConfirmation } from './tools'

export type Conversation = { id: string; title: string; updated_at: string }

export type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
  pending?: PendingConfirmation[]
}

export type Memory = {
  id: string
  user_id: string | null
  content: string
  active: boolean
  created_by: string | null
}

export type Webhook = {
  id: string
  name: string
  url: string
  events: string[]
  active: boolean
}

export type KeyStatus = {
  checked: boolean
  configured: boolean
  key_last4: string | null
  model: string
  owner: boolean
}

function functionsBase(): string | null {
  if (!env.supabaseUrl.startsWith('https://')) return null
  return `${env.supabaseUrl.replace(/\/$/, '')}/functions/v1`
}

async function callFunction<T>(
  profileId: string,
  path: string,
  body: unknown,
): Promise<{ data: T | null; status: number }> {
  const base = functionsBase()
  if (!base) throw new Error('FUNCTIONS_UNCONFIGURED')
  const response = await fetch(`${base}/${path}`, {
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
    const parsed = (await response.json()) as T
    return { data: parsed, status: response.status }
  } catch {
    return { data: null, status: response.status }
  }
}

export function useAssistantData() {
  const { supabase, user } = useAuth()
  const { state: householdState } = useHousehold()

  const householdId = householdState.kind === 'ready' ? householdState.household.id : null
  const isOwner =
    householdState.kind === 'ready' && householdState.household.created_by === user?.id

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [memories, setMemories] = useState<Memory[]>([])
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [keyStatus, setKeyStatus] = useState<KeyStatus>({
    checked: false,
    configured: false,
    key_last4: null,
    model: '',
    owner: false,
  })
  const [sending, setSending] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  useEffect(() => {
    if (!supabase || !user || !householdId) return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled || !supabase || !user || !householdId) return
      void (async () => {
        const [convs, mems, hooks] = await Promise.all([
          supabase
            .from('ai_conversations_fh')
            .select('id,title,updated_at')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })
            .limit(30),
          supabase
            .from('ai_memories_fh')
            .select('id,user_id,content,active,created_by')
            .eq('household_id', householdId)
            .order('created_at', { ascending: false })
            .limit(100),
          supabase
            .from('automation_webhooks_fh')
            .select('id,name,url,events,active')
            .eq('household_id', householdId)
            .limit(20),
        ])
        if (cancelled) return
        setConversations(((convs.data ?? []) as Conversation[]))
        setMemories(((mems.data ?? []) as Memory[]))
        setWebhooks(((hooks.data ?? []) as Webhook[]))
        setActiveId((current) => {
          if (current) return current
          const first = ((convs.data ?? []) as Conversation[])[0]
          return first ? first.id : null
        })
      })()
    })
    return () => {
      cancelled = true
    }
  }, [supabase, user, householdId, reloadToken])

  useEffect(() => {
    if (!supabase || !activeId) {
      queueMicrotask(() => setMessages([]))
      return
    }
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled || !supabase || !activeId) return
      void supabase
        .from('ai_messages_fh')
        .select('id,role,content,created_at')
        .eq('conversation_id', activeId)
        .order('created_at', { ascending: true })
        .limit(200)
        .then(({ data }) => {
          if (!cancelled) setMessages(((data ?? []) as Message[]))
        })
    })
    return () => {
      cancelled = true
    }
  }, [supabase, activeId, reloadToken])

  useEffect(() => {
    if (!supabase || !user || !householdId) return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled || !supabase || !user || !householdId) return
      void (async () => {
        try {
          const { data } = await callFunction<{ configured?: boolean; key_last4?: string; model?: string; error?: string }>(
            user.id,
            'groq-config',
            { action: 'status' },
          )
          if (cancelled) return
          setKeyStatus({
            checked: true,
            configured: Boolean(data?.configured),
            key_last4: data?.key_last4 ?? null,
            model: data?.model ?? '',
            owner: isOwner,
          })
        } catch {
          if (!cancelled) {
            setKeyStatus({ checked: true, configured: false, key_last4: null, model: '', owner: isOwner })
          }
        }
      })()
    })
    return () => {
      cancelled = true
    }
  }, [supabase, user, householdId, isOwner, reloadToken])

  async function newConversation(): Promise<string | null> {
    if (!supabase || !user || !householdId) return null
    const { data, error } = await supabase
      .from('ai_conversations_fh')
      .insert({ household_id: householdId, user_id: user.id, title: 'Conversa' })
      .select('id')
      .single()
    if (error) return null
    const id = (data as { id: string }).id
    setActiveId(id)
    reload()
    return id
  }

  async function sendMessage(text: string): Promise<ChatResponse> {
    if (!supabase || !user || !householdId) {
      return { ok: false, code: 'FUNCTIONS_UNCONFIGURED' }
    }
    let conversationId = activeId
    if (!conversationId) {
      conversationId = await newConversation()
      if (!conversationId) return { ok: false, code: 'CONVERSATION_FAILED' }
    }
    setSending(true)
    try {
      const { data, status } = await callFunction<{
        reply?: string
        confirmations?: PendingConfirmation[]
        executed?: string
        error?: string
      }>(user.id, 'groq-chat', { conversation_id: conversationId, message: text })
      if (!data || status >= 500) return { ok: false, code: data?.error ?? 'GROQ_UNAVAILABLE' }
      if (data.error) return { ok: false, code: data.error }
      const reply: Message = {
        id: `local-${Date.now()}`,
        role: 'assistant',
        content: data.reply ?? '',
        created_at: new Date().toISOString(),
        pending: data.confirmations,
      }
      setMessages((current) => [
        ...current,
        { id: `local-u-${Date.now()}`, role: 'user', content: text, created_at: new Date().toISOString() },
        reply,
      ])
      reload()
      return { ok: true, reply: reply.content, confirmations: data.confirmations ?? [], executed: data.executed }
    } catch {
      return { ok: false, code: 'FUNCTIONS_UNCONFIGURED' }
    } finally {
      setSending(false)
    }
  }

  async function confirmAction(actionId: string): Promise<ChatResponse> {
    if (!supabase || !activeId) return { ok: false, code: 'FUNCTIONS_UNCONFIGURED' }
    setSending(true)
    try {
      const { data } = await callFunction<{ reply?: string; executed?: string; error?: string }>(
        user?.id ?? '',
        'groq-chat',
        { conversation_id: activeId, confirm_action_id: actionId },
      )
      if (!data || data.error) return { ok: false, code: data?.error ?? 'UNKNOWN' }
      setMessages((current) =>
        current.map((message) =>
          message.pending
            ? { ...message, pending: message.pending.filter((p) => p.action_id !== actionId) }
            : message,
        ),
      )
      reload()
      return { ok: true, reply: data.reply ?? '', confirmations: [], executed: data.executed }
    } finally {
      setSending(false)
    }
  }

  async function saveMemory(content: string): Promise<{ error: string | null }> {
    if (!supabase || !user || !householdId) return { error: 'Supabase não configurado.' }
    const { error } = await supabase.from('ai_memories_fh').insert({
      household_id: householdId,
      user_id: user.id,
      content: content.slice(0, 1000),
      created_by: user.id,
    })
    if (!error) reload()
    return { error: error ? error.message : null }
  }

  async function updateMemory(id: string, patch: { content?: string; active?: boolean }) {
    if (!supabase) return { error: 'Supabase não configurado.' }
    const { error } = await supabase.from('ai_memories_fh').update(patch).eq('id', id)
    if (!error) reload()
    return { error: error ? error.message : null }
  }

  async function deleteMemory(id: string) {
    if (!supabase) return { error: 'Supabase não configurado.' }
    const { error } = await supabase.from('ai_memories_fh').delete().eq('id', id)
    if (!error) reload()
    return { error: error ? error.message : null }
  }

  async function saveWebhook(input: { name: string; url: string; events: string[]; active: boolean }, editingId: string | null) {
    if (!supabase || !user || !householdId) return { error: 'Supabase não configurado.' }
    if (editingId) {
      const { error } = await supabase.from('automation_webhooks_fh').update(input).eq('id', editingId)
      if (!error) reload()
      return { error: error ? error.message : null }
    }
    const { error } = await supabase
      .from('automation_webhooks_fh')
      .insert({ ...input, household_id: householdId, created_by: user.id })
    if (!error) reload()
    return { error: error ? error.message : null }
  }

  async function deleteWebhook(id: string) {
    if (!supabase) return { error: 'Supabase não configurado.' }
    const { error } = await supabase.from('automation_webhooks_fh').delete().eq('id', id)
    if (!error) reload()
    return { error: error ? error.message : null }
  }

  return {
    conversations,
    activeId,
    setActiveId,
    messages,
    memories,
    webhooks,
    keyStatus,
    sending,
    isOwner,
    householdId,
    reload,
    newConversation,
    sendMessage,
    confirmAction,
    saveMemory,
    updateMemory,
    deleteMemory,
    saveWebhook,
    deleteWebhook,
    errorKind: mapBackendError,
  }
}
