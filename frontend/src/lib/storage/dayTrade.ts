/**
 * デイトレ練習モードの状態と、その更新ロジック。
 *
 * 更新はすべて純粋関数（applyBuy / applySell …）で書き、保存は Repository に閉じ込める。
 * 実際の証券口座とは接続せず、実際のお金も動かさないペーパートレード。
 *
 * 通貨の扱い:
 *   仮想資金は円で持つ。米国株を売買するときは、その時点の USD/JPY で円に換算する。
 *   株価・平均取得単価は現地通貨のまま、損益と資産は円で集計する。
 */
import type { Currency, Market } from '../types'

export const DAY_TRADE_SCHEMA_VERSION = 1

/** 注文の種類。MVP は成行のみだが、指値・逆指値を足せるようにしておく。 */
export type OrderKind = 'market' | 'limit' | 'stop'
export type OrderSide = 'buy' | 'sell'

export interface DayPosition {
  ticker: string
  name: string
  market: Market
  currency: Currency
  shares: number
  /** 平均取得単価（現地通貨） */
  avgPrice: number
  /** 取得原価の合計（円） */
  costBase: number
  openedAt: string
}

export interface DayOrder {
  id: string
  at: string
  ticker: string
  name: string
  currency: Currency
  side: OrderSide
  kind: OrderKind
  shares: number
  /** 約定価格（現地通貨） */
  price: number
  /** 約定代金（円） */
  amountBase: number
  fxRate: number
  memo?: string
  /** 売却時の実現損益 */
  realizedBase?: number
  realizedLocal?: number
}

/** 買って売るまでの1往復。振り返り用。 */
export interface DayRoundTrip {
  id: string
  ticker: string
  name: string
  currency: Currency
  shares: number
  buyAt: string
  buyPrice: number
  sellAt: string
  sellPrice: number
  profitBase: number
  profitLocal: number
  returnPct: number
  holdingMs: number
}

export interface DayTradeSession {
  schemaVersion: number
  startedAt: string
  /** 開始時の仮想資金（円） */
  initialCash: number
  /** 現金（円） */
  cash: number
  positions: DayPosition[]
  orders: DayOrder[]
  trades: DayRoundTrip[]
  watchlist: string[]
  /** 実現損益の累計（円） */
  realizedBase: number
}

export const DEFAULT_WATCHLIST = ['150A.T', '5401.T', '7011.T', 'NVDA', 'AAPL']

export class DayTradeError extends Error {}

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

export function createSession(initialCash: number, at: Date = new Date()): DayTradeSession {
  if (!Number.isFinite(initialCash) || initialCash <= 0) {
    throw new DayTradeError('仮想資金は1以上で指定してください。')
  }
  return {
    schemaVersion: DAY_TRADE_SCHEMA_VERSION,
    startedAt: at.toISOString(),
    initialCash,
    cash: initialCash,
    positions: [],
    orders: [],
    trades: [],
    watchlist: [...DEFAULT_WATCHLIST],
    realizedBase: 0,
  }
}

export interface OrderInput {
  ticker: string
  name: string
  market: Market
  currency: Currency
  shares: number
  /** 現在価格（現地通貨） */
  price: number
  /** 1ドル=何円か。日本株は 1 */
  fxRate: number
  kind?: OrderKind
  memo?: string
  at?: Date
}

const round = (v: number, digits = 6) => Math.round(v * 10 ** digits) / 10 ** digits

/** 買い注文。仮想資金が足りなければ注文を通さない。 */
export function applyBuy(session: DayTradeSession, input: OrderInput): DayTradeSession {
  const shares = Math.floor(input.shares)
  if (!Number.isFinite(shares) || shares <= 0) {
    throw new DayTradeError('株数は1株以上で入力してください。')
  }
  if (!Number.isFinite(input.price) || input.price <= 0) {
    throw new DayTradeError('株価を取得できませんでした。')
  }

  const amountBase = shares * input.price * input.fxRate
  if (amountBase > session.cash + 1e-6) {
    throw new DayTradeError('仮想資金が不足しています。')
  }

  const at = (input.at ?? new Date()).toISOString()
  const existing = session.positions.find((p) => p.ticker === input.ticker)
  const positions = existing
    ? session.positions.map((p) =>
        p.ticker === input.ticker
          ? {
              ...p,
              // 追加購入したら平均取得単価を計算し直す
              shares: p.shares + shares,
              avgPrice: round((p.avgPrice * p.shares + input.price * shares) / (p.shares + shares), 4),
              costBase: p.costBase + amountBase,
            }
          : p,
      )
    : [
        ...session.positions,
        {
          ticker: input.ticker,
          name: input.name,
          market: input.market,
          currency: input.currency,
          shares,
          avgPrice: input.price,
          costBase: amountBase,
          openedAt: at,
        },
      ]

  const order: DayOrder = {
    id: newId(),
    at,
    ticker: input.ticker,
    name: input.name,
    currency: input.currency,
    side: 'buy',
    kind: input.kind ?? 'market',
    shares,
    price: input.price,
    amountBase,
    fxRate: input.fxRate,
    memo: input.memo?.trim() || undefined,
  }

  return { ...session, cash: session.cash - amountBase, positions, orders: [order, ...session.orders] }
}

