import { useState, type FormEvent } from 'react'
import { useI18n } from '../../i18n'
import { useHousehold } from '../../household/context'
import { Button } from '../../ui/Button'
import { Field, Input } from '../../ui/Input'
import { Card, CardDescription, CardTitle } from '../../ui/Card'

export function OnboardingPage() {
  const { t } = useI18n()
  const { createHousehold, joinHousehold } = useHousehold()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError(t('common.required'))
      return
    }
    setBusy(true)
    try {
      const result = await createHousehold(name)
      if (result.error) setError(result.error)
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!code.trim()) {
      setError(t('common.required'))
      return
    }
    setBusy(true)
    try {
      const result = await joinHousehold(code)
      if (result.error) setError(result.error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{t('house.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('house.waiting')}</p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle className="mb-1">{t('house.create')}</CardTitle>
          <CardDescription className="mb-4">{t('house.createHint')}</CardDescription>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <Field label={t('house.name')}>
              {(aria) => (
                <Input
                  {...aria}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={80}
                />
              )}
            </Field>
            <Button type="submit" disabled={busy}>
              {t('house.create')}
            </Button>
          </form>
        </Card>

        <Card>
          <CardTitle className="mb-1">{t('house.join')}</CardTitle>
          <CardDescription className="mb-4">{t('house.joinHint')}</CardDescription>
          <form onSubmit={handleJoin} className="flex flex-col gap-4">
            <Field label={t('house.code')}>
              {(aria) => (
                <Input
                  {...aria}
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  maxLength={12}
                  autoComplete="off"
                  spellCheck={false}
                />
              )}
            </Field>
            <Button type="submit" variant="secondary" disabled={busy}>
              {t('house.join')}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
