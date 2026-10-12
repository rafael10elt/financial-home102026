import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { AuthProvider } from '../auth/AuthProvider'
import { HouseholdProvider } from '../household/HouseholdProvider'
import { I18nProvider } from '../i18n'

function renderApp() {
  return render(
    <I18nProvider>
      <AuthProvider>
        <HouseholdProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </HouseholdProvider>
      </AuthProvider>
    </I18nProvider>,
  )
}

describe('App', () => {
  it('mostra o estado real de Supabase não configurado (não simula dados)', async () => {
    renderApp()
    expect(await screen.findByText('Configuração pendente')).toBeInTheDocument()
    expect(screen.getByText(/VITE_SUPABASE_URL/)).toBeInTheDocument()
    // Nenhum dado financeiro fictício é exibido.
    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument()
    expect(screen.queryByText(/€\s?\d/)).not.toBeInTheDocument()
  })
})
