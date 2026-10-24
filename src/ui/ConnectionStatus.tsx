import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'

type State = 'online' | 'offline'

export function ConnectionStatus() {
  const { t } = useI18n()
  const [state, setState] = useState<State>(() =>
    typeof navigator === 'undefined' || navigator.onLine ? 'online' : 'offline',
  )

  useEffect(() => {
    const goOnline = () => setState('online')
    const goOffline = () => setState('offline')
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  const online = state === 'online'

  return (
    <span
      role="status"
      aria-live="polite"
      className={
        online
          ? 'inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground'
          : 'inline-flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-xs text-destructive'
      }
    >
      <span
        aria-hidden="true"
        className={online ? 'size-2 rounded-full bg-green-500' : 'size-2 rounded-full bg-destructive'}
      />
      <span className="hidden sm:inline">{online ? t('connection.online') : t('connection.offline')}</span>
    </span>
  )
}
