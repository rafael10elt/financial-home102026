import { useAuth } from '../auth/context'
import { useI18n } from '../i18n'
import { Button } from '../ui/Button'
import { syncPreferences } from './sync'
import { usePreferences } from './store'

export function ThemeToggle() {
  const { t } = useI18n()
  const { user } = useAuth()
  const preferences = usePreferences()

  async function toggleTheme() {
    const current = preferences.theme === 'system'
      ? (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
      : preferences.theme
    const theme = current === 'dark' ? 'light' : 'dark'
    preferences.set({ theme })
    if (user) {
      const result = await syncPreferences(user.id, {
        theme,
        fontScale: preferences.fontScale,
        locale: preferences.locale,
      })
      if (!result.error) preferences.markSynced()
    }
  }

  return (
    <Button size="sm" variant="ghost" onClick={() => void toggleTheme()}
      aria-label={preferences.theme === 'dark' ? t('settings.theme.light') : t('settings.theme.dark')}
      title={preferences.theme === 'dark' ? t('settings.theme.light') : t('settings.theme.dark')}>
      {preferences.theme === 'dark' ? '☀️' : '🌙'}
    </Button>
  )
}
