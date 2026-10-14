import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import { useAuth } from '../../auth/context'
import { useAgendaData } from '../../agenda/useAgenda'
import { loadPreferences, syncPreferences } from '../../preferences/sync'
import { Button } from '../../ui/Button'
import { Card, CardDescription, CardTitle } from '../../ui/Card'
import { Field, Input } from '../../ui/Input'

const LAST_RUN_KEY = 'fh.notif.lastrun'

function shouldRun(lastRun: string | null, now: number): boolean {
  if (!lastRun) return true
  const parsed = Date.parse(lastRun)
  if (Number.isNaN(parsed)) return true
  return now - parsed > 6 * 60 * 60 * 1000
}

export function NotificationsPage() {
  const { t } = useI18n()
  const { supabase, user } = useAuth()
  const agenda = useAgendaData()

  const [leadHours, setLeadHours] = useState(24)
  const [enabled, setEnabled] = useState(true)
  const [digest, setDigest] = useState(false)
  const [prefsLoaded, setPrefsLoaded] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  // Carrega preferências de aviso.
  useEffect(() => {
    if (!supabase || !user || prefsLoaded) return
    let cancelled = false
    void loadPreferences(supabase, user.id).then((result) => {
      if (cancelled || result.error || !result.state) {
        if (!cancelled) setPrefsLoaded(true)
        return
      }
      const prefs = result.state as {
        notifEnabled?: boolean
        notifLeadHours?: number
        notifDigest?: boolean
      }
      if (typeof prefs.notifEnabled === 'boolean') setEnabled(prefs.notifEnabled)
      if (typeof prefs.notifLeadHours === 'number') setLeadHours(prefs.notifLeadHours)
      if (typeof prefs.notifDigest === 'boolean') setDigest(prefs.notifDigest)
      if (!cancelled) setPrefsLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [supabase, user, prefsLoaded])

  // Gera avisos de vencimento (no máximo 1 vez a cada 6h por dispositivo).
  // Todo setState acontece em callbacks assíncronos, nunca no corpo do efeito.
  useEffect(() => {
    if (!supabase || !user || !enabled || agenda.status !== 'ready' || generating) return
    let cancelled = false
    void Promise.resolve()
      .then((): string | null => {
        try {
          return localStorage.getItem(LAST_RUN_KEY)
        } catch {
          return null
        }
      })
      .then(async (lastRun) => {
        if (cancelled || !shouldRun(lastRun, Date.now())) return
        setGenerating(true)
        try {
          const result = await agenda.generateDueNotifications(leadHours)
          if (cancelled) return
          if (result.error) {
            setGenerateError(result.error)
          } else {
            try {
              localStorage.setItem(LAST_RUN_KEY, new Date().toISOString())
            } catch {
              // Cache opcional.
            }
          }
        } finally {
          if (!cancelled) setGenerating(false)
        }
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, user, enabled, agenda.status])

  async function savePrefs(next: { enabled: boolean; leadHours: number; digest: boolean }) {
    if (!supabase || !user) return
    const current = await loadPreferences(supabase, user.id)
    const merged = {
      ...(current.state ?? {}),
      notifEnabled: next.enabled,
      notifLeadHours: next.leadHours,
      notifDigest: next.digest,
    }
    await syncPreferences(user.id, merged as never)
  }

  const unread = agenda.notifications.filter((n) => !n.read_at)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">{t('notif.title')}</h1>
        {unread.length > 0 && (
          <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
            {t('notif.unread', { n: unread.length })}
          </span>
        )}
        <div className="ml-auto">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void agenda.markNotificationsRead('all')}
            disabled={unread.length === 0}
          >
            {t('notif.markAllRead')}
          </Button>
        </div>
      </div>

      {generateError && (
        <p role="alert" className="text-sm text-destructive">
          {t('notif.generateError', { message: generateError })}
        </p>
      )}

      <Card>
        {agenda.status === 'loading' && (
          <p className="text-sm text-muted-foreground" role="status">
            {t('common.loading')}
          </p>
        )}
        {agenda.status === 'ready' && agenda.notifications.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('notif.empty')}</p>
        )}
        {agenda.status === 'ready' && agenda.notifications.length > 0 && (
          <ul className="flex flex-col divide-y divide-[var(--border)]">
            {agenda.notifications.map((notification) => (
              <li
                key={notification.id}
                className={notification.read_at ? 'py-2.5 opacity-70' : 'py-2.5'}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{notification.title}</span>
                    {notification.body && (
                      <span className="text-xs text-muted-foreground">{notification.body}</span>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      {new Intl.DateTimeFormat('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hourCycle: 'h23',
                      }).format(new Date(notification.created_at))}
                    </span>
                  </div>
                  {!notification.read_at && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void agenda.markNotificationsRead([notification.id])}
                    >
                      {t('notif.markRead')}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle className="mb-1">{t('notif.settings')}</CardTitle>
        <CardDescription className="mb-3">{t('notif.pushUnsupported')}</CardDescription>
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => {
                setEnabled(e.target.checked)
                void savePrefs({ enabled: e.target.checked, leadHours, digest })
              }}
            />
            {t('notif.enabled')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={digest}
              onChange={(e) => {
                setDigest(e.target.checked)
                void savePrefs({ enabled, leadHours, digest: e.target.checked })
              }}
            />
            {t('notif.digest')}
          </label>
          <Field label={t('notif.leadTime')}>
            {(aria) => (
              <Input
                {...aria}
                type="number"
                min={0}
                max={168}
                value={leadHours}
                onChange={(e) => {
                  const value = Math.max(0, Number.parseInt(e.target.value, 10) || 0)
                  setLeadHours(value)
                  void savePrefs({ enabled, leadHours: value, digest })
                }}
                className="w-28"
              />
            )}
          </Field>
        </div>
      </Card>
    </div>
  )
}