/** 売り注文。保有株数を超える売却はできない。 */
export function applySell(session: DayTradeSession, input: OrderInput): DayTradeSession {
  const shares = Math.floor(input.shares)
  if (!Number.isFinite(shares) || shares <= 0) {
    throw new DayTradeError('株数は1株以上で入力してください。')
  }
  const position = session.positions.find((p) => p.ticker === input.ticker)
  if (!position) throw new DayTradeError('この銘柄は保有していません。')
  if (shares > position.shares) throw new DayTradeError('保有している株数を超えて売却はできません。')
  if (!Number.isFinite(input.price) || input.price <= 0) {
    throw new DayTradeError('株価を取得できませんでした。')
  }

  const at = (input.at ?? new Date()).toISOString()
  const proceedsBase = shares * input.price * input.fxRate
  // 売った分だけ取得原価を取り崩す
  const costShare = position.costBase * (shares / position.shares)
  const realizedBase = proceedsBase - costShare
  const realizedLocal = (input.price - position.avgPrice) * shares

  const remaining = position.shares - shares
  const positions =
    remaining > 0
      ? session.positions.map((p) =>
          p.ticker === input.ticker
            ? { ...p, shares: remaining, costBase: p.costBase - costShare }
            : p,
        )
      : session.positions.filter((p) => p.ticker !== input.ticker)

  const order: DayOrder = {
    id: newId(),
    at,
    ticker: input.ticker,
    name: input.name,
    currency: input.currency,
    side: 'sell',
    kind: input.kind ?? 'market',
    shares,
    price: input.price,
    amountBase: proceedsBase,
    fxRate: input.fxRate,
    memo: input.memo?.trim() || undefined,
    realizedBase,
    realizedLocal,
  }

  const trade: DayRoundTrip = {
    id: order.id,
    ticker: input.ticker,
    name: input.name,
    currency: input.currency,
    shares,
    buyAt: position.openedAt,
    buyPrice: position.avgPrice,
    sellAt: at,
    sellPrice: input.price,
    profitBase: realizedBase,
    profitLocal: realizedLocal,
    returnPct: position.avgPrice ? ((input.price - position.avgPrice) / position.avgPrice) * 100 : 0,
    holdingMs: Math.max(0, new Date(at).getTime() - new Date(position.openedAt).getTime()),
  }

  return {
    ...session,
    cash: session.cash + proceedsBase,
    positions,
    orders: [order, ...session.orders],
    trades: [trade, ...session.trades],
    realizedBase: session.realizedBase + realizedBase,
  }
}

export function setMemo(session: DayTradeSession, orderId: string, memo: string): DayTradeSession {
  return {
    ...session,
    orders: session.orders.map((o) => (o.id === orderId ? { ...o, memo: memo.trim() || undefined } : o)),
  }
}

export function setWatchlist(session: DayTradeSession, watchlist: string[]): DayTradeSession {
  return { ...session, watchlist: [...new Set(watchlist)].slice(0, 20) }
}

// ------------------------------------------------------------------ 集計
export interface PositionValue {
  position: DayPosition
  price: number | null
  /** 評価額（現地通貨） */
  value: number | null
  valueBase: number | null
  profitBase: number | null
  profitLocal: number | null
  returnPct: number | null
}

export interface DayTradeSummary {
  cash: number
  stockValueBase: number
  totalAssets: number
  realizedBase: number
  unrealizedBase: number
  dayProfit: number
  dayReturnPct: number
  tradeCount: number
  wins: number
  losses: number
  winRate: number
  grossProfit: number
  grossLoss: number
}

/** 現在価格（現地通貨）と為替から、保有ポジションを評価する。 */
export function valuePositions(
  session: DayTradeSession,
  priceOf: (ticker: string) => number | null | undefined,
  usdJpy: number,
): PositionValue[] {
  return session.positions.map((position) => {
    const price = priceOf(position.ticker) ?? null
    if (price == null) {
      return { position, price: null, value: null, valueBase: null, profitBase: null, profitLocal: null, returnPct: null }
    }
    const rate = position.currency === 'JPY' ? 1 : usdJpy
    const value = position.shares * price
    const valueBase = value * rate
    return {
      position,
      price,
      value,
      valueBase,
      profitBase: valueBase - position.costBase,
      profitLocal: (price - position.avgPrice) * position.shares,
      returnPct: position.avgPrice ? ((price - position.avgPrice) / position.avgPrice) * 100 : 0,
    }
  })
}

export function summarize(session: DayTradeSession, values: PositionValue[]): DayTradeSummary {
  const stockValueBase = values.reduce((sum, v) => sum + (v.valueBase ?? v.position.costBase), 0)
  const unrealizedBase = values.reduce((sum, v) => sum + (v.profitBase ?? 0), 0)
  const totalAssets = session.cash + stockValueBase

  const wins = session.trades.filter((t) => t.profitBase > 0).length
  const losses = session.trades.filter((t) => t.profitBase < 0).length
  const grossProfit = session.trades.filter((t) => t.profitBase > 0).reduce((s, t) => s + t.profitBase, 0)
  const grossLoss = session.trades.filter((t) => t.profitBase < 0).reduce((s, t) => s + t.profitBase, 0)

  return {
    cash: session.cash,
    stockValueBase,
    totalAssets,
    realizedBase: session.realizedBase,
    unrealizedBase,
    dayProfit: session.realizedBase + unrealizedBase,
    dayReturnPct: session.initialCash
      ? ((session.realizedBase + unrealizedBase) / session.initialCash) * 100
      : 0,
    tradeCount: session.trades.length,
    wins,
    losses,
    winRate: session.trades.length ? (wins / session.trades.length) * 100 : 0,
    grossProfit,
    grossLoss,
  }
}

/** 買える最大株数（仮想資金の範囲で）。 */
export function maxSharesFor(cash: number, price: number, fxRate: number): number {
  if (!Number.isFinite(price) || price <= 0) return 0
  return Math.max(0, Math.floor(cash / (price * fxRate)))
}
