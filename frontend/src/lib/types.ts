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
  /** 当日の高値・安値・出来高（チャート上部の銘柄情報に使う） */
  dayHigh?: number | null
  dayLow?: number | null
  volume?: number | null
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

// ---------------------------------------------------------------- 複数銘柄比較
export type BaseCurrency = 'JPY' | 'LOCAL'

export interface ComparisonItem {
  /** Recharts の dataKey 用の安全なキー（ティッカーは "5401.T" のように点を含むため） */
  key: string
  ticker: string
  name: string
  market: Market
  currency: Currency

  tradeDate: string
  marketClosed: boolean

  purchasePrice: number
  shares: number
  sharesNow: number
  splitFactor: number
  splits: Split[]

  investedLocal: number
  invested: number
  currentPrice: number
  currentDate: string
  currentValue: number
  profit: number
  returnPct: number

  fxRateAtBuy: number
  fxRateNow: number

  rank: number
}

export interface ComparisonFailure {
  ticker: string
  message: string
}

export interface ComparisonSeriesRow {
  date: string
  values: Record<string, number>
}

export interface Comparison {
  startDate: string
  amount: number
  base: BaseCurrency
  baseCurrency: string
  allowFractional: boolean
  includeDividends: boolean
  mixedCurrency: boolean
  items: ComparisonItem[]
  failed: ComparisonFailure[]
  series: ComparisonSeriesRow[]
}

// ------------------------------------------------------------------ 積立投資
export type BuyDay = '1' | '5' | '10' | '15' | '20' | '25' | 'end'

export interface Lot {
  requestedDate: string
  tradeDate: string
  marketClosed: boolean
  price: number
  shares: number
  sharesNow: number
  amount: number
  amountLocal: number
  fxRate: number
}

export interface RecurringPoint {
  date: string
  value: number
  principal: number
}

export interface RecurringSimulation {
  ticker: string
  name: string
  market: Market
  currency: Currency
  base: BaseCurrency
  baseCurrency: Currency

  startDate: string
  buyDay: string
  monthlyAmount: number

  contributions: number
  invested: number
  sharesNow: number
  currentPrice: number
  currentDate: string
  currentValue: number
  profit: number
  returnPct: number
  periodMonths: number
  includeDividends: boolean

  lots: Lot[]
  series: RecurringPoint[]
}

// ------------------------------------------------------------- 一括 vs 積立
export interface StrategySide {
  label: string
  invested: number
  sharesNow: number
  currentValue: number
  profit: number
  returnPct: number
  tradeDate?: string | null
  purchasePrice?: number | null
  contributions?: number | null
  averagePrice?: number | null
}

export interface StrategyPoint {
  date: string
  lump: number
  recurring: number
  principal: number
}

export interface StrategyComparison {
  ticker: string
  name: string
  market: Market
  currency: Currency
  base: BaseCurrency
  baseCurrency: Currency

  startDate: string
  buyDay: string
  monthlyAmount: number
  months: number
  totalInvested: number
  currentDate: string
  winner: 'lump' | 'recurring' | 'tie'
  includeDividends: boolean

  lump: StrategySide
  recurring: StrategySide
  series: StrategyPoint[]
}

// ------------------------------------------------------------------ 銘柄検索
export interface SymbolSearchResult {
  /** データ取得に使うティッカー（150A.T / AAPL） */
  ticker: string
  /** ユーザーに見せる短いコード（150A / AAPL） */
  code: string
  name: string
  market: Market
  /** 表示用の市場名（東証グロース / NASDAQ） */
  exchange: string
  quoteType: 'EQUITY' | 'ETF' | 'REIT' | 'INDEX' | string
  /** 入力がコード・ティッカーとして完全一致 */
  exact: boolean
  /** 存在を確認済みか（false は「.T を付けて試す」などの推定候補） */
  verified: boolean
  source: 'directory' | 'provider' | 'direct' | string
}

export interface SymbolSearchResponse {
  query: string
  directoryAsOf?: string | null
  results: SymbolSearchResult[]
}

// -------------------------------------------------------------- チャート
export type ChartRange = '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '5y' | 'max'
export type ChartInterval = '1m' | '5m' | '15m' | '30m' | '1h' | '1d' | '1wk' | '1mo'
export type ChartType = 'line' | 'candle'

export interface Candle {
  /** 市場のローカル時刻（タイムゾーン付き ISO） */
  t: string
  /** 横軸用の短いラベル（09:05 / 9/18） */
  label: string
  /** ツールチップ用（2026/09/18 09:05） */
  fullLabel: string
  o: number
  h: number
  l: number
  c: number
  v?: number | null
}

export interface RangeOption {
  range: ChartRange
  label: string
  intervals: ChartInterval[]
  default: ChartInterval
}

export interface CandlesResponse {
  ticker: string
  code: string
  name: string
  market: Market
  currency: Currency
  exchange?: string | null

  range: ChartRange
  /** 実際に使われた時間足（選べない組み合わせは自動で切り替わる） */
  interval: ChartInterval
  requestedInterval?: ChartInterval | null
  notice?: string | null
  timezone?: string | null
  /** 推奨の再取得間隔（秒）。データ取得側が決める */
  refreshSeconds: number
  /** 本数が多いとき、何本ずつまとめたか */
  aggregatedBy: number

  rangeOptions: RangeOption[]
  intervalLabels: Record<string, string>
  candles: Candle[]
}
