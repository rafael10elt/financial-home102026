import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/context'
import { pendingCount, syncOutbox, useOutbox } from './outbox'

/** Estado de conexão + sincronização automática da outbox ao voltar o sinal. */
export function useOnlineSync(): {
  online: boolean
  syncing: boolean
  pending: number
  syncNow: () => Promise<void>
} {
  const { supabase, user } = useAuth()
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const syncing = useOutbox((state) => state.syncing)
  const ops = useOutbox((state) => state.ops)
  const pending = pendingCount(ops)

  const syncNow = useCallback(async () => {
    if (!supabase || !user || !navigator.onLine) return
    await syncOutbox(supabase)
  }, [supabase, user])

  useEffect(() => {
    const goOnline = () => {
      setOnline(true)
      void syncNow()
    }
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [syncNow])

  // Primeira sincronização ao montar (ex.: abriu o app com itens pendentes).
  useEffect(() => {
    void syncNow()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { online, syncing, pending, syncNow }
}
