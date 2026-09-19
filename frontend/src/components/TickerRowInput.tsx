import { useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../lib/api'
import type { Quote } from '../lib/types'
import { Input } from './ui/Field'
import { CloseIcon, SearchIcon } from './Icons'
import { Spinner } from './ui/States'
import { StockAvatar } from './StockAvatar'

/**
 * 比較用の1行ぶんの銘柄入力。
 * 入力が止まったら銘柄名を確認し、行の中にコンパクトに表示する。
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
  onResolved?: (ticker: string, quote: Quote | null) => void
  canRemove: boolean
  index: number
  color: string
}) {
  const [quote, setQuote] = useState<Quote | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ok'>('idle')
  const requestId = useRef(0)
  const resolvedRef = useRef(onResolved)
  resolvedRef.current = onResolved

  useEffect(() => {
    const raw = value.trim()
    if (!raw) {
      setStatus('idle')
      setQuote(null)
      resolvedRef.current?.(raw, null)
      return
    }
    const myId = ++requestId.current
    setStatus('loading')
    const timer = setTimeout(async () => {
      try {
        const q = await api.quote(raw)
        if (myId !== requestId.current) return
        setQuote(q)
        setStatus('ok')
        resolvedRef.current?.(raw, q)
      } catch (e) {
        if (myId !== requestId.current) return
        setQuote(null)
        setStatus(e instanceof ApiError ? 'error' : 'error')
        resolvedRef.current?.(raw, null)
      }
    }, 550)
    return () => clearTimeout(timer)
  }, [value])

  return (
    <div className="rounded-xl border border-line bg-white p-3">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="h-6 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        <div className="relative flex-1">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={index === 0 ? 'AAPL' : index === 1 ? 'NVDA' : '5401 / QQQ …'}
            aria-label={`比較する銘柄 ${index + 1}`}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="h-11 pr-9"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-faint">
            {status === 'loading' ? <Spinner /> : <SearchIcon className="h-4 w-4" />}
          </span>
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

      {status === 'ok' && quote ? (
        <div className="mt-2 flex items-center gap-2 pl-3.5">
          <StockAvatar ticker={quote.ticker} name={quote.name ?? undefined} size="sm" />
          <span className="min-w-0 truncate text-sm font-medium text-ink">
            {quote.name ?? quote.ticker}
          </span>
          <span className="shrink-0 text-xs text-muted">
            {quote.ticker}・{quote.market === 'JP' ? '日本株' : '米国株'}
          </span>
        </div>
      ) : status === 'error' ? (
        <p className="mt-2 pl-3.5 text-sm text-loss">銘柄が見つかりませんでした</p>
      ) : null}
    </div>
  )
}
