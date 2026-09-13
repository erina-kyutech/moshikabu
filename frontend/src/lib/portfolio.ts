/**
 * 仮想ポートフォリオの評価計算（純粋関数）。
 *
 * 重要な前提:
 *  - Position.buyPrice は購入時に凍結した「当時の実際の株価」
 *  - API が返す株価（現在値・履歴）は「分割調整後」
 *  - よって購入後に分割があった場合、保有株数は shares × 分割倍率 になり、
 *    評価額は常に  sharesNow × 分割調整後株価  で計算できる
 */
import { todayISO } from './format'
import type { Position } from './storage'
import type { Actions, Currency, PricePoint, Quote } from './types'

export const BASE_CURRENCY: Currency = 'JPY'

export interface FxContext {
  /** 1 USD = ? JPY */
  usdJpy: number
  /** 日付 → レート（過去の資産推移用）。無い日は直近の値で補完する。 */
  series?: PricePoint[]
}

export interface PositionValuation {
  position: Position
  splitFactor: number
  sharesNow: number
  currentPrice: number | null
  currentValue: number | null
  profit: number | null
  returnPct: number | null
  dayChange: number | null
  dayChangePercent: number | null
  /** 基準通貨（円）換算 */
  investedBase: number
  currentValueBase: number | null
  profitBase: number | null
  dayChangeBase: number | null
  isStale: boolean
}

export interface PortfolioSummary {
  totalValueBase: number
  totalInvestedBase: number
  totalProfitBase: number
  totalReturnPct: number
  dayChangeBase: number
  dayChangePercent: number
  positionCount: number
  hasMissingQuotes: boolean
}

const toBase = (value: number, currency: Currency, fx: FxContext) =>
  currency === 'JPY' ? value : value * fx.usdJpy

/** buyDate より後に発生した分割の累積倍率。 */
export function splitFactorSince(actions: Actions | undefined, sinceDate: string, untilDate?: string): number {
  if (!actions?.splits?.length) return 1
  return actions.splits
    .filter((s) => s.date > sinceDate && (!untilDate || s.date <= untilDate))
    .reduce((acc, s) => acc * s.ratio, 1)
}

export function valuePosition(
  position: Position,
  quote: Quote | undefined,
  actions: Actions | undefined,
  fx: FxContext,
): PositionValuation {
  const splitFactor = splitFactorSince(actions, position.buyDate, position.sellDate)
  const sharesNow = position.shares * splitFactor
  const investedBase = toBase(position.invested, position.currency, fx)

  // 売却済みは売却時点の値で確定
  if (position.status === 'closed' && position.sellPrice != null) {
    const currentValue = sharesNow * position.sellPrice
    const profit = currentValue - position.invested
    return {
      position,
      splitFactor,
      sharesNow,
      currentPrice: position.sellPrice,
      currentValue,
      profit,
      returnPct: position.invested ? (profit / position.invested) * 100 : 0,
      dayChange: 0,
      dayChangePercent: 0,
      investedBase,
      currentValueBase: toBase(currentValue, position.currency, fx),
      profitBase: toBase(profit, position.currency, fx),
      dayChangeBase: 0,
      isStale: false,
    }
  }

  if (!quote) {
    return {
      position,
      splitFactor,
      sharesNow,
      currentPrice: null,
      currentValue: null,
      profit: null,
      returnPct: null,
      dayChange: null,
      dayChangePercent: null,
      investedBase,
      currentValueBase: null,
      profitBase: null,
      dayChangeBase: null,
      isStale: true,
    }
  }

  const currentValue = sharesNow * quote.price
  const profit = currentValue - position.invested
  const prev = quote.previousClose ?? null
  // 当日購入した銘柄は前日終値ではなく購入価格を基準にする（購入前の値動きは自分の損益ではない）
  const boughtToday = position.buyDate === todayISO()
  const dayChange = boughtToday
    ? profit
    : prev != null
      ? sharesNow * (quote.price - prev)
      : null

  return {
    position,
    splitFactor,
    sharesNow,
    currentPrice: quote.price,
    currentValue,
    profit,
    returnPct: position.invested ? (profit / position.invested) * 100 : 0,
    dayChange,
    dayChangePercent: boughtToday
      ? position.invested
        ? (profit / position.invested) * 100
        : 0
      : (quote.changePercent ?? null),
    investedBase,
    currentValueBase: toBase(currentValue, position.currency, fx),
    profitBase: toBase(profit, position.currency, fx),
    dayChangeBase: dayChange != null ? toBase(dayChange, position.currency, fx) : null,
    isStale: false,
  }
}

