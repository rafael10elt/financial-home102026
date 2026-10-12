import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { useHousehold } from '../household/context'
import { useI18n } from '../i18n'
import { Button } from '../ui/Button'
import { cn } from '../lib/cn'
import { ConnectionStatus } from '../ui/ConnectionStatus'

export function AppShell() {
  const { t } = useI18n()
  const { user, signOut } = useAuth()
  const { state } = useHousehold()
  const navigate = useNavigate()

  const householdName = state.kind === 'ready' ? state.household.name : null
  const userName =
    (user?.user_metadata?.display_name as string | undefined) ?? user?.email ?? ''

  const items = [
    { to: '/', label: t('nav.overview'), end: true },
    { to: '/agenda', label: t('nav.agenda') },
    { to: '/financas', label: t('nav.finance') },
    { to: '/diario', label: t('nav.diary') },
    { to: '/quadro', label: t('nav.board') },
    { to: '/configuracoes', label: t('nav.settings') },
  ] as const

  async function handleSignOut() {
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
