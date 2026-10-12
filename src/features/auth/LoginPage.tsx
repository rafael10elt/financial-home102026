import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/context'
import { useI18n } from '../../i18n'
import { Button } from '../../ui/Button'
import { Field, Input } from '../../ui/Input'
import { Card, CardDescription, CardTitle } from '../../ui/Card'

type Mode = 'signin' | 'signup'

export function LoginPage() {
  const { t } = useI18n()
  const { signIn, signUp, status } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const emailInvalid = email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const emailRequired = email.length === 0
  const passwordRequired = password.length === 0
  const nameRequired = mode === 'signup' && displayName.trim().length === 0

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setInfo(null)

    if (emailRequired || passwordRequired || nameRequired || emailInvalid) {
      setError(t('common.error', { message: 'Verifique os campos destacados.' }))
      return
    }

    setBusy(true)
    try {
      const result =
        mode === 'signin'
          ? await signIn(email.trim(), password)
          : await signUp(email.trim(), password, displayName.trim())

      if (result.error) {
        if (mode === 'signup' && /Confirme o e-mail/.test(result.error)) {
          setInfo(result.error)
        } else {
          setError(result.error)
        }
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
      <Card className="w-full max-w-sm">
        <div className="mb-4 flex flex-col gap-1">
          <CardTitle>{t('app.name')}</CardTitle>
          <CardDescription>{t('auth.subtitle')}</CardDescription>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {mode === 'signup' && (
            <Field label={t('auth.displayName')} error={nameRequired ? t('common.required') : null}>
              {(aria) => (
                <Input
                  {...aria}
                  value={displayName}
                  autoComplete="name"
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              )}
            </Field>
          )}

          <Field
            label={t('auth.email')}
            error={emailRequired ? t('common.required') : emailInvalid ? t('common.invalidEmail') : null}
          >
            {(aria) => (
              <Input
                {...aria}
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            )}
          </Field>

          <Field label={t('auth.password')} error={passwordRequired ? t('common.required') : null}>
            {(aria) => (
              <Input
                {...aria}
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            )}
          </Field>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {info && (
            <p role="status" className="text-sm text-muted-foreground">
              {info}
            </p>
          )}

          <Button type="submit" disabled={busy}>
            {busy ? t('common.loading') : mode === 'signin' ? t('auth.signIn') : t('auth.signUp')}
          </Button>

          <button
            type="button"
            className="text-center text-sm text-primary hover:underline"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin')
              setError(null)
              setInfo(null)
            }}
          >
            {mode === 'signin' ? t('auth.toSignUp') : t('auth.toSignIn')}
          </button>
        </form>
      </Card>
    </div>
  )
}
