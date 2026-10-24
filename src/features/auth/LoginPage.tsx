import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/context'
import { useI18n } from '../../i18n'
import { Card, CardDescription, CardTitle } from '../../ui/Card'
import { useToast } from '../../ui/ToastProvider'

export function LoginPage() {
  const { t } = useI18n()
  const { selectProfile, status } = useAuth()
  const { notify } = useToast()
  const navigate = useNavigate()
  const profiles = (import.meta.env.VITE_PROFILES || 'Jéssica,Rafael')
    .split(',').map((name: string) => name.trim()).filter(Boolean)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function chooseProfile(name: string) {
    setError(null)
    setBusy(true)
    try {
      const result = await selectProfile(name)
      if (result.error) {
        setError(result.error)
        notify('error', 'Não foi possível abrir este perfil', result.error)
        return
      }
      navigate('/', { replace: true })
    } finally {
      setBusy(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">{t('auth.loading')}</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <Card className="w-full max-w-lg">
        <div className="mb-6 flex flex-col gap-1">
          <CardTitle className="text-xl">{t('app.name')}</CardTitle>
          <CardDescription>Quem vai usar o Financial Home?</CardDescription>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {profiles.map((name: string, index: number) => (
            <button key={name} type="button" disabled={busy} onClick={() => void chooseProfile(name)}
              className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-background p-5 transition hover:border-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
              <span className={`flex size-16 items-center justify-center rounded-full text-lg font-semibold text-white ${index % 2 ? 'bg-sky-700' : 'bg-rose-700'}`} aria-hidden="true">
                {name.split(/\s+/).map((part: string) => part[0]).join('').slice(0, 2).toLocaleUpperCase('pt-BR')}
              </span>
              <span className="text-sm font-medium">{name}</span>
            </button>
          ))}
        </div>
        {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        {busy && <p role="status" className="mt-4 text-center text-sm text-muted-foreground">{t('common.loading')}</p>}
        <p className="mt-5 text-xs text-muted-foreground">A sessão é lembrada neste navegador. A seleção de perfil é uma identificação interna, sem senha.</p>
      </Card>
    </div>
  )
}
