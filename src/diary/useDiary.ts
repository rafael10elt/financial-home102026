import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/context'
import { useHousehold } from '../household/context'
import { checkUpload, postMediaPath, slotMediaPath } from './feed'

export type Post = {
  id: string
  household_id: string
  author_id: string | null
  title: string | null
  body: string
  memory_date: string
  category_id: string | null
  tags: string[]
  visibility: 'shared' | 'personal'
  owner_id: string | null
  created_by: string | null
  media?: PostMedia[]
}

export type PostMedia = {
  id: string
  post_id: string
  storage_path: string
  mime: string
  size_bytes: number
  url?: string
}

export type PhotoSlot = { user_id: string; slot: number; storage_path: string; url?: string }

export type Mood = { id: string; household_id: string | null; name: string; emoji: string; color: string | null }

export type UserMood = {
  id: string
  user_id: string
  mood_id: string
  note: string | null
  date: string
  mood?: Mood
}

export type Tip = {
  id: string
  title: string
  body: string
  category_id: string | null
  visibility: 'shared' | 'personal'
  owner_id: string | null
  created_by: string | null
}

export type Announcement = {
  id: string
  title: string
  body: string
  pinned: boolean
  expires_at: string | null
  created_by: string | null
  created_at: string
  read?: boolean
}

export type Gossip = {
  id: string
  title: string | null
  body: string
  owner_id: string | null
  created_by: string | null
  created_at: string
}

export type DiaryCategory = { id: string; name: string }

const DEFAULT_MOODS: { name: string; emoji: string; color: string }[] = [
  { name: 'feliz', emoji: '😊', color: '#16a34a' },
  { name: 'animado', emoji: '🤩', color: '#0e7490' },
  { name: 'grato', emoji: '🙏', color: '#047857' },
  { name: 'cansado', emoji: '😮‍💨', color: '#b45309' },
  { name: 'estressado', emoji: '😤', color: '#be123c' },
  { name: 'triste', emoji: '😢', color: '#1d4ed8' },
]

