import { useEffect, useState } from 'react'
import { useI18n, type Locale } from '../../i18n'
import {
  usePreferences,
  type FontScale,
  type ThemeSetting,
} from '../../preferences/store'
import { syncPreferences } from '../../preferences/sync'
import { useAuth } from '../../auth/context'
import { Card, CardDescription, CardTitle } from '../../ui/Card'
import { Button } from '../../ui/Button'
import { cn } from '../../lib/cn'

function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-md border px-3 py-1.5 text-sm transition-colors',
              value === option.value
                ? 'border-primary bg-accent font-medium'
                : 'border-border bg-card text-muted-foreground hover:bg-muted',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function SettingsPage() {
  const { t, locale } = useI18n()
  const preferences = usePreferences()
  const { user, status } = useAuth()
  const [syncError, setSyncError] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  // Sincroniza alterações pendentes quando há sessão.
  useEffect(() => {
    if (!user || !preferences.pendingSync || status !== 'authenticated' || failed) return
    const controller = new AbortController()

    void syncPreferences(user.id, {
      theme: preferences.theme,
      fontScale: preferences.fontScale,
      locale: preferences.locale,
    }).then((result) => {
      if (controller.signal.aborted) return
      if (result.error) {
        setFailed(true)
        setSyncError(result.error)
        preferences.markSyncFailed()
      } else {
        setSyncError(null)
        preferences.markSynced()
      }
    })
    return () => controller.abort()
    // `preferences` é estável o suficiente: o efeito depende dos campos persistidos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user,
    status,
    failed,
    preferences.pendingSync,
    preferences.theme,
    preferences.fontScale,
    preferences.locale,
  ])

  const saving = status === 'authenticated' && preferences.pendingSync && !failed

  const syncLabel = failed
    ? t('settings.sync.error', { message: syncError ?? '' })
    : status !== 'authenticated'
      ? t('settings.sync.local')
      : saving
        ? t('connection.syncing')
        : preferences.pendingSync
          ? t('settings.sync.pending')
          : t('settings.sync.cloud')

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t('settings.title')}</h1>

      <Card>
        <CardTitle className="mb-4">{t('settings.appearance')}</CardTitle>
        <div className="flex flex-col gap-5">
          <ChoiceGroup<ThemeSetting>
            label={t('settings.theme')}
            value={preferences.theme}
            onChange={(value) => preferences.set({ theme: value })}
            options={[
              { value: 'light', label: t('settings.theme.light') },
              { value: 'dark', label: t('settings.theme.dark') },
              { value: 'system', label: t('settings.theme.system') },
            ]}
          />

          <ChoiceGroup<FontScale>
            label={t('settings.fontScale')}
            value={preferences.fontScale}
            onChange={(value) => preferences.set({ fontScale: value })}
            options={[
              { value: 'sm', label: t('settings.fontScale.sm') },
              { value: 'md', label: t('settings.fontScale.md') },
              { value: 'lg', label: t('settings.fontScale.lg') },
              { value: 'xl', label: t('settings.fontScale.xl') },
            ]}
          />

          <ChoiceGroup<Locale>
            label={t('settings.language')}
            value={locale}
            onChange={(value) => preferences.set({ locale: value })}
            options={[
              { value: 'pt-BR', label: t('settings.language.pt') },
              { value: 'en', label: t('settings.language.en') },
            ]}
          />
        </div>
      </Card>

      <Card>
        <CardTitle className="mb-1">{t('settings.sync')}</CardTitle>
        <CardDescription className="mb-3">{syncLabel}</CardDescription>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={status !== 'authenticated' || !preferences.pendingSync || saving}
            onClick={() => {
              setFailed(false)
              preferences.set({})
            }}
          >
            {t('settings.save')}
          </Button>
        </div>
      </Card>

      <Card>
        <CardTitle className="mb-1">{t('settings.account')}</CardTitle>
        <CardDescription>{user?.email ?? '—'}</CardDescription>
      </Card>
    </div>
  )
}
