import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/context'
import { useI18n } from '../../i18n'
import { getSupabase, getSupabaseForProfile } from '../../supabase/client'
import { Card, CardDescription, CardTitle } from '../../ui/Card'
import { useToast } from '../../ui/toastContext'

export function LoginPage() {
  const { t } = useI18n()
  const { selectProfile, status } = useAuth()
  const { notify } = useToast()
  const navigate = useNavigate()
  const configuredNames = useMemo(
    () => (import.meta.env.VITE_PROFILES || 'Jéssica,Rafael')
      .split(',').map((name: string) => name.trim()).filter(Boolean),
    [],
  )
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
  }, [status, configuredNames])
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
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-5 text-center">
        <img src="/icons/icon-192.png" alt="" className="size-16 object-contain" />
        <p className="text-sm text-muted-foreground">{t('auth.loading')}</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-5 py-8 sm:px-8">
      <Card className="w-full max-w-lg border-0 bg-transparent p-0 text-center shadow-none">
        <div className="mb-8 flex flex-col items-center gap-4 sm:mb-10">
          <img src="/icons/icon-192.png" alt="" className="size-16 object-contain sm:size-20" />
          <div className="flex flex-col items-center gap-2">
            <CardTitle className="text-2xl sm:text-3xl">{t('app.name')}</CardTitle>
            <CardDescription className="text-base">Quem vai usar o Financial Home?</CardDescription>
          </div>
        </div>
        <div className="mx-auto grid w-full max-w-sm grid-cols-2 gap-3 sm:max-w-md sm:gap-8">
          {profiles.map(({ id, name, avatar }, index) => (
            <button key={id} type="button" aria-busy={busy} disabled={busy} onClick={() => void chooseProfile(name)}
              className="group flex min-h-36 min-w-0 flex-col items-center justify-center gap-3 rounded-2xl p-3 transition hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:min-h-44 sm:gap-4 sm:p-5">
              {avatar
                ? <img src={avatar} alt="" className="size-20 rounded-full object-cover ring-2 ring-border transition group-hover:ring-primary sm:size-24" />
                : <span className={`flex size-20 items-center justify-center rounded-full text-xl font-semibold text-white ring-2 ring-border transition group-hover:ring-primary sm:size-24 ${index % 2 ? 'bg-sky-700' : 'bg-rose-700'}`} aria-hidden="true">
                    {name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toLocaleUpperCase('pt-BR')}
                  </span>}
              <span className="max-w-full truncate text-base font-semibold">{name}</span>
            </button>
          ))}
        </div>
        {error && (
            <p role="alert" className="mt-4 text-center text-sm text-destructive">
              {error}
            </p>
          )}
        {busy && <p role="status" className="mt-4 text-center text-sm text-muted-foreground">{t('common.loading')}</p>}
        <p className="mx-auto mt-7 max-w-sm text-center text-sm leading-relaxed text-muted-foreground">Escolha seu perfil para continuar. A identificação fica salva neste navegador.</p>
      </Card>
    </div>
  )
}
