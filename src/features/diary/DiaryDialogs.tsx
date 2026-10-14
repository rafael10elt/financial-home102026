import { useState, type FormEvent, type ReactNode } from 'react'
import { useI18n } from '../../i18n'
import { parseTags, SUGGESTED_TAGS } from '../../diary/feed'
import type { useDiaryData } from '../../diary/useDiary'
import { Button } from '../../ui/Button'
import { Field, Input } from '../../ui/Input'
import { Modal } from '../../ui/Modal'

const inputClass =
  'h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground'

function Shell({
  title,
  onClose,
  busy,
  error,
  onSubmit,
  children,
}: {
  title: string
  onClose: () => void
  busy: boolean
  error: string | null
  onSubmit: (event: FormEvent) => void
  children: ReactNode
}) {
  const { t } = useI18n()
  return (
    <Modal title={title} onClose={onClose} wide>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {children}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? t('common.loading') : t('common.save')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

type Member = { user_id: string; display_name: string | null }

function VisibilityOwner({
  visibility,
  ownerId,
  members,
  onVisibility,
  onOwner,
}: {
  visibility: 'shared' | 'personal'
  ownerId: string
  members: Member[]
  onVisibility: (value: 'shared' | 'personal') => void
  onOwner: (value: string) => void
}) {
  const { t } = useI18n()
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label={t('agenda.visibility')}>
        {(aria) => (
          <select
            {...aria}
            value={visibility}
            onChange={(e) => onVisibility(e.target.value as 'shared' | 'personal')}
            className={inputClass}
          >
            <option value="shared">{t('agenda.visibility.shared')}</option>
            <option value="personal">{t('agenda.visibility.personal')}</option>
          </select>
        )}
      </Field>
      <Field label={t('fin.owner')}>
        {(aria) => (
          <select {...aria} value={ownerId} onChange={(e) => onOwner(e.target.value)} className={inputClass}>
            <option value="">{t('fin.unassigned')}</option>
            {members.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {member.display_name ?? member.user_id.slice(0, 8)}
              </option>
            ))}
          </select>
        )}
      </Field>
    </div>
  )
}

export function PostDialog({
  initial,
  busy,
  error,
  onClose,
  diary,
  setBusy,
  setError,
  onOfflineSave,
}: {
  initial: {
    id: string
    title: string | null
    body: string
    memory_date: string
    tags: string[]
    visibility: 'shared' | 'personal'
    owner_id: string | null
  } | null
  busy: boolean
  error: string | null
  onClose: () => void
  diary: ReturnType<typeof useDiaryData>
  setBusy: (value: boolean) => void
  setError: (value: string | null) => void
  onOfflineSave: (values: Record<string, unknown>) => boolean
}) {
  const { t } = useI18n()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [memoryDate, setMemoryDate] = useState(
    initial?.memory_date ?? new Date().toISOString().slice(0, 10),
  )
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '))
  const [visibility, setVisibility] = useState<'shared' | 'personal'>(initial?.visibility ?? 'shared')
  const [ownerId, setOwnerId] = useState(initial?.owner_id ?? '')
  const [formError, setFormError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!body.trim() || !memoryDate) {
      setFormError(t('common.required'))
      return
    }
    const values = {
      title: title.trim() || null,
      body: body.trim(),
      memory_date: memoryDate,
      tags: parseTags(tags),
      visibility,
      owner_id: ownerId || null,
    }
    // Offline e criação nova: rascunho de texto (fotos entram quando online).
    if (!initial && onOfflineSave(values)) return
    setBusy(true)
    const result = initial
      ? await diary.update('posts_fh', initial.id, values)
      : await diary.insert('posts_fh', values)
    setBusy(false)
    if (result.error) {
      setError(t('diary.saveError', { message: result.error }))
      return
    }
    onClose()
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || !initial) return
    setUploading(true)
    for (const file of Array.from(files).slice(0, 5)) {
      const result = await diary.addPostMedia(initial.id, file)
      if (result.error) {
        setError(t('diary.uploadError', { message: result.error }))
        break
      }
    }
    setUploading(false)
  }

  return (
    <Shell
      title={initial ? t('diary.editPost') : t('diary.newPost')}
      onClose={onClose}
      busy={busy || uploading}
      error={formError ?? error}
      onSubmit={(e) => void submit(e)}
    >
      <Field label={t('diary.postTitle')}>
        {(aria) => <Input {...aria} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />}
      </Field>
      <Field label={t('diary.postBody')}>
        {(aria) => (
          <textarea
            {...aria}
            value={body}
            rows={4}
            maxLength={10000}
            onChange={(e) => setBody(e.target.value)}
            className={`${inputClass} h-auto py-2`}
          />
        )}
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t('diary.memoryDate')}>
          {(aria) => <Input {...aria} type="date" value={memoryDate} onChange={(e) => setMemoryDate(e.target.value)} />}
        </Field>
        <Field label={t('diary.tags')} hint={t('diary.tagsHint')}>
          {(aria) => (
            <Input
              {...aria}
              value={tags}
              placeholder={SUGGESTED_TAGS.join(', ')}
              onChange={(e) => setTags(e.target.value)}
            />
          )}
        </Field>
      </div>
      <VisibilityOwner
        visibility={visibility}
        ownerId={ownerId}
        members={[]}
        onVisibility={setVisibility}
        onOwner={setOwnerId}
      />
      {initial ? (
        <Field label={t('diary.photos')} hint={t('diary.photoHint')}>
          {(aria) => (
            <Input
              {...aria}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={(e) => void handleFiles(e.target.files)}
            />
          )}
        </Field>
      ) : (
        <p className="text-xs text-muted-foreground">{t('diary.photoHint')}</p>
      )}
    </Shell>
  )
}

