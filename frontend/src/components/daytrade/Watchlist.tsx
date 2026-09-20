import type { Quote } from '../../lib/types'
import { displayCode, formatPercent, formatPrice, formatSignedMoney } from '../../lib/format'
import { Change } from '../Change'
import { CloseIcon } from '../Icons'
import { cn } from '../ui/cn'

/**
 * ウォッチリスト。クリックでチャートの銘柄を切り替える。
 * 狭い画面では横スクロールのカード列になる。
 */
export function Watchlist({
  tickers,
  quotes,
  selected,
  onSelect,
  onRemove,
}: {
  tickers: string[]
  quotes: Record<string, Quote>
  selected: string | null
  onSelect: (ticker: string) => void
  onRemove: (ticker: string) => void
}) {
  if (tickers.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-white px-4 py-3 text-sm text-muted">
        上の検索欄で銘柄を選ぶと、ここに追加されます。
      </p>
    )
  }

  return (
    <ul className="flex gap-2 overflow-x-auto pb-1">
      {tickers.map((ticker) => {
        const q = quotes[ticker]
        const active = ticker === selected
        return (
          <li key={ticker} className="shrink-0">
            <div
              className={cn(
                'group relative flex w-40 flex-col rounded-xl border px-3 py-2.5 text-left transition',
                active ? 'border-brand bg-brand-soft' : 'border-line bg-white hover:bg-canvas-2',
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(ticker)}
                aria-pressed={active}
                className="focus-ring rounded-md text-left"
              >
                <span className="block truncate text-sm font-semibold text-ink">
                  {q?.name ?? displayCode(ticker)}
                </span>
                <span className="num block text-xs text-muted">{displayCode(ticker)}</span>
                <span className="num mt-1 block text-sm text-ink">
                  {q ? formatPrice(q.price, q.currency) : '—'}
                </span>
                {q?.change != null ? (
                  <Change
                    value={q.change}
                    text={formatSignedMoney(q.change, q.currency)}
                    sub={formatPercent(q.changePercent)}
                    size="sm"
                  />
                ) : (
                  <span className="text-xs text-faint">取得中…</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => onRemove(ticker)}
                aria-label={`${displayCode(ticker)} をウォッチリストから外す`}
                className="focus-ring absolute right-1 top-1 rounded-md p-1 text-faint opacity-0 transition hover:text-loss focus-visible:opacity-100 group-hover:opacity-100"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
