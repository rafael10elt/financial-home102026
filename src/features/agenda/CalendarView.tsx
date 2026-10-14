import { useMemo, useState } from 'react'
import { Button } from '../../ui/Button'
import { cn } from '../../lib/cn'

function startOfMonthCursor(year: number, month: number): Date {
  return new Date(year, month, 1)
}

export function CalendarView({
  marks,
  selected,
  onSelect,
}: {
  marks: Map<string, number>
  selected: string
  onSelect: (isoDate: string) => void
}) {
  const initial = selected ? new Date(`${selected}T12:00:00`) : new Date()
  const [cursor, setCursor] = useState(() => startOfMonthCursor(initial.getFullYear(), initial.getMonth()))

  const cells = useMemo(() => {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    // Semana começa na segunda-feira.
    const first = new Date(year, month, 1)
    const lead = (first.getDay() + 6) % 7
    const start = new Date(year, month, 1 - lead)
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
      const pad = (n: number) => String(n).padStart(2, '0')
      const iso = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
      return { iso, day: date.getDate(), outside: date.getMonth() !== month }
    })
  }, [cursor])

  const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(cursor)
  const weekdayLabels = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']

  function move(delta: number) {
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Button size="sm" variant="secondary" onClick={() => move(-1)} aria-label="Mês anterior">
          ‹
        </Button>
        <span className="text-sm font-medium capitalize">{monthLabel}</span>
        <Button size="sm" variant="secondary" onClick={() => move(1)} aria-label="Próximo mês">
          ›
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1" role="grid" aria-label={monthLabel}>
        {weekdayLabels.map((label, index) => (
          <div key={index} className="py-1 text-center text-xs text-muted-foreground" aria-hidden="true">
            {label}
          </div>
        ))}
        {cells.map((cell) => {
          const count = marks.get(cell.iso) ?? 0
          const isSelected = cell.iso === selected
          return (
            <button
              key={cell.iso}
              type="button"
              role="gridcell"
              aria-selected={isSelected}
              aria-label={`${cell.iso}${count > 0 ? ` (${count})` : ''}`}
              onClick={() => onSelect(cell.iso)}
              className={cn(
                'relative flex min-h-10 flex-col items-center justify-center rounded-md border px-1 py-1 text-sm',
                cell.outside ? 'text-muted-foreground/50' : '',
                isSelected
                  ? 'border-primary bg-accent font-semibold'
                  : 'border-border hover:bg-muted',
              )}
            >
              <span>{cell.day}</span>
              {count > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-1 size-1.5 rounded-full bg-primary"
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