export function TipDialog({
  initial,
  busy,
  error,
  onClose,
  onSave,
}: {
  initial: { title: string; body: string; visibility: 'shared' | 'personal'; owner_id: string | null } | null
  busy: boolean
  error: string | null
  onClose: () => void
  onSave: (values: Record<string, unknown>) => Promise<void>
}) {
  const { t } = useI18n()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [visibility, setVisibility] = useState<'shared' | 'personal'>(initial?.visibility ?? 'shared')
  const [ownerId, setOwnerId] = useState(initial?.owner_id ?? '')
  const [formError, setFormError] = useState<string | null>(null)

  return (
    <Shell
      title={initial ? t('diary.editTip') : t('diary.newTip')}
      onClose={onClose}
      busy={busy}
      error={formError ?? error}
      onSubmit={(e) => {
        e.preventDefault()
        if (!title.trim() || !body.trim()) {
          setFormError(t('common.required'))
          return
        }
        void onSave({ title: title.trim(), body: body.trim(), visibility, owner_id: ownerId || null })
      }}
    >
      <Field label={t('diary.tipTitle')}>
        {(aria) => <Input {...aria} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />}
      </Field>
      <Field label={t('diary.tipBody')}>
        {(aria) => (
          <textarea
            {...aria}
            value={body}
            rows={3}
            maxLength={5000}
            onChange={(e) => setBody(e.target.value)}
            className={`${inputClass} h-auto py-2`}
          />
        )}
      </Field>
      <VisibilityOwner
        visibility={visibility}
        ownerId={ownerId}
        members={[]}
        onVisibility={setVisibility}
        onOwner={setOwnerId}
      />
    </Shell>
  )
}

