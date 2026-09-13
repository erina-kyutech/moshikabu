import type { Currency, Market } from '../types'

export type PositionStatus = 'open' | 'closed'

/**
 * 仮想保有ポジション（1回の仮想購入 = 1レコード）。
 *
 * buyPrice は「仮想購入した瞬間の株価」を凍結して保存する。
 * 後日株価データを取り直しても、この値は決して書き換えない。
 */
export interface Position {
  id: string
  ticker: string
  name: string
  market: Market
  currency: Currency

  buyDate: string // YYYY-MM-DD
  buyAt: string // ISO 8601（購入時刻）
  buyPrice: number
  shares: number
  invested: number

  status: PositionStatus
  sellDate?: string
  sellAt?: string
  sellPrice?: number
  proceeds?: number

  schemaVersion: number
}

export interface NewPositionInput {
  ticker: string
  name: string
  market: Market
  currency: Currency
  buyPrice: number
  shares: number
  /** テスト・将来の任意日購入のために上書き可能にしておく */
  at?: Date
}

export interface SellInput {
  price: number
  at?: Date
}
