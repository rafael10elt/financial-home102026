import { createContext, useContext } from 'react'

export type ToastKind = 'success' | 'error' | 'info'
export type ToastMessage = { id: number; kind: ToastKind; title: string; detail?: string }
export type ToastContextValue = { notify: (kind: ToastKind, title: string, detail?: string) => void }

export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast deve ser usado dentro de ToastProvider')
  return context
}
