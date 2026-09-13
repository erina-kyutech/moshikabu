import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../lib/api'
import type { Actions, PricePoint, Quote } from '../lib/types'
import type { Position } from '../lib/storage'

export interface MarketSnapshot {
  quotes: Record<string, Quote>
  actions: Record<string, Actions | undefined>
  usdJpy: number
  usdJpySeries: PricePoint[]
  histories: Record<string, PricePoint[]>
}

const EMPTY: MarketSnapshot = {
  quotes: {},
  actions: {},
  usdJpy: 1,
  usdJpySeries: [],
  histories: {},
}

/**
 * ポートフォリオ表示に必要な相場データをまとめて取得する。
 *
 * 保存しているのは購入価格・株数だけなので、画面を開いたときに
 * 最新価格と履歴を取り直して評価額を計算する（サーバー側の常時処理は不要）。
 */
export function useMarketData(positions: Position[], options: { withHistory?: boolean } = {}) {
  const { withHistory = false } = options
  const [data, setData] = useState<MarketSnapshot>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const runId = useRef(0)

  const tickers = [...new Set(positions.map((p) => p.ticker))].sort()
  const key = tickers.join(',')
  const earliestBuyDate = positions.reduce<string | null>(
    (min, p) => (min == null || p.buyDate < min ? p.buyDate : min),
    null,
  )
  const needsFx = positions.some((p) => p.currency !== 'JPY')

  const load = useCallback(async () => {
    const myRun = ++runId.current
    if (tickers.length === 0) {
      setData(EMPTY)
      setError('')
      return
    }

    setLoading(true)
    setError('')
    try {
      const [quoteList, actionList] = await Promise.all([
        api.quotes(tickers),
        Promise.all(
          tickers.map((t) =>
            api.actions(t).catch(() => undefined),
          ),
        ),
      ])

      const fx = needsFx
        ? await api
            .usdjpy(withHistory && earliestBuyDate ? { start: earliestBuyDate } : {})
            .catch(() => null)
        : null

      const histories: Record<string, PricePoint[]> = {}
      if (withHistory && earliestBuyDate) {
        const results = await Promise.all(
          tickers.map((t) =>
            api
              .history(t, { start: earliestBuyDate, maxPoints: 400 })
              .then((h) => [t, h.points] as const)
              .catch(() => [t, [] as PricePoint[]] as const),
          ),
        )
        for (const [t, points] of results) histories[t] = points
      }

      if (myRun !== runId.current) return

      const quotes: Record<string, Quote> = {}
      for (const q of quoteList) quotes[q.ticker] = q
      const actions: Record<string, Actions | undefined> = {}
      tickers.forEach((t, i) => {
        actions[t] = actionList[i]
      })

      setData({
        quotes,
        actions,
        usdJpy: fx?.rate ?? 1,
        usdJpySeries: fx?.points ?? [],
        histories,
      })
      if (quoteList.length === 0) {
        setError('株価データを取得できませんでした。しばらくしてからもう一度お試しください。')
      }
    } catch (e) {
      if (myRun !== runId.current) return
      setError(e instanceof ApiError ? e.message : '株価データを取得できませんでした。')
    } finally {
      if (myRun === runId.current) setLoading(false)
    }
    // tickers 配列は毎回生成されるため、内容を表す key で依存を管理する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, earliestBuyDate, needsFx, withHistory])

  useEffect(() => {
    void load()
  }, [load])

  return { data, loading, error, reload: load }
}
