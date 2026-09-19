/**
 * バックエンド API クライアント。
 * データ取得先の差し替えはバックエンドの MarketDataProvider 側で行うため、
 * ここではエンドポイントの形だけを知っていればよい。
 */
import type {
  Actions,
  BaseCurrency,
  Comparison,
  Fx,
  History,
  PastSimulation,
  Quote,
  RecurringSimulation,
  StrategyComparison,
  SymbolInfo,
} from './types'

const BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')

export class ApiError extends Error {
  code: string
  status: number
  constructor(message: string, code = 'UNKNOWN', status = 0) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

const NETWORK_MESSAGE =
  '株価データを取得できませんでした。しばらくしてからもう一度お試しください。'

async function request<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const url = new URL(`${BASE}${path}`, window.location.origin)
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  }

  let res: Response
  try {
    res = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
  } catch {
    throw new ApiError(NETWORK_MESSAGE, 'NETWORK_ERROR')
  }

  if (!res.ok) {
    let code = 'UNKNOWN'
    let message = NETWORK_MESSAGE
    try {
      const body = await res.json()
      const detail = body?.detail
      if (typeof detail === 'string') message = detail
      else if (detail && typeof detail === 'object') {
        code = detail.code ?? code
        message = detail.message ?? message
      }
    } catch {
      /* JSON でないレスポンスはそのまま既定メッセージ */
    }
    if (res.status === 404 && code === 'UNKNOWN') {
      code = 'SYMBOL_NOT_FOUND'
      message = '銘柄が見つかりませんでした'
    }
    throw new ApiError(message, code, res.status)
  }

  return (await res.json()) as T
}

export const api = {
  health: () => request<{ status: string; provider: string }>('/api/health'),

  /** 銘柄情報＋最新価格 */
  quote: (ticker: string) => request<Quote>(`/api/stock/${encodeURIComponent(ticker)}`),

  info: (ticker: string) => request<SymbolInfo>(`/api/stock/${encodeURIComponent(ticker)}/info`),

  /** 複数銘柄の最新価格（ポートフォリオ用） */
  quotes: (tickers: string[]) =>
    tickers.length === 0
      ? Promise.resolve([] as Quote[])
      : request<Quote[]>('/api/quotes', { tickers: tickers.join(',') }),

  history: (ticker: string, opts: { start?: string; end?: string; interval?: string; maxPoints?: number } = {}) =>
    request<History>(`/api/stock/${encodeURIComponent(ticker)}/history`, {
      start: opts.start,
      end: opts.end,
      interval: opts.interval,
      maxPoints: opts.maxPoints,
    }),

  actions: (ticker: string, start?: string) =>
    request<Actions>(`/api/stock/${encodeURIComponent(ticker)}/actions`, { start }),

  simulatePast: (opts: {
    ticker: string
    date: string
    shares?: number
    amount?: number
    includeDividends?: boolean
    maxPoints?: number
  }) => request<PastSimulation>('/api/simulate/past', { ...opts }),

  usdjpy: (opts: { start?: string; end?: string; maxPoints?: number } = {}) =>
    request<Fx>('/api/fx/usdjpy', { ...opts }),

  /** 複数銘柄に同額を投じた場合の比較 */
  compare: (opts: {
    tickers: string[]
    date: string
    amount: number
    base?: BaseCurrency
    fractional?: boolean
    maxPoints?: number
  }) =>
    request<Comparison>('/api/simulate/compare', {
      tickers: opts.tickers.join(','),
      date: opts.date,
      amount: opts.amount,
      base: opts.base,
      fractional: opts.fractional,
      maxPoints: opts.maxPoints,
    }),

  /** 毎月一定額を積み立てた場合 */
  recurring: (opts: {
    ticker: string
    start: string
    amount: number
    buyDay?: string
    base?: BaseCurrency
    fractional?: boolean
    maxPoints?: number
  }) => request<RecurringSimulation>('/api/simulate/recurring', { ...opts }),

  /** 一括投資と積立投資の比較 */
  strategy: (opts: {
    ticker: string
    start: string
    monthly: number
    months: number
    buyDay?: string
    base?: BaseCurrency
    fractional?: boolean
    maxPoints?: number
  }) => request<StrategyComparison>('/api/simulate/strategy', { ...opts }),
}
