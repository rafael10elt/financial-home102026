import { useCallback, useEffect, useState } from 'react'
import type { Quote } from './reports'

type RatesResponse = { base: string; date: string; rates: Record<string, number> }
type LiveRateState = { rates: Record<string, number>; date: string; loading: boolean; error: string | null }
const CACHE_KEY = 'fh.finance.live-rates.v1'
const MAX_AGE = 12 * 60 * 60 * 1000

export function useLiveRates() {
  const [state, setState] = useState<LiveRateState>({ rates: {}, date: '', loading: true, error: null })

  const refresh = useCallback(async (force = false) => {
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached) as { savedAt: number; data: RatesResponse }
        if (parsed.data?.rates && parsed.data.date) {
          setState({ rates: parsed.data.rates, date: parsed.data.date, loading: false, error: null })
          if (!force && Date.now() - parsed.savedAt < MAX_AGE) return
        }
      }
      setState((current) => ({ ...current, loading: true, error: null }))
      const response = await fetch('https://api.frankfurter.dev/v1/latest?base=EUR&symbols=GBP,BRL,USD', { cache: 'no-store' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = (await response.json()) as RatesResponse
      if (!data.date || !data.rates || typeof data.rates.GBP !== 'number') throw new Error('Resposta inválida da API')
      localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }))
      setState({ rates: data.rates, date: data.date, loading: false, error: null })
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      }))
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(true), MAX_AGE)
    return () => window.clearInterval(timer)
  }, [refresh])

  const quotes = Object.entries(state.rates).reduce<Record<string, Quote>>((all, [target, rate]) => {
    all[`EUR->${target}`] = { base: 'EUR', target, rate, source: 'Frankfurter · referência diária', fetchedAt: state.date, manual: false }
    return all
  }, {})

  return { ...state, quotes, refresh: () => refresh(true) }
}
