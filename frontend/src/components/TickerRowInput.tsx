import { useCallback, useRef, useState } from 'react'
import { api } from '../lib/api'
import type { SymbolSearchResult } from '../lib/types'
import { CloseIcon } from './Icons'
import { Spinner } from './ui/States'
import { StockAvatar } from './StockAvatar'
import { SymbolCombobox } from './SymbolCombobox'

export interface ResolvedSymbol {
  ticker: string
  name: string
  market: 'JP' | 'US'
  exchange: string
}

/**
 * 比較用の1行ぶんの銘柄入力（検索候補つき）。
 * 選ばれた銘柄は株価が取れることまで確認してから親に伝える。
 */
export function TickerRowInput({
  value,
  onChange,
  onRemove,
  onResolved,
  canRemove,
  index,
  color,
}: {
  value: string
  onChange: (v: string) => void
  onRemove: () => void
  onResolved: (resolved: ResolvedSymbol | null) => void
  canRemove: boolean
  index: number
  color: string
}) {
  const [resolved, setResolved] = useState<ResolvedSymbol | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ok'>('idle')
  const requestId = useRef(0)
  const resolvedRef = useRef(onResolved)
  resolvedRef.current = onResolved

  const onPick = useCallback(async (picked: SymbolSearchResult | null) => {
    const myId = ++requestId.current
    if (!picked) {
      setResolved(null)
      setStatus('idle')
      resolvedRef.current(null)
      return
    }
    setStatus('loading')
    try {
      // 確認済みの候補はそのティッカーで、未確認（辞書に無いコード等）は入力のままで取得を試す
      const q = await api.quote(picked.verified ? picked.ticker : picked.code)
      if (myId !== requestId.current) return
      const r: ResolvedSymbol = {
        ticker: q.ticker,
        name: picked.verified ? picked.name : (q.name ?? picked.name),
        market: q.market,
        exchange: picked.exchange,
      }
      setResolved(r)
      setStatus('ok')
      resolvedRef.current(r)
    } catch {
      if (myId !== requestId.current) return
      setResolved(null)
      setStatus('error')
      resolvedRef.current(null)
    }
  }, [])

  return (
    <div className="rounded-xl border border-line bg-white p-3">
      <div className="flex items-center gap-2">
        <span aria-hidden className="h-6 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <div className="flex-1">
          <SymbolCombobox
            value={value}
            onChange={onChange}
            onPick={onPick}
            ariaLabel={`比較する銘柄 ${index + 1}`}
            placeholder={index === 0 ? 'AAPL / Apple' : index === 1 ? '5401 / 日本製鉄' : '150A / QQQ …'}
            compact
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label={`銘柄 ${index + 1} を削除`}
          className="focus-ring rounded-lg p-2 text-faint transition hover:bg-canvas-2 hover:text-loss disabled:cursor-not-allowed disabled:opacity-30"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>

      {status === 'loading' ? (
        <p className="mt-2 flex items-center gap-2 pl-3.5 text-xs text-muted">
          <Spinner className="h-3.5 w-3.5" /> 株価データを確認中…
        </p>
      ) : status === 'ok' && resolved ? (
        <div className="mt-2 flex items-center gap-2 pl-3.5">
          <StockAvatar ticker={resolved.ticker} name={resolved.name} size="sm" />
          <span className="min-w-0 truncate text-sm font-medium text-ink">{resolved.name}</span>
          <span className="shrink-0 text-xs text-muted">
            {resolved.ticker.replace(/\.T$/, '')}・{resolved.exchange}
          </span>
        </div>
      ) : status === 'error' ? (
        <p className="mt-2 pl-3.5 text-sm text-loss">銘柄が見つかりませんでした</p>
      ) : null}
    </div>
  )
}
