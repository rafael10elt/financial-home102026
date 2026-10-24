import { Button } from '../../ui/Button'
import { Modal } from '../../ui/Modal'

export type FinanceWidgetId = 'metrics' | 'flow' | 'categoryDonut' | 'accounts' | 'byCategory' | 'byPerson' | 'exchange'
export type FinanceWidgetLayout = { order: FinanceWidgetId[]; hidden: FinanceWidgetId[] }

export function DashboardWidgetsDialog<T extends string>({
  labels,
  title,
  description,
  resetLabel,
  doneLabel,
  showLabel,
  moveUpLabel,
  moveDownLabel,
  layout,
  onChange,
  onClose,
  onReset,
}: {
  labels: Record<T, string>
  title: string
  description: string
  resetLabel: string
  doneLabel: string
  showLabel: (name: string) => string
  moveUpLabel: (name: string) => string
  moveDownLabel: (name: string) => string
  layout: { order: T[]; hidden: T[] }
  onChange: (layout: { order: T[]; hidden: T[] }) => void
  onClose: () => void
  onReset: () => void
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="mb-4 text-sm text-muted-foreground">{description}</p>
      <ul className="flex flex-col divide-y divide-[var(--border)]">
        {layout.order.map((id, index) => (
          <li key={id} className="flex items-center gap-3 py-2">
            <input
              type="checkbox"
              checked={!layout.hidden.includes(id)}
              onChange={(event) => onChange({
                ...layout,
                hidden: event.target.checked ? layout.hidden.filter((widget) => widget !== id) : [...layout.hidden, id],
              })}
              aria-label={showLabel(labels[id])}
            />
            <span className="min-w-0 flex-1 text-sm">{labels[id]}</span>
            <Button size="sm" variant="secondary" disabled={index === 0} aria-label={moveUpLabel(labels[id])} onClick={() => {
              const order = [...layout.order]
              ;[order[index - 1], order[index]] = [order[index], order[index - 1]]
              onChange({ ...layout, order })
            }}>↑</Button>
            <Button size="sm" variant="secondary" disabled={index === layout.order.length - 1} aria-label={moveDownLabel(labels[id])} onClick={() => {
              const order = [...layout.order]
              ;[order[index + 1], order[index]] = [order[index], order[index + 1]]
              onChange({ ...layout, order })
            }}>↓</Button>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex justify-between gap-2">
        <Button variant="ghost" onClick={onReset}>{resetLabel}</Button>
        <Button variant="primary" onClick={onClose}>{doneLabel}</Button>
      </div>
    </Modal>
  )
}
