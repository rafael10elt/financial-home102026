import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './app/App'
import { AuthProvider } from './auth/AuthProvider'
import { HouseholdProvider } from './household/HouseholdProvider'
import { I18nProvider } from './i18n'
import { PreferencesHydrator } from './preferences/PreferencesHydrator'
import { applyPreferencesToDom, usePreferences } from './preferences/store'
import { ToastProvider } from './ui/ToastProvider'
import './styles/index.css'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Elemento #root não encontrado')

// Aplica as preferências locais imediatamente (além do script anti-flash).
applyPreferencesToDom(usePreferences.getState())

// Reage a mudanças de sistema quando o tema está em "system".
window
  .matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', () => {
    const state = usePreferences.getState()
    if (state.theme === 'system') applyPreferencesToDom(state)
  })

createRoot(rootElement).render(
  <StrictMode>
    <ToastProvider>
      <I18nProvider>
        <AuthProvider>
          <HouseholdProvider>
            <PreferencesHydrator />
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </HouseholdProvider>
        </AuthProvider>
      </I18nProvider>
    </ToastProvider>
  </StrictMode>,
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.warn('Falha ao registrar o service worker:', error)
    })
  })
}