function mapError(message: string): string {
  if (/row-level security/i.test(message)) return 'Sem permissão para esta operação.'
  if (/duplicate key|unique constraint/i.test(message)) return 'Registro equivalente já existe.'
  if (/violates (check|foreign key|not-null)/i.test(message)) return 'Dados inválidos para o banco.'
  return message
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000_000)}`
}

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>()

export function useDiaryData() {
  const { supabase, user } = useAuth()
  const { state: householdState } = useHousehold()

  const householdId = householdState.kind === 'ready' ? householdState.household.id : null

  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [slots, setSlots] = useState<PhotoSlot[]>([])
  const [moods, setMoods] = useState<Mood[]>([])
  const [userMoods, setUserMoods] = useState<UserMood[]>([])
  const [tips, setTips] = useState<Tip[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [gossip, setGossip] = useState<Gossip[]>([])
  const [categories, setCategories] = useState<DiaryCategory[]>([])
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      if (!supabase || !user || !householdId) {
        setStatus('idle')
        return
      }
      setStatus('loading')
      setError(null)
      void loadAll(supabase, user.id, householdId)
    })

    async function loadAll(
      client: NonNullable<typeof supabase>,
      userId: string,
      household: string,
    ) {
      try {
        for (const mood of DEFAULT_MOODS) {
          await client.from('moods_fh').upsert(
            { ...mood, household_id: household },
            { onConflict: 'household_id,name', ignoreDuplicates: true },
          )
        }

        const [pst, slt, mds, umds, tps, ann, rea, gos, cat] = await Promise.all([
          client
            .from('posts_fh')
            .select('*,post_media_fh(id,post_id,storage_path,mime,size_bytes)')
            .eq('household_id', household)
            .order('memory_date', { ascending: false })
            .limit(300),
          client.from('user_photos_fh').select('user_id,slot,storage_path').limit(10),
          client
            .from('moods_fh')
            .select('id,household_id,name,emoji,color')
            .or(`household_id.is.null,household_id.eq.${household}`)
            .order('name'),
          client
            .from('user_moods_fh')
            .select('id,user_id,mood_id,note,date,moods_fh!inner(id,name,emoji,color)')
            .eq('household_id', household)
            .order('date', { ascending: false })
            .limit(200),
          client.from('tips_fh').select('*').eq('household_id', household).order('created_at', { ascending: false }).limit(200),
          client
            .from('announcements_fh')
            .select('*')
            .eq('household_id', household)
            .order('pinned', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(100),
          client.from('announcement_reads_fh').select('announcement_id').eq('user_id', userId).limit(200),
          client.from('gossip_fh').select('*').eq('household_id', household).order('created_at', { ascending: false }).limit(200),
          client
            .from('categories_fh')
            .select('id,name')
            .eq('domain', 'diary')
            .or(`household_id.is.null,household_id.eq.${household}`)
            .order('name'),
        ])
        if (cancelled) return
        const firstError =
          pst.error ?? slt.error ?? mds.error ?? umds.error ?? tps.error ?? ann.error ?? rea.error ?? gos.error ?? cat.error
        if (firstError) {
          setError(firstError.message)
          setStatus('error')
          return
        }

        const readIds = new Set(
          ((rea.data ?? []) as { announcement_id: string }[]).map((r) => r.announcement_id),
        )
        const postsWithMedia = ((pst.data ?? []) as (Omit<Post, 'media'> & { post_media_fh: PostMedia[] })[]).map(
          (post) => ({ ...post, media: post.post_media_fh ?? [] }),
        )

        setPosts(postsWithMedia)
        setSlots((slt.data ?? []) as PhotoSlot[])
        setMoods((mds.data ?? []) as Mood[])
        setUserMoods(
          (
            (umds.data ?? []) as {
              id: string
              user_id: string
              mood_id: string
              note: string | null
              date: string
              moods_fh: Mood | Mood[]
            }[]
          ).map((row) => ({
            id: row.id,
            user_id: row.user_id,
            mood_id: row.mood_id,
            note: row.note,
            date: row.date,
            mood: Array.isArray(row.moods_fh) ? row.moods_fh[0] : row.moods_fh,
          })),
        )
        setTips((tps.data ?? []) as Tip[])
        setAnnouncements(
          ((ann.data ?? []) as Announcement[]).map((row) => ({ ...row, read: readIds.has(row.id) })),
        )
        setGossip((gos.data ?? []) as Gossip[])
        setCategories((cat.data ?? []) as DiaryCategory[])
        setStatus('ready')
      } catch (unknownError) {
        if (!cancelled) {
          setError(unknownError instanceof Error ? unknownError.message : String(unknownError))
          setStatus('error')
        }
      }
    }

    return () => {
      cancelled = true
    }
  }, [supabase, user, householdId, reloadToken])

  /** URL assinada (1h) com cache em memória por caminho (módulo = 1 por sessão). */
  async function signUrls(paths: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>()
    if (!supabase) return result
    for (const path of paths) {
      const hit = signedUrlCache.get(path)
      if (hit && hit.expiresAt > Date.now() + 60_000) {
        result.set(path, hit.url)
        continue
      }
      const { data, error: signError } = await supabase.storage
        .from('media_fh')
        .createSignedUrl(path, 3600)
      if (!signError && data) {
        signedUrlCache.set(path, { url: data.signedUrl, expiresAt: Date.now() + 3_500_000 })
        result.set(path, data.signedUrl)
      }
    }
    return result
  }

  async function uploadImage(
    file: File,
    path: string,
  ): Promise<{ error: string | null }> {
    if (!supabase) return { error: 'Supabase não configurado.' }
    const check = checkUpload({ type: file.type, size: file.size })
    if (!check.ok) return { error: check.reason }
    const { error: uploadError } = await supabase.storage.from('media_fh').upload(path, file, {
      contentType: file.type,
      upsert: true,
    })
    return { error: uploadError ? uploadError.message : null }
  }

  async function insert(table: string, payload: Record<string, unknown>) {
    if (!supabase || !user || !householdId) return { error: 'Supabase não configurado.', id: null as string | null }
    const { data, error: insertError } = await supabase
      .from(table)
      .insert({ ...payload, household_id: householdId, created_by: user.id })
      .select('id')
      .single()
    if (insertError) return { error: mapError(insertError.message), id: null }
    reload()
    return { error: null, id: (data as { id: string }).id }
  }

  async function update(table: string, id: string, payload: Record<string, unknown>) {
    if (!supabase) return { error: 'Supabase não configurado.' }
    const { data, error: updateError } = await supabase.from(table).update(payload).eq('id', id).select('id').maybeSingle()
    if (updateError) return { error: mapError(updateError.message) }
    if (!data) return { error: 'Nenhum registro foi atualizado. Ele pode não existir mais ou você não ter permissão para editá-lo.' }
    reload()
    return { error: null }
  }

  async function remove(table: string, id: string) {
    if (!supabase) return { error: 'Supabase não configurado.' }
    const { error: deleteError } = await supabase.from(table).delete().eq('id', id)
    if (deleteError) return { error: mapError(deleteError.message) }
    reload()
    return { error: null }
  }

  /** Cria/atualiza slot de foto (preserva o arquivo antigo no bucket). */
  async function saveSlot(slot: number, file: File) {
    if (!supabase || !user || !householdId) return { error: 'Supabase não configurado.' }
    const path = slotMediaPath(householdId, user.id, slot, file.type)
    const uploaded = await uploadImage(file, path)
    if (uploaded.error) return uploaded
    const { error: upsertError } = await supabase.from('user_photos_fh').upsert(
      { user_id: user.id, slot, storage_path: path },
      { onConflict: 'user_id,slot' },
    )
    if (upsertError) return { error: mapError(upsertError.message) }
    reload()
    return { error: null }
  }

  async function addPostMedia(postId: string, file: File) {
    if (!supabase || !user || !householdId) return { error: 'Supabase não configurado.' }
    const path = postMediaPath(householdId, randomId(), file.type)
    const uploaded = await uploadImage(file, path)
    if (uploaded.error) return uploaded
    const { error: insertError } = await supabase.from('post_media_fh').insert({
      post_id: postId,
      storage_path: path,
      mime: file.type,
      size_bytes: file.size,
      created_by: user.id,
    })
    if (insertError) return { error: mapError(insertError.message) }
    reload()
    return { error: null }
  }

  async function logMood(moodId: string, note: string | null) {
    if (!supabase || !user || !householdId) return { error: 'Supabase não configurado.' }
    const today = new Date().toISOString().slice(0, 10)
    const { error: deleteError } = await supabase
      .from('user_moods_fh')
      .delete()
      .eq('user_id', user.id)
      .eq('date', today)
    if (deleteError) return { error: mapError(deleteError.message) }
    const { error: insertError } = await supabase.from('user_moods_fh').insert({
      user_id: user.id,
      household_id: householdId,
      mood_id: moodId,
      note,
      date: today,
    })
    if (insertError) return { error: mapError(insertError.message) }
    reload()
    return { error: null }
  }

  async function markAnnouncementRead(announcementId: string, read: boolean) {
    if (!supabase || !user) return
    if (read) {
      await supabase.from('announcement_reads_fh').upsert(
        { announcement_id: announcementId, user_id: user.id },
        { onConflict: 'announcement_id,user_id', ignoreDuplicates: true },
      )
    } else {
      await supabase
        .from('announcement_reads_fh')
        .delete()
        .eq('announcement_id', announcementId)
        .eq('user_id', user.id)
    }
    reload()
  }

  return {
    status,
    error,
    posts,
    slots,
    moods,
    userMoods,
    tips,
    announcements,
    gossip,
    categories,
    householdId,
    reload,
    insert,
    update,
    remove,
    signUrls,
    saveSlot,
    addPostMedia,
    logMood,
    markAnnouncementRead,
  }
}
