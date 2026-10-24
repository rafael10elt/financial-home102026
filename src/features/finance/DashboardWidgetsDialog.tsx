import { useState } from 'react'
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
  dragLabel,
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
  dragLabel: (name: string) => string
  layout: { order: T[]; hidden: T[] }
  onChange: (layout: { order: T[]; hidden: T[] }) => void
  onClose: () => void
  onReset: () => void
}) {
  const [dragging, setDragging] = useState<T | null>(null)

  function move(draggedId: T, targetId: T) {
    if (draggedId === targetId) return
    const order = [...layout.order]
    const from = order.indexOf(draggedId)
    const to = order.indexOf(targetId)
    if (from < 0 || to < 0) return
    order.splice(from, 1)
    order.splice(to, 0, draggedId)
    onChange({ ...layout, order })
  }

  return (
    <Modal title={title} onClose={onClose}>
      <p className="mb-4 text-sm text-muted-foreground">{description}</p>
      <ul className="flex flex-col divide-y divide-[var(--border)]">
        {layout.order.map((id) => (
          <li
            key={id}
            draggable
            onDragStart={(event) => {
              setDragging(id)
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', id)
            }}
            onDragOver={(event) => {
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
            }}
            onDrop={(event) => {
              event.preventDefault()
              const source = (event.dataTransfer.getData('text/plain') || dragging) as T | null
              if (source) move(source, id)
              setDragging(null)
            }}
            onDragEnd={() => setDragging(null)}
            className={`flex cursor-grab items-center gap-3 py-2 active:cursor-grabbing ${dragging === id ? 'opacity-50' : ''}`}
          >
            <span className="select-none text-muted-foreground" aria-hidden="true">⠿</span>
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
            <span className="sr-only">{dragLabel(labels[id])}</span>
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
