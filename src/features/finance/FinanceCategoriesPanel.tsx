import { useState, type FormEvent } from 'react'
import { useToast } from '../../ui/toastContext'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { Field, Input } from '../../ui/Input'
import { Modal } from '../../ui/Modal'
import { useI18n } from '../../i18n'
import type { FinanceCategory, FinanceMerchant } from '../../finance/useFinance'

type FormState =
  | { type: 'category'; id: string | null; name: string; kind: string }
  | { type: 'merchant'; id: string | null; categoryId: string; name: string }
  | null
type DeleteTarget = { type: 'category'; id: string; name: string } | { type: 'merchant'; id: string; name: string } | null

export function FinanceCategoriesPanel({
  categories,
  merchants,
  saveCategory,
  removeCategory,
  saveMerchant,
  removeMerchant,
}: {
  categories: FinanceCategory[]
  merchants: FinanceMerchant[]
  saveCategory: (id: string | null, name: string, kind: string) => Promise<string | null>
  removeCategory: (id: string) => Promise<string | null>
  saveMerchant: (id: string | null, categoryId: string, name: string) => Promise<string | null>
  removeMerchant: (id: string) => Promise<string | null>
}) {
  const { t } = useI18n()
  const { notify } = useToast()
  const [form, setForm] = useState<FormState>(null)
  const [deleting, setDeleting] = useState<DeleteTarget>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!form || !form.name.trim()) return
    setBusy(true)
    const error = form.type === 'category'
      ? await saveCategory(form.id, form.name.trim(), form.kind)
      : await saveMerchant(form.id, form.categoryId, form.name.trim())
    setBusy(false)
    if (error) {
      notify('error', t('fin.manage.saveFailed'), error)
      return
    }
    notify('success', form.type === 'category' ? t('fin.categories.saved') : t('fin.merchants.saved'))
    setForm(null)
  }

  async function confirmDelete() {
    if (!deleting) return
    setBusy(true)
    const error = deleting.type === 'category'
      ? await removeCategory(deleting.id)
      : await removeMerchant(deleting.id)
    setBusy(false)
    if (error) {
      notify('error', t('fin.manage.deleteFailed'), error)
      return
    }
    notify('success', deleting.type === 'category' ? t('fin.categories.deleted') : t('fin.merchants.deleted'))
    setDeleting(null)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t('fin.categories.description')}</p>
        <Button size="sm" onClick={() => setForm({ type: 'category', id: null, name: '', kind: 'expense' })}>
          {t('fin.categories.new')}
        </Button>
      </div>
      {categories.length === 0 && <Card><p className="text-sm text-muted-foreground">{t('fin.categories.none')}</p></Card>}
      {categories.map((category) => {
        const categoryMerchants = merchants.filter((merchant) => merchant.category_id === category.id)
        return (
          <Card key={category.id} className="min-w-0">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 className="break-words font-semibold">{category.name}</h2>
                <p className="text-xs text-muted-foreground">{category.kind === 'income' ? t('fin.categories.income') : t('fin.categories.expense')}</p>
                {categoryMerchants.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {categoryMerchants.map((merchant) => (
                      <li key={merchant.id} className="inline-flex max-w-full items-center gap-1 rounded-full border border-border px-2 py-1 text-xs">
                        <span className="break-words">{merchant.name}</span>
                        <button type="button" className="rounded px-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label={`Editar ${merchant.name}`} onClick={() => setForm({ type: 'merchant', id: merchant.id, categoryId: category.id, name: merchant.name })}>✎</button>
                        <button type="button" className="rounded px-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                          aria-label={`Excluir ${merchant.name}`} onClick={() => setDeleting({ type: 'merchant', id: merchant.id, name: merchant.name })}>×</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => setForm({ type: 'merchant', id: null, categoryId: category.id, name: '' })}>{t('fin.merchants.new')}</Button>
                <Button size="sm" variant="ghost" onClick={() => setForm({ type: 'category', id: category.id, name: category.name, kind: category.kind ?? 'expense' })}>{t('fin.categories.edit')}</Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleting({ type: 'category', id: category.id, name: category.name })}>{t('fin.categories.delete')}</Button>
              </div>
            </div>
          </Card>
        )
      })}

      {form && (
        <Modal title={form.type === 'category' ? (form.id ? t('fin.categories.edit') : t('fin.categories.new')) : (form.id ? t('fin.merchants.edit') : t('fin.merchants.new'))} onClose={() => !busy && setForm(null)}>
          <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
            {form.type === 'merchant' && <p className="text-sm text-muted-foreground">{t('fin.category')}: {categories.find((item) => item.id === form.categoryId)?.name}</p>}
            <Field label={form.type === 'category' ? t('fin.categories.name') : t('fin.merchants.name')}>
              {(aria) => <Input {...aria} autoFocus maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />}
            </Field>
            {form.type === 'category' && (
              <Field label={t('fin.categories.type')}>
                {(aria) => (
                  <select {...aria} value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}
                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground">
                    <option value="expense">{t('fin.categories.expense')}</option><option value="income">{t('fin.categories.income')}</option>
                  </select>
                )}
              </Field>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setForm(null)} disabled={busy}>{t('fin.manage.cancel')}</Button>
              <Button type="submit" disabled={busy || !form.name.trim()}>{busy ? t('fin.manage.saving') : t('fin.manage.save')}</Button>
            </div>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal title={t('fin.manage.confirmDelete')} onClose={() => !busy && setDeleting(null)}>
          <p className="text-sm text-muted-foreground">{t('fin.manage.deletePrompt', { name: deleting.name })}</p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleting(null)} disabled={busy}>{t('fin.manage.cancel')}</Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={busy}>{t('fin.manage.delete')}</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
