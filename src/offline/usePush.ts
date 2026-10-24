import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/context'
import { env } from '../config/env'

export type PushState =
  | { status: 'unsupported' }
  | { status: 'unconfigured' }
  | { status: 'denied' }
  | { status: 'idle'; subscribed: boolean }
  | { status: 'working' }
  | { status: 'error'; message: string }

function vapidKey(): string | null {
  const raw = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined ?? '').trim()
  return raw.length > 10 ? raw : null
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * Push do navegador (Web Push).
 * - Sem suporte (navegador) ou sem VAPID configurada: estados honestos.
 * - A chave privada permanece no servidor; aqui só é usada a chave pública.
 */
export function usePush(): PushState & {
  subscribe: () => Promise<void>
  unsubscribe: () => Promise<void>
  refresh: () => Promise<void>
  sendTest: () => Promise<{ sent: number; failed: number }>
} {
  const { supabase, user } = useAuth()
  const [state, setState] = useState<PushState>(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return { status: 'unsupported' }
    }
    if (!vapidKey()) return { status: 'unconfigured' }
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      return { status: 'denied' }
    }
    return { status: 'idle', subscribed: false }
  })

  const refresh = useCallback(async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState({ status: 'unsupported' })
      return
    }
    if (!vapidKey()) {
      setState({ status: 'unconfigured' })
      return
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      setState({ status: 'denied' })
      return
    }
    if (!supabase || !user) return
    setState({ status: 'working' })
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await supabase.from('push_subscriptions_fh').upsert(
          {
            user_id: user.id,
            endpoint: subscription.endpoint,
            keys: subscription.toJSON().keys ?? {},
          },
          { onConflict: 'user_id,endpoint', ignoreDuplicates: true },
        )
      }
      setState({ status: 'idle', subscribed: Boolean(subscription) })
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }, [supabase, user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function subscribe() {
    const key = vapidKey()
    if (!key || !('serviceWorker' in navigator) || !supabase || !user) return
    setState({ status: 'working' })
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState({ status: 'denied' })
        return
      }
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as unknown as ArrayBuffer,
      })
      const { error } = await supabase.from('push_subscriptions_fh').upsert(
        {
          user_id: user.id,
          endpoint: subscription.endpoint,
          keys: subscription.toJSON().keys ?? {},
        },
        { onConflict: 'user_id,endpoint', ignoreDuplicates: true },
      )
      if (error) {
        await subscription.unsubscribe()
        setState({ status: 'error', message: error.message })
        throw error
      }
      setState({ status: 'idle', subscribed: true })
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
      throw error
    }
  }

  async function unsubscribe() {
    if (!('serviceWorker' in navigator) || !supabase || !user) return
    setState({ status: 'working' })
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        const { error } = await supabase.from('push_subscriptions_fh').delete().eq('user_id', user.id).eq('endpoint', subscription.endpoint)
        if (error) throw error
        await subscription.unsubscribe()
      }
      setState({ status: 'idle', subscribed: false })
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
      throw error
    }
  }

  async function sendTest(): Promise<{ sent: number; failed: number }> {
  if (!user) throw new Error('Perfil não selecionado.')
  const base = `${env.supabaseUrl.replace(/\/$/, '')}/functions/v1`
  const response = await fetch(`${base}/push-test`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: env.supabaseAnonKey,
      Authorization: `Bearer ${env.supabaseAnonKey}`,
      'x-profile-id': user.id,
    },
    body: JSON.stringify({}),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error ?? 'Falha ao enviar notificação de teste.')
  }
  return data as { sent: number; failed: number }
}