export function summarize(valuations: PositionValuation[]): PortfolioSummary {
  const open = valuations.filter((v) => v.position.status === 'open')
  let totalValueBase = 0
  let totalInvestedBase = 0
  let dayChangeBase = 0
  let hasMissingQuotes = false

  for (const v of open) {
    totalInvestedBase += v.investedBase
    if (v.currentValueBase == null) {
      hasMissingQuotes = true
      totalValueBase += v.investedBase // 取得できない銘柄は取得原価で据え置く
    } else {
      totalValueBase += v.currentValueBase
    }
    dayChangeBase += v.dayChangeBase ?? 0
  }

  const totalProfitBase = totalValueBase - totalInvestedBase
  const prevValue = totalValueBase - dayChangeBase
  return {
    totalValueBase,
    totalInvestedBase,
    totalProfitBase,
    totalReturnPct: totalInvestedBase ? (totalProfitBase / totalInvestedBase) * 100 : 0,
    dayChangeBase,
    dayChangePercent: prevValue ? (dayChangeBase / prevValue) * 100 : 0,
    positionCount: open.length,
    hasMissingQuotes,
  }
}

/** 日付昇順の系列から「その日以前で最も新しい終値」を引くルックアップを作る。 */
function makeLookup(points: PricePoint[]): (date: string) => number | null {
  const sorted = [...points].sort((a, b) => (a.date < b.date ? -1 : 1))
  const cache = new Map<string, number | null>()
  return (date: string) => {
    const cached = cache.get(date)
    if (cached !== undefined) return cached
    // 二分探索で「その日以前で最も新しい終値」を求める
    let lo = 0
    let hi = sorted.length - 1
    let value: number | null = null
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (sorted[mid].date <= date) {
        value = sorted[mid].close
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    cache.set(date, value)
    return value
  }
}

export interface PortfolioSeriesPoint {
  date: string
  value: number
  invested: number
}

/**
 * ポートフォリオ全体の評価額推移。
 *
 * 各ポジションについて value(d) = sharesNow × 分割調整後終値(d)（購入日以降・売却日まで）。
 * 購入直後でまだ日足が無い場合でも線が引けるよう、購入日は取得原価、
 * 当日は最新の株価で必ず点を作る。
 */
export function buildPortfolioSeries(
  positions: Position[],
  histories: Record<string, PricePoint[]>,
  actionsByTicker: Record<string, Actions | undefined>,
  fx: FxContext,
  fromDate?: string,
  quotes: Record<string, Quote> = {},
): PortfolioSeriesPoint[] {
  if (positions.length === 0) return []

  const today = todayISO()
  const dates = new Set<string>()
  for (const p of positions) {
    dates.add(p.buyDate)
    if (p.sellDate) dates.add(p.sellDate)
    for (const point of histories[p.ticker] ?? []) {
      if (point.date >= p.buyDate) dates.add(point.date)
    }
  }
  dates.add(today)

  const allDates = [...dates].sort().filter((d) => d <= today)
  const earliestBuy = positions.reduce((min, p) => (p.buyDate < min ? p.buyDate : min), today)
  const start = fromDate && fromDate > earliestBuy ? fromDate : earliestBuy
  const targetDates = allDates.filter((d) => d >= start)
  if (targetDates.length === 0) return []

  const lookups: Record<string, (d: string) => number | null> = {}
  for (const [ticker, points] of Object.entries(histories)) lookups[ticker] = makeLookup(points)
  const fxLookup = fx.series?.length ? makeLookup(fx.series) : null

  return targetDates.map((date) => {
    let value = 0
    let invested = 0
    const rate = (fxLookup?.(date) ?? null) || fx.usdJpy

    for (const p of positions) {
      if (p.buyDate > date) continue
      const factor = splitFactorSince(actionsByTicker[p.ticker], p.buyDate, p.sellDate)
      const sharesNow = p.shares * factor
      const conv = (v: number) => (p.currency === 'JPY' ? v : v * rate)
      invested += conv(p.invested)

      // 売却後は現金として保持している扱い（評価額は売却代金で固定）
      if (p.status === 'closed' && p.sellDate && p.sellDate <= date) {
        value += conv(p.proceeds ?? p.invested)
        continue
      }

      // 当日は日足より新しい現在値を優先する
      const quotePrice = date === today ? (quotes[p.ticker]?.price ?? null) : null
      // 日足が無い日は取得原価と同じ株価とみなす（購入当日など）
      const fallback = p.buyPrice / factor
      const price = quotePrice ?? lookups[p.ticker]?.(date) ?? fallback
      value += conv(sharesNow * price)
    }

    return { date, value, invested }
  })
}
