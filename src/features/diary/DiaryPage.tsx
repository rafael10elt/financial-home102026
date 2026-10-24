import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../i18n'
import { useAuth } from '../../auth/context'
import { useHousehold } from '../../household/context'
import {
  useDiaryData,
  type Announcement,
  type Gossip,
  type Post,
  type Tip,
} from '../../diary/useDiary'
import { parseTags, searchMemories, SUGGESTED_TAGS } from '../../diary/feed'
import { newOp, useOutbox } from '../../offline/outbox'
import { Button } from '../../ui/Button'
import { Card, CardDescription, CardTitle } from '../../ui/Card'
import { Field, Input } from '../../ui/Input'
import { Modal } from '../../ui/Modal'
import { useToast } from '../../ui/toastContext'
import { AnnouncementDialog, GossipDialog, MoodDialog, PostDialog, TipDialog } from './DiaryDialogs'

type Tab = 'feed' | 'memories' | 'photos' | 'mood' | 'tips' | 'announcements' | 'gossip'

export function MediaImage({
  path,
  alt,
  sign,
  className,
}: {
  path: string
  alt: string
  sign: (paths: string[]) => Promise<Map<string, string>>
  className?: string
}) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void sign([path]).then((map) => {
      if (!cancelled) setUrl(map.get(path) ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [path, sign])

  if (!url) {
    return <div className={className} role="status" aria-label={alt} />
  }
  return <img src={url} alt={alt} className={className} loading="lazy" />
}

export function DiaryPage() {
  const { t } = useI18n()
  const { user, supabase } = useAuth()
  const { state: householdState } = useHousehold()
  const diary = useDiaryData()
  const { notify } = useToast()

  const [tab, setTab] = useState<Tab>('feed')
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [dialog, setDialog] = useState<
    | { name: 'post'; editing: Post | null }
    | { name: 'tip'; editing: Tip | null }
    | { name: 'announcement'; editing: Announcement | null }
    | { name: 'gossip'; editing: Gossip | null }
    | { name: 'mood' }
    | null
  >(null)
  const [confirmDelete, setConfirmDelete] = useState<{ table: string; id: string } | null>(null)
  const [loginPhotoSlot, setLoginPhotoSlot] = useState<number | null>(null)

  useEffect(() => {
    if (!supabase || !user) return
    let cancelled = false
    void supabase.from('profiles_fh').select('login_photo_slot').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setLoginPhotoSlot(data?.login_photo_slot ?? null)
      })
    return () => { cancelled = true }
  }, [supabase, user])

  async function chooseLoginPhoto(slot: number) {
    if (!supabase || !user) return
    const nextSlot = loginPhotoSlot === slot ? null : slot
    const { data, error } = await supabase.from('profiles_fh').update({ login_photo_slot: nextSlot }).eq('id', user.id).select('id').maybeSingle()
    if (error) {
      notify('error', 'Não foi possível salvar a foto do perfil', error.message)
      return
    }
    if (!data) {
      notify('error', 'Não foi possível salvar a foto do perfil', 'O perfil não foi atualizado. Confira as permissões do banco.')
      return
    }
    setLoginPhotoSlot(nextSlot)
    notify('success', nextSlot ? 'Foto do perfil atualizada' : 'Foto do perfil removida')
  }

  const [query, setQuery] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [now] = useState(() => Date.now())

  const members =
    householdState.kind === 'ready' ? householdState.members : []
  const authorName = (authorId: string | null) => {
    if (!authorId) return '—'
    if (authorId === user?.id) return 'você'
    return members.find((m) => m.user_id === authorId)?.display_name ?? authorId.slice(0, 8)
  }

  const memories = useMemo(
    () =>
      searchMemories(
        diary.posts.map((p) => ({
          id: p.id,
          title: p.title,
          body: p.body,
          memory_date: p.memory_date,
          category_id: p.category_id,
          tags: p.tags,
          visibility: p.visibility,
          author_id: p.author_id,
        })),
        {
          query,
          tags: parseTags(tagFilter),
          categoryId: '',
          from,
          to,
        },
      ),
    [diary.posts, query, tagFilter, from, to],
  )

  const mySlots = useMemo(
    () => (user ? diary.slots.filter((s) => s.user_id === user.id) : []),
    [diary.slots, user],
  )
  const partnerSlots = useMemo(
    () => (user ? diary.slots.filter((s) => s.user_id !== user.id) : diary.slots),
    [diary.slots, user],
  )

  const latestMoods = useMemo(() => {
    const byUser = new Map<string, (typeof diary.userMoods)[number]>()
    for (const entry of diary.userMoods) {
      if (!byUser.has(entry.user_id)) byUser.set(entry.user_id, entry)
    }
    return [...byUser.values()]
    // diary é um objeto novo a cada render; a lista é pequena e barata.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diary.userMoods])

  const activeAnnouncements = useMemo(() => {
    return diary.announcements.filter((a) => !a.expires_at || Date.parse(a.expires_at) > now)
  }, [diary.announcements, now])

  async function handleDelete() {
    if (!confirmDelete) return
    setBusy(true)
    const result = await diary.remove(confirmDelete.table, confirmDelete.id)
    setBusy(false)
    setConfirmDelete(null)
    if (result.error) setServerError(t('diary.saveError', { message: result.error }))
  }

  /** Tenta enfileirar rascunho offline. Retorna true se enfileirou. */
  function tryEnqueueOffline(
    kind: 'post.create' | 'tip.create' | 'gossip.create',
    values: Record<string, unknown>,
  ): boolean {
    const offline = typeof navigator !== 'undefined' && !navigator.onLine
    if (!offline || !diary.householdId || !user) return false
    useOutbox.getState().enqueue(newOp(kind, diary.householdId, user.id, values))
    setServerError(null)
    setNotice(t('sync.savedOffline'))
    setDialog(null)
    return true
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'feed', label: t('diary.tabs.feed') },
    { id: 'memories', label: t('diary.tabs.memories') },
    { id: 'photos', label: t('diary.tabs.photos') },
    { id: 'mood', label: t('diary.tabs.mood') },
    { id: 'tips', label: t('diary.tabs.tips') },
    { id: 'announcements', label: t('diary.tabs.announcements') },
    { id: 'gossip', label: t('diary.tabs.gossip') },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">{t('diary.title')}</h1>
        <div className="ml-auto flex flex-wrap gap-2">
          {tab === 'feed' && (
            <Button size="sm" onClick={() => setDialog({ name: 'post', editing: null })}>
              {t('diary.newPost')}
            </Button>
          )}
          {tab === 'tips' && (
            <Button size="sm" onClick={() => setDialog({ name: 'tip', editing: null })}>
              {t('diary.newTip')}
            </Button>
          )}
          {tab === 'announcements' && (
            <Button size="sm" onClick={() => setDialog({ name: 'announcement', editing: null })}>
              {t('diary.newAnnouncement')}
            </Button>
          )}
          {tab === 'gossip' && (
            <Button size="sm" onClick={() => setDialog({ name: 'gossip', editing: null })}>
              {t('diary.newGossip')}
            </Button>
          )}
          {tab === 'mood' && (
            <Button size="sm" onClick={() => setDialog({ name: 'mood' })}>
              {t('diary.moodSave')}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('diary.title')}>
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={
              tab === item.id
                ? 'rounded-md border border-primary bg-accent px-3 py-1.5 text-sm font-medium'
                : 'rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted'
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}

      {diary.status === 'loading' && (
        <p className="text-sm text-muted-foreground" role="status">
          {t('common.loading')}
        </p>
      )}
      {diary.status === 'error' && (
        <Card>
          <p className="text-sm text-destructive" role="alert">
            {t('common.error', { message: diary.error ?? '' })}
          </p>
          <div className="mt-2">
            <Button size="sm" variant="secondary" onClick={diary.reload}>
              {t('common.retry')}
            </Button>
          </div>
        </Card>
      )}

      {diary.status === 'ready' && (tab === 'feed' || tab === 'memories') && (
        <div className="flex flex-col gap-3">
          {tab === 'memories' && (
            <Card>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <Field label={t('diary.search')}>
                  {(aria) => (
                    <Input
                      {...aria}
                      value={query}
                      placeholder={t('diary.searchPlaceholder')}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  )}
                </Field>
                <Field label={t('diary.tags')}>
                  {(aria) => (
                    <Input
                      {...aria}
                      value={tagFilter}
                      placeholder={SUGGESTED_TAGS.join(', ')}
                      onChange={(e) => setTagFilter(e.target.value)}
                    />
                  )}
                </Field>
                <Field label={t('diary.from')}>
                  {(aria) => <Input {...aria} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />}
                </Field>
                <Field label={t('diary.to')}>
                  {(aria) => <Input {...aria} type="date" value={to} onChange={(e) => setTo(e.target.value)} />}
                </Field>
              </div>
            </Card>
          )}
          {(tab === 'feed' ? diary.posts : memories.map((m) => diary.posts.find((p) => p.id === m.id) as Post)).length ===
          0 ? (
            <Card>
              <p className="text-sm text-muted-foreground">{t('diary.empty')}</p>
            </Card>
          ) : (
            (tab === 'feed' ? diary.posts : memories.map((m) => diary.posts.find((p) => p.id === m.id) as Post)).map(
              (post) => (
                <Card key={post.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-1">
                      {post.title && <CardTitle>{post.title}</CardTitle>}
                      <CardDescription>
                        {post.memory_date} · {authorName(post.author_id)}
                        {post.visibility === 'personal' ? ` · ${t('agenda.visibility.personal')}` : ''}
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="secondary" onClick={() => setDialog({ name: 'post', editing: post })}>
                        {t('diary.editPost')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmDelete({ table: 'posts_fh', id: post.id })}
                      >
                        {t('agenda.delete')}
                      </Button>
                    </div>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{post.body}</p>
                  {post.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {post.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {post.media && post.media.length > 0 && (
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {post.media.map((media) => (
                        <MediaImage
                          key={media.id}
                          path={media.storage_path}
                          alt={post.title ?? post.body.slice(0, 40)}
                          sign={diary.signUrls}
                          className="aspect-square w-full rounded-md border border-border bg-muted object-cover"
                        />
                      ))}
                    </div>
                  )}
                </Card>
              ),
            )
          )}
          {tab === 'feed' && (
            <p className="text-xs text-muted-foreground">{t('diary.socialSoon')}</p>
          )}
        </div>
      )}

      {diary.status === 'ready' && tab === 'photos' && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardTitle className="mb-1">{t('diary.slotsTitle')}</CardTitle>
            <CardDescription className="mb-3">{t('diary.slotNote')} Toque no círculo de uma foto para usá-la (ou removê-la) na tela de entrada.</CardDescription>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {[1, 2, 3, 4, 5].map((slot) => {
                const filled = mySlots.find((s) => s.slot === slot)
                return (
                  <div
                    key={slot}
                    className="relative aspect-square overflow-hidden rounded-md border border-border bg-muted text-xs text-muted-foreground hover:bg-accent"
                  >
                    <label htmlFor={`diary-photo-slot-${slot}`} className="absolute inset-0 flex cursor-pointer items-center justify-center">
                    {filled ? (
                      <MediaImage
                        path={filled.storage_path}
                        alt={`${t('diary.slotsTitle')} ${slot}`}
                        sign={diary.signUrls}
                        className="absolute inset-0 size-full object-cover"
                      />
                    ) : (
                      <span className="p-2 text-center">{t('diary.slotEmpty')}</span>
                    )}
                    </label>
                    {filled && (
                      <button type="button" aria-pressed={loginPhotoSlot === slot}
                        aria-label={loginPhotoSlot === slot ? 'Remover foto da tela de entrada' : 'Usar como foto da tela de entrada'}
                        onClick={(event) => { event.preventDefault(); event.stopPropagation(); void chooseLoginPhoto(slot) }}
                        className="absolute right-2 top-2 z-10 flex size-8 items-center justify-center rounded-full border border-white/70 bg-black/60 text-white">
                        {loginPhotoSlot === slot ? '✓' : '○'}
                      </button>
                    )}
                    <input
                      id={`diary-photo-slot-${slot}`}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="sr-only"
                      aria-label={`${t('diary.slotReplace')} ${slot}`}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setBusy(true)
                        void diary.saveSlot(slot, file).then((result) => {
                          setBusy(false)
                          if (result.error) {
                            setServerError(t('diary.uploadError', { message: result.error }))
                          }
                          e.target.value = ''
                        })
                      }}
                    />
                  </div>
                )
              })}
            </div>
            {busy && (
              <p className="mt-2 text-xs text-muted-foreground" role="status">
                {t('common.loading')}
              </p>
            )}
          </Card>

          {partnerSlots.length > 0 && (
            <Card>
              <CardTitle className="mb-2">Fotos</CardTitle>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {partnerSlots.map((slot) => (
                  <MediaImage
                    key={`${slot.user_id}-${slot.slot}`}
                    path={slot.storage_path}
                    alt={`slot ${slot.slot}`}
                    sign={diary.signUrls}
                    className="aspect-square w-full rounded-md border border-border bg-muted object-cover"
                  />
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {diary.status === 'ready' && tab === 'mood' && (
        <div className="flex flex-col gap-3">
          <Card>
            <CardTitle className="mb-2">{t('diary.moodToday')}</CardTitle>
            {latestMoods.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('diary.empty')}</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {latestMoods.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-2 text-sm">
                    <span className="text-xl" aria-hidden="true">
                      {entry.mood?.emoji ?? '🙂'}
                    </span>
                    <span className="font-medium">{entry.mood?.name ?? '—'}</span>
                    <span className="text-xs text-muted-foreground">
                      {authorName(entry.user_id)}
                      {entry.note ? ` · ${entry.note}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardTitle className="mb-2">{t('diary.moodHistory')}</CardTitle>
            <ul className="flex flex-col divide-y divide-[var(--border)]">
              {diary.userMoods.slice(0, 20).map((entry) => (
                <li key={entry.id} className="flex items-center gap-2 py-1.5 text-sm">
                  <span aria-hidden="true">{entry.mood?.emoji ?? '🙂'}</span>
                  <span>
                    {entry.mood?.name ?? '—'} · {entry.date}
                  </span>
                  <span className="text-xs text-muted-foreground">{authorName(entry.user_id)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {diary.status === 'ready' && tab === 'tips' && (
        <div className="flex flex-col gap-3">
          {diary.tips.length === 0 ? (
            <Card>
              <p className="text-sm text-muted-foreground">{t('diary.empty')}</p>
            </Card>
          ) : (
            diary.tips.map((tip) => (
              <Card key={tip.id}>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle>{tip.title}</CardTitle>
                  <div className="flex gap-1">
                    <Button size="sm" variant="secondary" onClick={() => setDialog({ name: 'tip', editing: tip })}>
                      {t('diary.editTip')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmDelete({ table: 'tips_fh', id: tip.id })}
                    >
                      {t('agenda.delete')}
                    </Button>
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm">{tip.body}</p>
                <CardDescription className="mt-1">{authorName(tip.created_by)}</CardDescription>
              </Card>
            ))
          )}
        </div>
      )}

      {diary.status === 'ready' && tab === 'announcements' && (
        <div className="flex flex-col gap-3">
          {activeAnnouncements.length === 0 ? (
            <Card>
              <p className="text-sm text-muted-foreground">{t('diary.empty')}</p>
            </Card>
          ) : (
            activeAnnouncements.map((announcement) => {
              const expired =
                announcement.expires_at !== null && Date.parse(announcement.expires_at) <= now
              return (
                <Card
                  key={announcement.id}
                  className={announcement.pinned ? 'border-primary' : undefined}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <CardTitle>
                        {announcement.pinned ? '📌 ' : ''}
                        {announcement.title}
                      </CardTitle>
                      <CardDescription>
                        {expired ? t('diary.expired') : announcement.read ? '' : '● '}
                        {authorName(announcement.created_by)}
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void diary.markAnnouncementRead(announcement.id, !announcement.read)}
                      >
                        {announcement.read ? t('diary.markUnread') : t('diary.markRead')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDialog({ name: 'announcement', editing: announcement })}
                      >
                        {t('diary.editAnnouncement')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmDelete({ table: 'announcements_fh', id: announcement.id })}
                      >
                        {t('agenda.delete')}
                      </Button>
                    </div>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{announcement.body}</p>
                </Card>
              )
            })
          )}
        </div>
      )}

      {diary.status === 'ready' && tab === 'gossip' && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">{t('diary.gossipHint')}</p>
          {diary.gossip.length === 0 ? (
            <Card>
              <p className="text-sm text-muted-foreground">{t('diary.empty')}</p>
            </Card>
          ) : (
            diary.gossip.map((item) => (
              <Card key={item.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    {item.title && <CardTitle>{item.title}</CardTitle>}
                    <CardDescription>{authorName(item.owner_id ?? item.created_by)}</CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="secondary" onClick={() => setDialog({ name: 'gossip', editing: item })}>
                      {t('diary.editGossip')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmDelete({ table: 'gossip_fh', id: item.id })}
                    >
                      {t('agenda.delete')}
                    </Button>
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm">{item.body}</p>
              </Card>
            ))
          )}
        </div>
      )}

      {dialog?.name === 'post' && (
        <PostDialog
          initial={dialog.editing}
          busy={busy}
          error={serverError}
          onClose={() => setDialog(null)}
          diary={diary}
          setBusy={setBusy}
          setError={setServerError}
          onOfflineSave={(values) => tryEnqueueOffline('post.create', values)}
        />
      )}
      {dialog?.name === 'tip' && (
        <TipDialog
          initial={dialog.editing}
          busy={busy}
          error={serverError}
          onClose={() => setDialog(null)}
          onSave={async (values) => {
            if (!dialog.editing && tryEnqueueOffline('tip.create', values)) return
            setBusy(true)
            const result = dialog.editing
              ? await diary.update('tips_fh', dialog.editing.id, values)
              : await diary.insert('tips_fh', values)
            setBusy(false)
            if (result.error) setServerError(t('diary.saveError', { message: result.error }))
            else setDialog(null)
          }}
        />
      )}
      {dialog?.name === 'announcement' && (
        <AnnouncementDialog
          initial={dialog.editing}
          busy={busy}
          error={serverError}
          onClose={() => setDialog(null)}
          onSave={async (values) => {
            setBusy(true)
            const result = dialog.editing
              ? await diary.update('announcements_fh', dialog.editing.id, values)
              : await diary.insert('announcements_fh', values)
            setBusy(false)
            if (result.error) setServerError(t('diary.saveError', { message: result.error }))
            else setDialog(null)
          }}
        />
      )}
      {dialog?.name === 'gossip' && (
        <GossipDialog
          initial={dialog.editing}
          busy={busy}
          error={serverError}
          onClose={() => setDialog(null)}
          onSave={async (values) => {
            if (!dialog.editing && tryEnqueueOffline('gossip.create', values)) return
            setBusy(true)
            const result = dialog.editing
              ? await diary.update('gossip_fh', dialog.editing.id, values)
              : await diary.insert('gossip_fh', values)
            setBusy(false)
            if (result.error) setServerError(t('diary.saveError', { message: result.error }))
            else setDialog(null)
          }}
        />
      )}
      {dialog?.name === 'mood' && (
        <MoodDialog
          moods={diary.moods}
          busy={busy}
          error={serverError}
          onClose={() => setDialog(null)}
          onSave={async (moodId, note) => {
            setBusy(true)
            const result = await diary.logMood(moodId, note)
            setBusy(false)
            if (result.error) setServerError(t('diary.saveError', { message: result.error }))
            else setDialog(null)
          }}
        />
      )}

      {confirmDelete && (
        <Modal title={t('agenda.delete')} onClose={() => setConfirmDelete(null)}>
          <p className="mb-4 text-sm text-muted-foreground">{t('diary.deleteConfirm')}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmDelete(null)} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={busy}>
              {t('agenda.delete')}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
