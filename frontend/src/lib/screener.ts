/** 条件スクリーナー・バックテストの型（backend/app/schemas_screener.py と 1:1）。 */
import type { Market, Currency } from './types'

export type Operator = '<=' | '>=' | '<' | '>' | '=='

export interface MetricDef {
  id: string
  label: string
  unit: string
  category: string
  decimals: number
  /** 過去時点の値を再現できるか（false はバックテストで使えない） */
  historical: boolean
  note: string
}

export interface ScreenerCondition {
  metric: string
  operator: Operator
  value: number
}

export interface ConditionTemplate {
  id: string
  name: string
  description: string
  conditions: ScreenerCondition[]
}

export interface UniverseDef {
  id: string
  label: string
  description: string
  size: number
  slow: boolean
}

export interface ScreenerCatalog {
  metrics: MetricDef[]
  operators: Record<string, string>
  categories: Record<string, string>
  universes: UniverseDef[]
  templates: ConditionTemplate[]
  benchmarks: Array<{ id: string; label: string }>
  holdingPeriods: number[]
  dataNotes: string[]
}

export interface ConditionCheck {
  metric: string
  operator: Operator
  threshold: number
  actual?: number | null
  passed: boolean
}

export interface ScreenRow {
  ticker: string
  code: string
  name: string
  market: Market
  currency: Currency
  exchange?: string | null
  price?: number | null
  change?: number | null
  changePercent?: number | null
  values: Record<string, number>
  checks: ConditionCheck[]
}

/** 条件1つだけで見たときの通過数（0件だった理由を示すのに使う） */
export interface ConditionStat {
  metric: string
  operator: string
  threshold: number
  evaluated: number
  passed: number
}

export interface ScreenResponse {
  asOf: string
  universe: string
  universeLabel: string
  scanned: number
  matchedCount: number
  rejectedCount: number
  excludedCount: number
  excludedReasons: Record<string, number>
  conditionStats: ConditionStat[]
  rows: ScreenRow[]
  notes: string[]
}

export interface FundamentalsResponse {
  ticker: string
  code: string
  name: string
  market: Market
  currency: Currency
  exchange?: string | null
  asOf: string
  values: Record<string, number>
  missing: string[]
}

// -------------------------------------------------------------- バックテスト
export interface BacktestRequest {
  conditions: ScreenerCondition[]
  startDate: string
  endDate: string
  screeningMonth: number
  holdingPeriod: number
  initialCapital: number
  benchmark: string
  universe: string
  ruleName?: string | null
}

export interface BacktestTrade {
  ticker: string
  code: string
  name: string
  buyDate: string
  sellDate: string
  buyPrice: number
  sellPrice: number
  shares: number
  invested: number
  finalValue: number
  profit: number
  returnPct: number
}

export interface BacktestYear {
  year: number
  screeningDate: string
  candidates: number
  excluded: number
  trades: number
  winRate: number
  averageReturn: number
  medianReturn: number
  benchmarkReturn?: number | null
  profit: number
}

export interface BacktestEquityPoint {
  date: string
  value: number
  benchmark?: number | null
}

export interface BacktestResponse {
  ruleName?: string | null
  conditions: ScreenerCondition[]
  startDate: string
  endDate: string
  screeningMonth: number
  holdingPeriod: number
  universe: string
  universeLabel: string
  benchmark: string
  benchmarkLabel: string

  totalInvested: number
  finalValue: number
  profit: number
  returnRate: number
  winRate: number
  averageReturn: number
  medianReturn: number
  benchmarkReturn?: number | null

  trades: BacktestTrade[]
  yearly: BacktestYear[]
  equity: BacktestEquityPoint[]
  screeningDates: string[]
  excludedReasons: Record<string, number>
  notes: string[]
}

/** 保存した投資ルール（マイルール）。 */
export interface SavedRule {
  id: string
  name: string
  conditions: ScreenerCondition[]
  universe: string
  createdAt: string
}
