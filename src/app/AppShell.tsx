import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../auth/context'
import { useHousehold } from '../household/context'
import { useI18n } from '../i18n'
import { Button } from '../ui/Button'
import { cn } from '../lib/cn'
import { ConnectionStatus } from '../ui/ConnectionStatus'
import { pendingCount, useOutbox } from '../offline/outbox'
import { useOnlineSync } from '../offline/useOnline'

function useUnreadCount(): number {
  const { supabase, user } = useAuth()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!supabase || !user) {
      queueMicrotask(() => setCount(0))
      return
    }
    let cancelled = false
    void Promise.resolve()
      .then(() =>
        supabase
          .from('notifications_fh')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .is('read_at', null),
      )
      .then(({ count: total }) => {
        if (!cancelled) setCount(total ?? 0)
      })
    return () => {
      cancelled = true
    }
  }, [supabase, user])

  return count
}

export function AppShell() {
  const { t } = useI18n()
  const { user, signOut } = useAuth()
  const { state } = useHousehold()
  const navigate = useNavigate()

  const householdName = state.kind === 'ready' ? state.household.name : null
  const userName =
    (user?.user_metadata?.display_name as string | undefined) ?? user?.email ?? ''
  const unread = useUnreadCount()
  const outboxOps = useOutbox((state) => state.ops)
  const outboxPending = pendingCount(outboxOps)
  const { syncing } = useOnlineSync()

  const items = [
    { to: '/', label: t('nav.overview'), end: true },
    { to: '/agenda', label: t('nav.agenda') },
    { to: '/financas', label: t('nav.finance') },
    { to: '/diario', label: t('nav.diary') },
    { to: '/assistente', label: t('nav.assistant') },
    { to: '/quadro', label: t('nav.board') },
    { to: '/configuracoes', label: t('nav.settings') },
  ] as const

  async function handleSignOut() {
    if (outboxPending > 0) {
      const confirmed = window.confirm(t('sync.logoutWarn', { n: outboxPending }))
      if (!confirmed) return
    }
    await signOut()
    navigate('/entrar')
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex flex-col">
            <span className="text-sm font-semibold">{t('app.name')}</span>
            {householdName ? (
              <span className="text-xs text-muted-foreground">
                {t('house.current', { name: householdName })}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">{t('house.waiting')}</span>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <ConnectionStatus />
            {syncing ? (
              <span className="text-xs text-muted-foreground" role="status">
                {t('connection.syncing')}
              </span>
            ) : outboxPending > 0 ? (
              <button
                type="button"
                onClick={() => void navigate('/configuracoes')}
                className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                aria-label={t('sync.pending', { n: outboxPending })}
              >
                ⏳ {outboxPending}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void navigate('/notificacoes')}
              aria-label={`${t('notif.title')}${unread > 0 ? ` (${t('notif.unread', { n: unread })})` : ''}`}
              className="relative inline-flex size-8 items-center justify-center rounded-md border border-border text-lg hover:bg-muted"
            >
              <span aria-hidden="true">🔔</span>
              {unread > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground"
                >
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </button>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {t('auth.signedInAs', { name: userName })}
            </span>
            <Button size="sm" variant="secondary" onClick={handleSignOut}>
              {t('auth.signOut')}
            </Button>
          </div>
        </div>

        <nav className="mx-auto max-w-6xl overflow-x-auto px-4 pb-2">
          <ul className="flex gap-1">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={'end' in item ? item.end : false}
                  className={({ isActive }) =>
                    cn(
                      'inline-block rounded-md px-3 py-1.5 text-sm transition-colors',
                      isActive
                        ? 'bg-accent font-medium text-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
