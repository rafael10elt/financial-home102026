/**
 * Cálculos do medidor de energia elétrica.
 *
 * O consumo é a diferença entre a leitura atual e a inicial (kWh). O custo é
 * calculado em unidades inteiras (mili-kWh × micro-moeda) para não acumular
 * erro de ponto flutuante, seguindo a mesma regra de `finance/money.ts`.
 */

export type EnergyReading = {
  /** Data da leitura no formato YYYY-MM-DD. */
  date: string
  /** Leitura acumulada do medidor em kWh. */
  reading: number
}

export type EnergyConfig = {
  currency: string
  pricePerKwh: number
  fixedFee: number
  initialReading: number
  currentReading: number
  cycleStart: string
  /** Duração do ciclo de fatura em meses (1 = mensal, 2 = bimestral...). */
  cycleMonths: number
  readings: EnergyReading[]
}

export type EnergyEstimate = {
  /** Consumo desde o início do ciclo (kWh). */
  consumptionKwh: number
  /** Custo do consumo atual, já com a taxa fixa (centavos). */
  costMinor: number
  /** Média diária desde o início do ciclo (kWh). */
  dailyAverageKwh: number
  /** Consumo projetado para o ciclo completo (kWh). */
  projectedKwh: number
  /** Conta projetada para o ciclo completo (centavos). */
  projectedCostMinor: number
  /** Início e fim (estimado) do ciclo. */
  cycleStart: string
  cycleEnd: string
  cycleDays: number
  daysElapsed: number
  daysLeft: number
  /** Percentual do ciclo já percorrido (0–100). */
  percent: number
}

const DAY_MS = 86_400_000

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** Converte texto (aceita vírgula) ou número em número finito; inválido vira 0. */
export function parseDecimal(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (!value) return 0
  const parsed = Number(value.trim().replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

/** Data local no formato YYYY-MM-DD. */
export function toDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Primeiro dia do mês de uma data local. */
export function monthStartKey(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-01`
}

function dateKeyToUtc(key: string): number {
  const [year, month, day] = key.split('-').map(Number)
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1)
}

function utcToDateKey(time: number): string {
  const date = new Date(time)
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

/** Soma meses preservando o dia (31/01 + 1 mês = 28/02). */
export function addMonthsKey(key: string, months: number): string {
  const [year, month, day] = key.split('-').map(Number)
  if (!year || !month || !day) return key
  const target = new Date(Date.UTC(year, month - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  return `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(Math.min(day, lastDay))}`
}

/** Último dia do ciclo que começa em `cycleStart` (1 mês por padrão). */
export function cycleEndKey(cycleStart: string, months = 1): string {
  return utcToDateKey(dateKeyToUtc(addMonthsKey(cycleStart, Math.max(1, Math.round(months)))) - DAY_MS)
}

/** Diferença em dias entre duas datas (b - a). */
export function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((dateKeyToUtc(toKey) - dateKeyToUtc(fromKey)) / DAY_MS)
}

function toScaled(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 10 ** decimals)
}

/** Custo em centavos: (kWh × tarifa) + taxa fixa. */
export function energyCostMinor(kwh: number, pricePerKwh: number, fixedFee: number): number {
  const kwhMilli = toScaled(Math.max(0, kwh), 3)
  const priceMicro = toScaled(Math.max(0, pricePerKwh), 6)
  const feeMinor = toScaled(Math.max(0, fixedFee), 2)
  return Math.round((kwhMilli * priceMicro) / 10_000_000) + feeMinor
}

/**
 * Consolida consumo e projeção do ciclo. `todayKey` permite testar a projeção
 * sem depender do relógio da máquina.
 */
export function computeEnergyEstimate(config: EnergyConfig, todayKey = toDateKey()): EnergyEstimate {
  const consumptionKwh = Math.max(0, config.currentReading - config.initialReading)
  const cycleMonths = Math.max(1, Math.round(config.cycleMonths || 1))
  const end = cycleEndKey(config.cycleStart, cycleMonths)
  const cycleDays = Math.max(1, daysBetween(config.cycleStart, end) + 1)
  const rawElapsed = daysBetween(config.cycleStart, todayKey) + 1
  const daysElapsed = Math.min(cycleDays, Math.max(0, rawElapsed))
  const daysLeft = Math.max(0, cycleDays - daysElapsed)
  const dailyAverageKwh = daysElapsed > 0 ? consumptionKwh / daysElapsed : 0
  const projectedKwh = daysElapsed >= cycleDays ? consumptionKwh : dailyAverageKwh * cycleDays
  return {
    consumptionKwh,
    costMinor: energyCostMinor(consumptionKwh, config.pricePerKwh, config.fixedFee),
    dailyAverageKwh,
    projectedKwh,
    projectedCostMinor: energyCostMinor(projectedKwh, config.pricePerKwh, config.fixedFee),
    cycleStart: config.cycleStart,
    cycleEnd: end,
    cycleDays,
    daysElapsed,
    daysLeft,
    percent: Math.min(100, Math.max(0, Math.round((daysElapsed / cycleDays) * 100))),
  }
}

/** Consumo entre leituras consecutivas, em ordem cronológica. */
export function readingDeltas(readings: EnergyReading[]): { date: string; kwh: number }[] {
  const sorted = [...readings].sort((a, b) => a.date.localeCompare(b.date))
  const result: { date: string; kwh: number }[] = []
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]
    const current = sorted[index]
    if (!previous || !current) continue
    const kwh = current.reading - previous.reading
    if (kwh > 0) result.push({ date: current.date, kwh })
  }
  return result
}

/** Normaliza o JSON salvo no banco, descartando entradas inválidas. */
export function normalizeReadings(value: unknown): EnergyReading[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const record = entry as { date?: unknown; reading?: unknown }
      if (typeof record.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(record.date)) return null
      const reading = parseDecimal(record.reading as string | number)
      return reading >= 0 ? { date: record.date, reading } : null
    })
    .filter((entry): entry is EnergyReading => entry !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-24)
}
