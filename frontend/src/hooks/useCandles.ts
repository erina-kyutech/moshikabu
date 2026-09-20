import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../lib/api'
import type { CandlesResponse, ChartInterval, ChartRange } from '../lib/types'

/**
 * チャート用データの取得。
 *
 * 更新の間隔はサーバーが返す refreshSeconds に従う（データ取得側が頻度を決める）。
 * 画面が隠れている間は取得を止めて、無料のデータソースに無駄な負荷をかけない。
 */
export function useCandles(
  ticker: string | null,
  range: ChartRange,
  interval: ChartInterval | null,
  options: { live?: boolean } = {},
) {
  const { live = true } = options
  const [data, setData] = useState<CandlesResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const runId = useRef(0)

  const load = useCallback(
    async (quiet = false) => {
      if (!ticker) {
        setData(null)
        setError('')
        return
      }
      const myRun = ++runId.current
      if (!quiet) setLoading(true)
      try {
        const res = await api.candles(ticker, { range, interval: interval ?? undefined })
        if (myRun !== runId.current) return
        setData(res)
        setError('')
      } catch (e) {
        if (myRun !== runId.current) return
        if (!quiet) {
          setError(e instanceof ApiError ? e.message : 'チャートを取得できませんでした。')
          setData(null)
        }
      } finally {
        if (myRun === runId.current && !quiet) setLoading(false)
      }
    },
    [ticker, range, interval],
  )

  useEffect(() => {
    void load()
  }, [load])

  // 定期更新（サーバーが指定した間隔・タブが見えているときだけ）
  const refreshSeconds = data?.refreshSeconds ?? 60
  useEffect(() => {
    if (!live || !ticker) return
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load(true)
    }, refreshSeconds * 1000)
    return () => clearInterval(timer)
  }, [live, ticker, refreshSeconds, load])

  return { data, loading, error, reload: load }
}
