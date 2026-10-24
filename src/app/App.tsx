import { Suspense, lazy } from 'react'
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
import { Button } from '../ui/Button'

// Code-splitting por rota: cada módulo pesado vira um chunk separado.
// Overview/Settings/Login ficam no chunk inicial (primeira tela).
const AgendaPage = lazy(() =>
  import('../features/agenda/AgendaPage').then((module) => ({ default: module.AgendaPage })),
)
const AssistantPage = lazy(() =>
  import('../features/assistant/AssistantPage').then((module) => ({ default: module.AssistantPage })),
)
const DiaryPage = lazy(() =>
  import('../features/diary/DiaryPage').then((module) => ({ default: module.DiaryPage })),
)
const FinancePage = lazy(() =>
  import('../features/finance/FinancePage').then((module) => ({ default: module.FinancePage })),
)
const NotificationsPage = lazy(() =>
  import('../features/notifications/NotificationsPage').then((module) => ({
    default: module.NotificationsPage,
  })),
)

function RouteFallback() {
  const { t } = useI18n()
  return (
    <p className="text-sm text-muted-foreground" role="status">
      {t('common.loading')}
    </p>
  )
}

export function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>
}

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

function HouseholdErrorScreen({ message, retry }: { message: string; retry: () => void }) {
  const { t } = useI18n()
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <Card className="w-full max-w-lg">
        <CardTitle>Não foi possível verificar sua casa</CardTitle>
        <CardDescription className="mt-3">A consulta ao Supabase falhou. A casa não será tratada como inexistente.</CardDescription>
        <p className="mt-3 break-words text-sm text-destructive" role="alert">{message}</p>
        <Button className="mt-4" onClick={retry}>{t('common.retry')}</Button>
      </Card>
    </div>
  )
}

function GuardedRoutes() {
  const { status } = useAuth()
  const { state, refresh } = useHousehold()

  if (status === 'loading') return <LoadingScreen />
  if (status === 'anonymous') return <Navigate to="/entrar" replace />
  if (state.kind === 'loading') return <LoadingScreen />
  if (state.kind === 'error') return <HouseholdErrorScreen message={state.message} retry={() => void refresh()} />
  if (state.kind === 'none') return <OnboardingPage />

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<OverviewPage />} />
        <Route path="agenda" element={<LazyPage><AgendaPage /></LazyPage>} />
        <Route path="notificacoes" element={<LazyPage><NotificationsPage /></LazyPage>} />
        <Route path="financas" element={<LazyPage><FinancePage /></LazyPage>} />
        <Route path="diario" element={<LazyPage><DiaryPage /></LazyPage>} />
        <Route path="assistente" element={<LazyPage><AssistantPage /></LazyPage>} />
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
