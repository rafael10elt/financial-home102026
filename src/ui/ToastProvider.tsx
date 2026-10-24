import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { Button } from './Button'

type ToastKind = 'success' | 'error' | 'info'
type ToastMessage = { id: number; kind: ToastKind; title: string; detail?: string }
type ToastContextValue = { notify: (kind: ToastKind, title: string, detail?: string) => void }

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastMessage[]>([])
  const notify = useCallback((kind: ToastKind, title: string, detail?: string) => {
    const id = Date.now() + Math.random()
    setItems((current) => [...current.slice(-3), { id, kind, title, detail }])
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 5000)
  }, [])
  const dismiss = (id: number) => setItems((current) => current.filter((item) => item.id !== id))

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="fixed right-3 top-3 z-[100] flex w-[min(24rem,calc(100vw-1.5rem))] flex-col gap-2" aria-live="polite" aria-relevant="additions">
        {items.map((item) => (
          <div key={item.id} role={item.kind === 'error' ? 'alert' : 'status'}
            className={`rounded-lg border bg-card p-3 text-card-foreground shadow-lg ${item.kind === 'error' ? 'border-destructive' : 'border-border'}`}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{item.title}</p>
                {item.detail && <p className="mt-1 break-words text-xs text-muted-foreground">{item.detail}</p>}
              </div>
              <Button size="sm" variant="ghost" onClick={() => dismiss(item.id)} aria-label="Fechar notificação">✕</Button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast deve ser usado dentro de ToastProvider')
  return context
}
