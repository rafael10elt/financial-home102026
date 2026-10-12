import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { useHousehold } from '../household/context'
import { useI18n } from '../i18n'
import { AppShell } from './AppShell'
import { LoginPage } from '../features/auth/LoginPage'
import { OnboardingPage } from '../features/household/OnboardingPage'
import { OverviewPage } from '../features/overview/OverviewPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { PhasePlaceholder } from '../ui/PhasePlaceholder'
import { Card, CardDescription, CardTitle } from '../ui/Card'

function UnconfiguredScreen() {
  const { t } = useI18n()
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <Card className="w-full max-w-lg">
        <CardTitle>{t('env.title')}</CardTitle>
        <CardDescription className="mt-3">{t('env.supabaseMissing')}</CardDescription>
        <CardDescription className="mt-2">{t('env.hint')}</CardDescription>
      </Card>
    </div>
  )
}

function LoadingScreen() {
  const { t } = useI18n()
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground" role="status">
        {t('auth.loading')}
      </p>
    </div>
  )
}

function GuardedRoutes() {
  const { status } = useAuth()
  const { state } = useHousehold()

  if (status === 'loading') return <LoadingScreen />
  if (status === 'anonymous') return <Navigate to="/entrar" replace />
  if (state.kind === 'loading') return <LoadingScreen />
  if (state.kind === 'none') return <OnboardingPage />

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<OverviewPage />} />
        <Route
          path="agenda"
          element={<PhasePlaceholder phase="2" module="Agenda" />}
        />
        <Route
          path="financas"
          element={<PhasePlaceholder phase="3" module="FinanÃ§as" />}
        />
        <Route
          path="diario"
          element={<PhasePlaceholder phase="4" module="DiÃ¡rio" />}
        />
        <Route
          path="quadro"
          element={<PhasePlaceholder phase="4" module="Quadro" />}
        />
        <Route path="configuracoes" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export function App() {
  const { status } = useAuth()

  if (status === 'unconfigured') return <UnconfiguredScreen />

  return (
    <Routes>
      <Route path="/entrar" element={<LoginPage />} />
      <Route path="*" element={<GuardedRoutes />} />
    </Routes>
  )
}