export function AnnouncementDialog({
  initial,
  busy,
  error,
  onClose,
  onSave,
}: {
  initial: { title: string; body: string; pinned: boolean; expires_at: string | null } | null
  busy: boolean
  error: string | null
  onClose: () => void
  onSave: (values: Record<string, unknown>) => Promise<void>
}) {
  const { t } = useI18n()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [pinned, setPinned] = useState(initial?.pinned ?? false)
  const [expiresAt, setExpiresAt] = useState(
    initial?.expires_at ? initial.expires_at.slice(0, 16) : '',
  )
  const [formError, setFormError] = useState<string | null>(null)

  return (
    <Shell
      title={initial ? t('diary.editAnnouncement') : t('diary.newAnnouncement')}
      onClose={onClose}
      busy={busy}
      error={formError ?? error}
      onSubmit={(e) => {
        e.preventDefault()
        if (!title.trim() || !body.trim()) {
          setFormError(t('common.required'))
          return
        }
        void onSave({
          title: title.trim(),
          body: body.trim(),
          pinned,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        })
      }}
    >
      <Field label={t('diary.tipTitle')}>
        {(aria) => <Input {...aria} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />}
      </Field>
      <Field label={t('diary.tipBody')}>
        {(aria) => (
          <textarea
            {...aria}
            value={body}
            rows={3}
            maxLength={5000}
            onChange={(e) => setBody(e.target.value)}
            className={`${inputClass} h-auto py-2`}
          />
        )}
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          {t('diary.pin')}
        </label>
        <Field label={t('diary.expiresAt')}>
          {(aria) => (
            <Input
              {...aria}
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          )}
        </Field>
      </div>
    </Shell>
  )
}

export function GossipDialog({
  initial,
  busy,
  error,
  onClose,
  onSave,
}: {
  initial: { title: string | null; body: string; owner_id: string | null } | null
  busy: boolean
  error: string | null
  onClose: () => void
  onSave: (values: Record<string, unknown>) => Promise<void>
}) {
  const { t } = useI18n()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [formError, setFormError] = useState<string | null>(null)

  return (
    <Shell
      title={initial ? t('diary.editGossip') : t('diary.newGossip')}
      onClose={onClose}
      busy={busy}
      error={formError ?? error}
      onSubmit={(e) => {
        e.preventDefault()
        if (!body.trim()) {
          setFormError(t('common.required'))
          return
        }
        void onSave({ title: title.trim() || null, body: body.trim() })
      }}
    >
      <p className="text-xs text-muted-foreground">{t('diary.gossipHint')}</p>
      <Field label={t('diary.postTitle')}>
        {(aria) => <Input {...aria} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />}
      </Field>
      <Field label={t('diary.postBody')}>
        {(aria) => (
          <textarea
            {...aria}
            value={body}
            rows={3}
            maxLength={5000}
            onChange={(e) => setBody(e.target.value)}
            className={`${inputClass} h-auto py-2`}
          />
        )}
      </Field>
    </Shell>
  )
}

export function MoodDialog({
  moods,
  busy,
  error,
  onClose,
  onSave,
}: {
  moods: { id: string; name: string; emoji: string }[]
  busy: boolean
  error: string | null
  onClose: () => void
  onSave: (moodId: string, note: string | null) => Promise<void>
}) {
  const { t } = useI18n()
  const [moodId, setMoodId] = useState(moods[0]?.id ?? '')
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  return (
    <Shell
      title={t('diary.moodSave')}
      onClose={onClose}
      busy={busy}
      error={formError ?? error}
      onSubmit={(e) => {
        e.preventDefault()
        if (!moodId) {
          setFormError(t('common.required'))
          return
        }
        void onSave(moodId, note.trim() || null)
      }}
    >
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('diary.moodToday')}>
        {moods.map((mood) => (
          <button
            key={mood.id}
            type="button"
            role="radio"
            aria-checked={moodId === mood.id}
            onClick={() => setMoodId(mood.id)}
            className={
              moodId === mood.id
                ? 'flex flex-col items-center gap-1 rounded-md border border-primary bg-accent px-2 py-2 text-sm font-medium'
                : 'flex flex-col items-center gap-1 rounded-md border border-border px-2 py-2 text-sm text-muted-foreground hover:bg-muted'
            }
          >
            <span className="text-2xl" aria-hidden="true">
              {mood.emoji}
            </span>
            <span className="text-xs">{mood.name}</span>
          </button>
        ))}
      </div>
      <Field label={t('diary.moodNote')}>
        {(aria) => (
          <Input {...aria} value={note} maxLength={280} onChange={(e) => setNote(e.target.value)} />
        )}
      </Field>
    </Shell>
  )
}
