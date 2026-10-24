import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/context'
import { useHousehold } from '../household/context'
import { useI18n } from '../i18n'
import { Button } from './Button'
import { Card, CardTitle } from './Card'
import { Modal } from './Modal'
import { useToast } from './toastContext'

type GroceryItem = { id: string; name: string; is_checked: boolean; created_at: string }

export function GroceryListWidget() {
  const { t } = useI18n()
  const { supabase, user } = useAuth()
  const { state: householdState } = useHousehold()
  const { notify } = useToast()
  const householdId = householdState.kind === 'ready' ? householdState.household.id : null
  const [items, setItems] = useState<GroceryItem[]>([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const lastLoadError = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase || !householdId) { setItems([]); setLoading(false); return }
    const { data, error } = await supabase.from('grocery_items_fh').select('id,name,is_checked,created_at').eq('household_id', householdId).order('created_at', { ascending: true })
    if (error) {
      setLoadError(true)
      if (lastLoadError.current !== error.message) {
        lastLoadError.current = error.message
        notify('error', t('overview.grocery.title'), t('overview.grocery.loadError', { message: error.message }))
      }
      setLoading(false)
      return
    }
    lastLoadError.current = null
    setLoadError(false)
    setItems((data ?? []) as GroceryItem[])
    setLoading(false)
  }, [householdId, notify, supabase, t])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 12_000)
    return () => window.clearInterval(timer)
  }, [refresh])

  async function addItem(event: FormEvent) {
    event.preventDefault()
    const cleanName = name.trim().slice(0, 120)
    if (!cleanName || !supabase || !householdId || !user) return
    setBusy(true)
    const { error } = await supabase.from('grocery_items_fh').insert({ household_id: householdId, name: cleanName, created_by: user.id })
    setBusy(false)
    if (error) { notify('error', t('overview.grocery.title'), t('overview.grocery.saveError', { message: error.message })); return }
    setName('')
    await refresh()
    notify('success', t('overview.grocery.title'), t('overview.grocery.added'))
  }

  async function toggle(item: GroceryItem) {
    if (!supabase || !householdId) return
    const { error } = await supabase.from('grocery_items_fh').update({ is_checked: !item.is_checked }).eq('id', item.id).eq('household_id', householdId)
    if (error) { notify('error', t('overview.grocery.title'), t('overview.grocery.saveError', { message: error.message })); return }
    setItems((current) => current.map((row) => row.id === item.id ? { ...row, is_checked: !row.is_checked } : row))
  }

  async function clearChecked() {
    if (!supabase || !householdId) return
    setBusy(true)
    const { error } = await supabase.from('grocery_items_fh').delete().eq('household_id', householdId).eq('is_checked', true)
    setBusy(false)
    setConfirmClear(false)
    if (error) { notify('error', t('overview.grocery.title'), t('overview.grocery.deleteError', { message: error.message })); return }
    await refresh()
    notify('success', t('overview.grocery.title'), t('overview.grocery.cleared'))
  }

  const checkedCount = items.filter((item) => item.is_checked).length
  return (
    <>
      <Card>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{t('overview.grocery.title')}</CardTitle>
          {checkedCount > 0 && <Button size="sm" variant="secondary" disabled={busy} onClick={() => setConfirmClear(true)}>{t('overview.grocery.clearChecked', { count: checkedCount })}</Button>}
        </div>
        <form className="mt-3 flex gap-2" onSubmit={(event) => void addItem(event)}>
          <input className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm" maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder={t('overview.grocery.placeholder')} aria-label={t('overview.grocery.placeholder')} />
          <Button type="submit" aria-label={t('overview.grocery.add')} disabled={busy || !name.trim()}>＋</Button>
        </form>
        {loadError && <p className="mt-3 text-sm text-destructive" role="alert">{t('overview.grocery.unavailable')}</p>}
        {loading ? <p className="mt-3 text-sm text-muted-foreground">{t('common.loading')}</p> : loadError ? null : items.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{t('overview.grocery.empty')}</p> : (
          <ul className="mt-3 flex flex-col divide-y divide-[var(--border)]">
            {items.map((item) => <li key={item.id} className="flex items-center gap-3 py-2 text-sm">
              <input type="checkbox" checked={item.is_checked} onChange={() => void toggle(item)} aria-label={t('overview.grocery.markItem', { name: item.name })} />
              <span className={`min-w-0 flex-1 break-words ${item.is_checked ? 'text-muted-foreground line-through' : ''}`}>{item.name}</span>
            </li>)}
          </ul>
        )}
      </Card>
      {confirmClear && <Modal title={t('overview.grocery.clearTitle')} onClose={() => setConfirmClear(false)}>
        <p className="text-sm text-muted-foreground">{t('overview.grocery.clearConfirm', { count: checkedCount })}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmClear(false)}>{t('common.cancel')}</Button>
          <Button variant="destructive" disabled={busy} onClick={() => void clearChecked()}>{t('overview.grocery.clearAction')}</Button>
        </div>
      </Modal>}
    </>
  )
}
