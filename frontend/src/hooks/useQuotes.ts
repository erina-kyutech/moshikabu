import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import type { Quote } from '../lib/types'

/** 最新株価の定期取得（バックエンドのキャッシュが実際の取得頻度を抑える）。 */
const DEFAULT_REFRESH_SECONDS = 60

export function useQuotes(tickers: string[], options: { live?: boolean; refreshSeconds?: number } = {}) {
  const { live = true, refreshSeconds = DEFAULT_REFRESH_SECONDS } = options
  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const runId = useRef(0)

  const key = [...new Set(tickers)].sort().join(',')

  const load = useCallback(
    async (quiet = false) => {
      const list = key ? key.split(',') : []
      if (list.length === 0) {
        setQuotes({})
        return
      }
      const myRun = ++runId.current
      if (!quiet) setLoading(true)
      try {
        const res = await api.quotes(list)
        if (myRun !== runId.current) return
        const next: Record<string, Quote> = {}
        for (const q of res) next[q.ticker] = q
        setQuotes(next)
        setError('')
      } catch {
        if (myRun !== runId.current) return
        if (!quiet) setError('株価データを取得できませんでした。')
      } finally {
        if (myRun === runId.current && !quiet) setLoading(false)
      }
    },
    [key],
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!live || !key) return
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load(true)
    }, refreshSeconds * 1000)
    return () => clearInterval(timer)
  }, [live, key, refreshSeconds, load])

  return { quotes, loading, error, reload: load }
}

/** 1銘柄だけ見たいとき。 */
export function useQuote(ticker: string | null, options: { live?: boolean } = {}) {
  const { quotes, loading, error, reload } = useQuotes(ticker ? [ticker] : [], options)
  return { quote: ticker ? (quotes[ticker] ?? null) : null, loading, error, reload }
}
