import { useState } from 'react'
import { useI18n } from '../../i18n'
import { useAuth } from '../../auth/context'
import { pendingCount, resolveConflict, useOutbox } from '../../offline/outbox'
import { useOnlineSync } from '../../offline/useOnline'
import { usePush } from '../../offline/usePush'
import { Button } from '../../ui/Button'
import { Card, CardDescription, CardTitle } from '../../ui/Card'

const STATE_KEYS = {
  pending: 'sync.state.pending',
  syncing: 'sync.state.syncing',
  synced: 'sync.state.synced',
  conflict: 'sync.state.conflict',
  failed: 'sync.state.failed',
} as const

export function SyncSection() {
  const { t } = useI18n()
  const { supabase } = useAuth()
  const { syncing, pending, syncNow } = useOnlineSync()
  const ops = useOutbox((state) => state.ops)
  const push = usePush()
  const [resolving, setResolving] = useState(false)

  const visible = ops.filter((op) => op.state !== 'synced').slice(0, 50)

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardTitle className="mb-1">{t('sync.title')}</CardTitle>
        <CardDescription className="mb-3">
          {pending === 0 ? t('sync.none') : t('sync.pending', { n: pendingCount(ops) })}
        </CardDescription>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => void syncNow()} disabled={syncing || pending === 0}>
            {syncing ? t('connection.syncing') : t('sync.retry')}
          </Button>
        </div>

        {visible.length > 0 && (
          <ul className="mt-3 flex flex-col divide-y divide-[var(--border)]">
            {visible.map((op) => (
              <li key={op.id} className="flex flex-col gap-1 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs">{op.kind}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {t(STATE_KEYS[op.state])}
                  </span>
                </div>
                {op.error && <span className="text-xs text-destructive">{op.error}</span>}
                {op.state === 'conflict' && (
                  <div className="flex flex-col gap-1 rounded-md border border-border p-2">
                    <span className="text-xs text-muted-foreground">{t('sync.conflictHint')}</span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={resolving}
                        onClick={() => {
                          if (!supabase) return
                          setResolving(true)
                          void resolveConflict(supabase, op.id, 'mine').finally(() => setResolving(false))
                        }}
                      >
                        {t('sync.conflictMine')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={resolving}
                        onClick={() => {
                          if (!supabase) return
                          setResolving(true)
                          void resolveConflict(supabase, op.id, 'theirs').finally(() => setResolving(false))
                        }}
                      >
                        {t('sync.conflictTheirs')}
                      </Button>
                    </div>
                  </div>
                )}
                {(op.state === 'failed' || op.state === 'pending') && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        useOutbox.getState().setOpState(op.id, { state: 'pending', attempts: 0, error: null })
                        void syncNow()
                      }}
                    >
                      {t('sync.retryOp')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => useOutbox.getState().removeOp(op.id)}>
                      {t('sync.discard')}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle className="mb-1">{t('sync.pushTitle')}</CardTitle>
        {push.status === 'unsupported' && (
          <CardDescription>{t('sync.pushUnsupported')}</CardDescription>
        )}
        {push.status === 'unconfigured' && (
          <CardDescription>{t('sync.pushUnconfigured')}</CardDescription>
        )}
        {push.status === 'denied' && (
          <CardDescription>{t('sync.pushDenied')}</CardDescription>
        )}
        {push.status === 'working' && (
          <p className="text-sm text-muted-foreground" role="status">
            {t('common.loading')}
          </p>
        )}
        {push.status === 'error' && (
          <p className="text-sm text-destructive" role="alert">
            {push.message}
          </p>
        )}
        {push.status === 'idle' && (
          <div className="flex flex-col gap-2">
            {push.subscribed && (
              <CardDescription>{t('sync.pushActive')}</CardDescription>
            )}
            <div className="flex gap-2">
              {!push.subscribed ? (
                <Button size="sm" variant="secondary" onClick={() => void push.subscribe()}>
                  {t('sync.pushOn')}
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => void push.unsubscribe()}>
                  {t('sync.pushOff')}
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
