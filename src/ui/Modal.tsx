import { useEffect, useRef, type ReactNode } from 'react'
import { useI18n } from '../i18n'
import { Button } from './Button'
import { cn } from '../lib/cn'

export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  const { t } = useI18n()
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      // Armadilha de foco: Tab circula dentro do diálogo.
      if (event.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])',
        )
        const enabled = [...focusables].filter(
          (element) => !element.hasAttribute('disabled') && element.offsetParent !== null,
        )
        if (enabled.length === 0) return
        const first = enabled[0] as HTMLElement
        const last = enabled[enabled.length - 1] as HTMLElement
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKey)
    dialogRef.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus()
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'max-h-[92dvh] w-full overflow-y-auto rounded-t-xl border border-border bg-card p-4 text-card-foreground sm:rounded-xl',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{title}</h2>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label={t('common.close')}>
            ✕
          </Button>
        </div>
        {children}
      </div>
    </div>
  )
}
