import { useEffect, useState } from 'react'
import { api } from '../lib/api'

/** 円換算に使う USD/JPY。取れないあいだは概算値で計算を止めない。 */
export function useUsdJpy(options: { live?: boolean; refreshSeconds?: number } = {}) {
  const { live = true, refreshSeconds = 300 } = options
  const [rate, setRate] = useState(150)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = () =>
      api
        .usdjpy()
        .then((fx) => {
          if (!cancelled && fx.rate > 0) {
            setRate(fx.rate)
            setLoaded(true)
          }
        })
        .catch(() => undefined)

    void load()
    if (!live) return () => {
      cancelled = true
    }
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, refreshSeconds * 1000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [live, refreshSeconds])

  return { usdJpy: rate, loaded }
}
