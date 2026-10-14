import { useState } from 'react'
import { useAuth } from '../auth/context'

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
 * - A ENTREGA depende de backend/worker com a chave privada (Fase 7/n8n):
 *   aqui capturamos e guardamos a inscrição; nada afirma entrega.
 */
export function usePush(): PushState & {
  subscribe: () => Promise<void>
  unsubscribe: () => Promise<void>
  refresh: () => Promise<void>
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

  async function refresh() {
    if (!('serviceWorker' in navigator) || !supabase || !user) return
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
  }

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
        setState({ status: 'error', message: error.message })
        return
      }
      setState({ status: 'idle', subscribed: true })
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }

  async function unsubscribe() {
    if (!('serviceWorker' in navigator) || !supabase || !user) return
    setState({ status: 'working' })
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await subscription.unsubscribe()
        await supabase.from('push_subscriptions_fh').delete().eq('user_id', user.id).eq('endpoint', subscription.endpoint)
      }
      setState({ status: 'idle', subscribed: false })
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }

  return { ...state, subscribe, unsubscribe, refresh }
}
