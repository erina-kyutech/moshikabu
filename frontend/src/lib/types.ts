/** バックエンド API のレスポンス型（backend/app/schemas.py と 1:1）。 */

export type Market = 'JP' | 'US'
export type Currency = 'JPY' | 'USD'

export interface Quote {
  ticker: string
  name?: string | null
  market: Market
  currency: Currency
  price: number
  previousClose?: number | null
  change?: number | null
  changePercent?: number | null
  asOf: string
}

export interface SymbolInfo {
  ticker: string
  name: string
  market: Market
  currency: Currency
  exchange?: string | null
  sector?: string | null
}

export interface PricePoint {
  date: string
  close: number
  open?: number | null
  high?: number | null
  low?: number | null
  volume?: number | null
}

export interface History {
  ticker: string
  currency: Currency
  interval: string
  points: PricePoint[]
}

export interface Split {
  date: string
  ratio: number
}

export interface Dividend {
  date: string
  amount: number
}

export interface Actions {
  ticker: string
  splits: Split[]
  dividends: Dividend[]
}

export interface ValuePoint {
  date: string
  price: number
  value: number
}

export interface PastSimulation {
  ticker: string
  name: string
  market: Market
  currency: Currency

  requestedDate: string
  tradeDate: string
  marketClosed: boolean

  purchasePrice: number
  shares: number
  sharesNow: number
  splitFactor: number
  splits: Split[]

  invested: number
  requestedAmount?: number | null
  leftoverCash: number

  currentPrice: number
  currentDate: string
  currentValue: number

  profit: number
  returnPct: number

  dividendTotal: number
  includeDividends: boolean

  series: ValuePoint[]
}

export interface Fx {
  pair: string
  rate: number
  asOf: string
  points: PricePoint[]
}
