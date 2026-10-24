import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/context'
import { useI18n } from '../../i18n'
import { getSupabase, getSupabaseForProfile } from '../../supabase/client'
import { Card, CardDescription, CardTitle } from '../../ui/Card'
import { useToast } from '../../ui/ToastProvider'

export function LoginPage() {
  const { t } = useI18n()
  const { selectProfile, status } = useAuth()
  const { notify } = useToast()
  const navigate = useNavigate()
  const configuredNames = (import.meta.env.VITE_PROFILES || 'Jéssica,Rafael')
    .split(',').map((name: string) => name.trim()).filter(Boolean)
  const [profiles, setProfiles] = useState<{ id: string; name: string; avatar: string | null }[]>(
    configuredNames.map((name) => ({ id: name, name, avatar: null })),
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!configuredNames.length) return
    let cancelled = false
    // Consulta inicial usa o cliente sem identidade local, pois os nomes de perfil são públicos.
    void (async () => {
      const publicClient = getSupabase()
      if (!publicClient) return
      const { data, error: queryError } = await publicClient
        .from('profiles_fh').select('id,display_name,login_photo_slot')
        .in('display_name', configuredNames)
      if (queryError || !data) return
      const entries = await Promise.all(data.map(async (profile) => {
        let avatar: string | null = null
        if (profile.login_photo_slot) {
          const profileClient = getSupabaseForProfile(profile.id)
          const { data: photo } = await profileClient!.from('user_photos_fh').select('storage_path')
            .eq('user_id', profile.id).eq('slot', profile.login_photo_slot).maybeSingle()
          if (photo?.storage_path) {
            const { data: signed } = await profileClient!.storage.from('media_fh').createSignedUrl(photo.storage_path, 3600)
            avatar = signed?.signedUrl ?? null
          }
        }
        return { id: profile.id, name: profile.display_name, avatar }
      }))
      if (!cancelled) setProfiles(entries)
    })()
    return () => { cancelled = true }
  }, [status])
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
          {profiles.map(({ id, name, avatar }, index) => (
            <button key={id} type="button" aria-busy={busy} disabled={busy} onClick={() => void chooseProfile(name)}
              className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-background p-5 transition hover:border-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
              {avatar
                ? <img src={avatar} alt="" className="size-16 rounded-full object-cover" />
                : <span className={`flex size-16 items-center justify-center rounded-full text-lg font-semibold text-white ${index % 2 ? 'bg-sky-700' : 'bg-rose-700'}`} aria-hidden="true">
                    {name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toLocaleUpperCase('pt-BR')}
                  </span>}
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
        <p className="mt-5 text-xs text-muted-foreground">Escolha seu perfil para continuar. A identificação fica salva neste navegador.</p>
      </Card>
    </div>
  )
}
