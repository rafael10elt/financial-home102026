import { useI18n } from '../../i18n'
import { useHousehold } from '../../household/context'
import { useAuth } from '../../auth/context'
import { Card, CardDescription, CardTitle } from '../../ui/Card'
import { PhasePlaceholder } from '../../ui/PhasePlaceholder'
import { useState } from 'react'
import { Button } from '../../ui/Button'

export function OverviewPage() {
  const { t } = useI18n()
  const { state, refresh } = useHousehold()
  const { user } = useAuth()
  const [copied, setCopied] = useState(false)

  async function copyCode() {
    if (state.kind !== 'ready' || !state.household.join_code) return
    try {
      await navigator.clipboard.writeText(state.household.join_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t('nav.overview')}</h1>

      <Card>
        <CardTitle>{t('house.title')}</CardTitle>
        {state.kind === 'ready' ? (
          <div className="mt-3 flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {t('house.current', { name: state.household.name })}
            </p>

            <div>
              <p className="mb-1.5 text-sm font-medium">{t('house.members')}</p>
              <ul className="flex flex-col gap-1">
                {state.members.map((member) => (
                  <li
                    key={member.user_id}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <span>{member.display_name ?? member.user_id.slice(0, 8)}</span>
                    <span className="text-xs text-muted-foreground">
                      {member.role === 'owner' ? t('house.owner') : t('house.member')}
                      {member.user_id === user?.id ? ' · você' : ''}
                    </span>
                  </li>
                ))}
                {state.members.length === 0 && (
                  <li className="text-sm text-muted-foreground">{t('common.loading')}</li>
                )}
              </ul>
            </div>

            {state.joinCodeVisible && state.household.join_code && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">{t('house.joinCode')}:</span>
                <code className="rounded bg-muted px-2 py-1 font-mono text-sm">
                  {state.household.join_code}
                </code>
                <Button size="sm" variant="secondary" onClick={copyCode}>
                  {copied ? t('house.copied') : t('house.copyCode')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void refresh()}>
                  {t('common.retry')}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <CardDescription className="mt-2">{t('house.waiting')}</CardDescription>
        )}
      </Card>

      <PhasePlaceholder phase="2" module={t('phase.title')} />
    </div>
  )
}
