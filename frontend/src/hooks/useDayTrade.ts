import { useCallback, useEffect, useState } from 'react'
import { dayTradeRepository } from '../lib/storage/dayTradeRepository'
import {
  applyBuy,
  applySell,
  createSession,
  setMemo,
  setWatchlist,
} from '../lib/storage/dayTrade'
import type { DayTradeSession, OrderInput } from '../lib/storage/dayTrade'

/** デイトレ練習の状態と操作。更新はすべて純粋関数を通してから保存する。 */
export function useDayTrade() {
  const [session, setSession] = useState<DayTradeSession | null>(null)
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(async () => {
    setSession(await dayTradeRepository.load())
    setLoaded(true)
  }, [])

  useEffect(() => {
    void reload()
    return dayTradeRepository.subscribe(() => void reload())
  }, [reload])

  const commit = useCallback(async (next: DayTradeSession) => {
    setSession(next)
    await dayTradeRepository.save(next)
    return next
  }, [])

  const start = useCallback((initialCash: number) => commit(createSession(initialCash)), [commit])

  const buy = useCallback(
    (input: OrderInput) => {
      if (!session) throw new Error('デイトレ練習が開始されていません。')
      return commit(applyBuy(session, input))
    },
    [session, commit],
  )

  const sell = useCallback(
    (input: OrderInput) => {
      if (!session) throw new Error('デイトレ練習が開始されていません。')
      return commit(applySell(session, input))
    },
    [session, commit],
  )

  const memo = useCallback(
    (orderId: string, text: string) => {
      if (!session) return Promise.resolve(null)
      return commit(setMemo(session, orderId, text))
    },
    [session, commit],
  )

  const watchlist = useCallback(
    (tickers: string[]) => {
      if (!session) return Promise.resolve(null)
      return commit(setWatchlist(session, tickers))
    },
    [session, commit],
  )

  const reset = useCallback(async () => {
    await dayTradeRepository.clear()
    setSession(null)
  }, [])

  return { session, loaded, start, buy, sell, memo, watchlist, reset }
}
