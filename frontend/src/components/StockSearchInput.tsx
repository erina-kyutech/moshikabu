import { useEffect, useId, useRef, useState } from 'react'
import { api, ApiError } from '../lib/api'
import type { Quote } from '../lib/types'
import { formatPrice, formatPercent } from '../lib/format'
import { Field, Input } from './ui/Field'
import { SearchIcon } from './Icons'
import { StockAvatar } from './StockAvatar'
import { Spinner } from './ui/States'
import { Change } from './Change'

/**
 * 銘柄入力。日本株は「5401」だけで 5401.T として検索できる。
 * 入力が止まってから問い合わせ、結果をカードで表示する。
 */
export function StockSearchInput({
  value,
  onChange,
  onResolved,
  label = '銘柄',
  autoFocus,
  showPrice = true,
}: {
  value: string
  onChange: (v: string) => void
  onResolved: (quote: Quote | null) => void
  label?: string
  autoFocus?: boolean
  showPrice?: boolean
}) {
  const id = useId()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ok'>('idle')
  const [error, setError] = useState('')
  const requestId = useRef(0)

  useEffect(() => {
    const raw = value.trim()
    if (raw.length < 1) {
      setStatus('idle')
      setQuote(null)
      setError('')
      onResolved(null)
      return
    }

    const myId = ++requestId.current
    setStatus('loading')
    setError('')
    const timer = setTimeout(async () => {
      try {
        const q = await api.quote(raw)
        if (myId !== requestId.current) return
        setQuote(q)
        setStatus('ok')
        onResolved(q)
      } catch (e) {
        if (myId !== requestId.current) return
        setQuote(null)
        setStatus('error')
        setError(
          e instanceof ApiError && e.code === 'SYMBOL_NOT_FOUND'
            ? '銘柄が見つかりませんでした'
            : e instanceof ApiError
              ? e.message
              : '株価データを取得できませんでした。',
        )
        onResolved(null)
      }
    }, 550)

    return () => clearTimeout(timer)
    // onResolved は毎レンダー変わり得るため依存に含めない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <div>
      <Field
        label={label}
        htmlFor={id}
        hint="日本株は証券コード（例：5401）、米国株はティッカー（例：AAPL）を入力してください。"
      >
        <div className="relative">
          <Input
            id={id}
            value={value}
            autoFocus={autoFocus}
            onChange={(e) => onChange(e.target.value)}
            placeholder="5401 / 7203 / AAPL / NVDA"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-describedby={`${id}-result`}
            className="pr-11"
          />
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-faint">
            {status === 'loading' ? <Spinner /> : <SearchIcon />}
          </span>
        </div>
      </Field>

      <div id={`${id}-result`} aria-live="polite" className="mt-3">
        {status === 'loading' ? (
          <div className="flex items-center gap-2 rounded-xl border border-line bg-canvas-2 px-4 py-3 text-sm text-muted">
            <Spinner /> 株価データを取得中…
          </div>
        ) : status === 'error' ? (
          <div className="rounded-xl border border-loss/20 bg-loss-soft px-4 py-3 text-sm text-loss">
            {error}
          </div>
        ) : status === 'ok' && quote ? (
          <div className="flex items-center gap-3 rounded-xl border border-line bg-canvas-2 px-4 py-3">
            <StockAvatar ticker={quote.ticker} name={quote.name ?? undefined} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-ink">{quote.name ?? quote.ticker}</p>
              <p className="text-xs text-muted">
                {quote.ticker}
                <span className="mx-1.5 text-line">|</span>
                {quote.market === 'JP' ? '日本株' : '米国株'}
              </p>
            </div>
            {showPrice ? (
              <div className="text-right">
                <p className="num text-sm text-ink">{formatPrice(quote.price, quote.currency)}</p>
                {quote.changePercent != null ? (
                  <Change
                    value={quote.changePercent}
                    text={formatPercent(quote.changePercent)}
                    size="sm"
                    align="right"
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
