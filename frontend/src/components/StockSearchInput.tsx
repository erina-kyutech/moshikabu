import { useCallback, useId, useRef, useState } from 'react'
import { api, ApiError } from '../lib/api'
import type { Quote, SymbolSearchResult } from '../lib/types'
import { formatPercent, formatPrice } from '../lib/format'
import { Field } from './ui/Field'
import { StockAvatar } from './StockAvatar'
import { Spinner } from './ui/States'
import { Change } from './Change'
import { SymbolCombobox } from './SymbolCombobox'

/**
 * 銘柄入力（検索候補つき）＋選んだ銘柄の確認カード。
 *
 * 日本株は「5401」「150A」のような証券コードや「日本製鉄」のような社名、
 * 米国株は「AAPL」や「Apple」で探せる。選ばれた銘柄は最新株価まで取得して親に渡す。
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
  const resolvedRef = useRef(onResolved)
  resolvedRef.current = onResolved

  const onPick = useCallback(
    async (picked: SymbolSearchResult | null) => {
      const myId = ++requestId.current
      if (!picked) {
        setQuote(null)
        setStatus('idle')
        setError('')
        resolvedRef.current(null)
        return
      }
      setStatus('loading')
      setError('')
      try {
        // 存在を確認できていない候補（辞書に無い新しいコードなど）は、入力そのものを渡して
        // バックエンドのフォールバック（150A → 150A.T → 150A）に任せる
        const q = await api.quote(picked.verified ? picked.ticker : picked.code)
        if (myId !== requestId.current) return
        // 日本株は辞書の日本語名、米国株は取得した名前を優先
        const merged: Quote = { ...q, name: picked.verified ? picked.name : (q.name ?? picked.name) }
        setQuote(merged)
        setStatus('ok')
        resolvedRef.current(merged)
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
        resolvedRef.current(null)
      }
    },
    [],
  )

  return (
    <div>
      <Field
        label={label}
        htmlFor={id}
        hint="証券コード（5401・150A）、ティッカー（AAPL）、社名（日本製鉄・Apple）のどれでも探せます。"
      >
        <SymbolCombobox
          id={id}
          value={value}
          onChange={onChange}
          onPick={onPick}
          autoFocus={autoFocus}
        />
      </Field>

      <div aria-live="polite" className="mt-3">
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
                {quote.ticker.replace(/\.T$/, '')}
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
