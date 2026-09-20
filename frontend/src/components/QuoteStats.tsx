import type { Quote } from '../lib/types'
import {
  displayCode,
  formatPercent,
  formatPrice,
  formatSignedMoney,
  formatVolume,
} from '../lib/format'
import { StockAvatar } from './StockAvatar'
import { Change } from './Change'
import { cn } from './ui/cn'

/**
 * チャート上部の銘柄情報。
 * 現在値・前日比・本日の高値安値・出来高を、初心者にも読める並びで出す。
 */
export function QuoteStats({
  quote,
  exchange,
  size = 'md',
}: {
  quote: Quote
  exchange?: string | null
  size?: 'md' | 'lg'
}) {
  const c = quote.currency
  const up = (quote.change ?? 0) >= 0

  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="flex items-center gap-3">
        <StockAvatar ticker={quote.ticker} name={quote.name ?? undefined} size={size === 'lg' ? 'lg' : 'md'} />
        <div className="min-w-0">
          <p className={cn('truncate font-bold text-ink', size === 'lg' ? 'text-xl sm:text-2xl' : 'text-lg')}>
            {quote.name ?? quote.ticker}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
            <span className="num">{displayCode(quote.ticker)}</span>
            <span className="text-line">|</span>
            <span>{exchange ?? (quote.market === 'JP' ? '日本株' : '米国株')}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div>
          <p className="text-xs text-muted">現在値</p>
          <p
            className={cn(
              'num leading-tight text-ink',
              size === 'lg' ? 'text-4xl sm:text-5xl' : 'text-3xl',
            )}
          >
            {formatPrice(quote.price, c)}
          </p>
        </div>
        <div className="pb-1">
          <p className="text-xs text-muted">前日比</p>
          <Change
            value={quote.change ?? 0}
            text={formatSignedMoney(quote.change ?? 0, c)}
            sub={formatPercent(quote.changePercent)}
            size={size === 'lg' ? 'md' : 'sm'}
          />
        </div>
        <dl className="flex gap-x-5 pb-1 text-xs">
          <div>
            <dt className="text-muted">高値</dt>
            <dd className="num mt-0.5 text-ink">{formatPrice(quote.dayHigh, c)}</dd>
          </div>
          <div>
            <dt className="text-muted">安値</dt>
            <dd className="num mt-0.5 text-ink">{formatPrice(quote.dayLow, c)}</dd>
          </div>
          <div>
            <dt className="text-muted">出来高</dt>
            <dd className="num mt-0.5 text-ink">{formatVolume(quote.volume)}</dd>
          </div>
        </dl>
      </div>

      <span className="sr-only">{up ? '前日比プラス' : '前日比マイナス'}</span>
    </div>
  )
}
