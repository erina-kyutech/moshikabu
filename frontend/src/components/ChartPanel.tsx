import { useEffect, useState } from 'react'
import { useCandles } from '../hooks/useCandles'
import type {
  ChartInterval,
  ChartRange,
  ChartType,
  CandlesResponse,
  Currency,
} from '../lib/types'
import { MarketChart } from './charts/MarketChart'
import type { ChartMarker, PriceLine } from './charts/MarketChart'
import { ErrorBlock, LoadingBlock } from './ui/States'
import { InfoIcon } from './Icons'
import { cn } from './ui/cn'

/**
 * 期間・時間足・表示形式を切り替えられるチャート。
 *
 * 選べない組み合わせ（例: 1年 × 5分足）はボタンを無効にし、
 * それでも指定された場合はサーバー側が使える足に切り替えて理由を知らせる。
 */
export function ChartPanel({
  ticker,
  currency,
  defaultRange = '1mo',
  defaultInterval,
  defaultType = 'line',
  ranges,
  markers = [],
  priceLines = [],
  height = 320,
  live = true,
  onData,
}: {
  ticker: string | null
  currency: Currency
  defaultRange?: ChartRange
  defaultInterval?: ChartInterval
  defaultType?: ChartType
  /** 表示する期間ボタンを絞りたいとき（デイトレ画面など） */
  ranges?: ChartRange[]
  markers?: ChartMarker[]
  priceLines?: PriceLine[]
  height?: number
  live?: boolean
  onData?: (data: CandlesResponse) => void
}) {
  const [range, setRange] = useState<ChartRange>(defaultRange)
  const [interval, setInterval] = useState<ChartInterval | null>(defaultInterval ?? null)
  const [type, setType] = useState<ChartType>(defaultType)

  const { data, loading, error, reload } = useCandles(ticker, range, interval, { live })

  useEffect(() => {
    if (data) onData?.(data)
    // onData は毎レンダー変わり得るので依存に含めない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const options = data?.rangeOptions ?? []
  const visibleRanges = ranges ? options.filter((o) => ranges.includes(o.range)) : options
  const current = options.find((o) => o.range === range)
  const intervalLabels = data?.intervalLabels ?? {}
  const allIntervals = [...new Set(options.flatMap((o) => o.intervals))]

  const changeRange = (next: ChartRange) => {
    setRange(next)
    // いまの時間足が新しい期間で使えないなら、その期間の既定に戻す
    const spec = options.find((o) => o.range === next)
    if (spec && interval && !spec.intervals.includes(interval)) setInterval(null)
  }

  if (error) {
    return <ErrorBlock message={error} onRetry={() => void reload()} />
  }

  if (!data) {
    return <LoadingBlock message="チャートを読み込み中…" />
  }

  return (
    <div>
      {/* 操作列：期間 / 表示形式 */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1 rounded-xl bg-canvas-2 p-1">
          {visibleRanges.map((o) => (
            <button
              key={o.range}
              type="button"
              onClick={() => changeRange(o.range)}
              aria-pressed={o.range === range}
              className={cn(
                'rounded-lg px-2.5 py-1.5 text-[0.8125rem] font-medium transition focus-ring',
                o.range === range ? 'bg-brand text-white shadow-sm' : 'text-muted hover:text-ink',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 rounded-xl bg-canvas-2 p-1">
          {(['line', 'candle'] as ChartType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              aria-pressed={type === t}
              className={cn(
                'rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium transition focus-ring',
                type === t ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink',
              )}
            >
              {t === 'line' ? 'ライン' : 'ローソク足'}
            </button>
          ))}
        </div>
      </div>

      {/* 時間足。その期間で選べないものは無効にする */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-muted">時間足</span>
        {allIntervals.map((iv) => {
          const available = current?.intervals.includes(iv) ?? false
          const active = data.interval === iv
          return (
            <button
              key={iv}
              type="button"
              disabled={!available}
              onClick={() => setInterval(iv)}
              aria-pressed={active}
              title={available ? undefined : `${data.range} の表示では選べません`}
              className={cn(
                'rounded-lg border px-2 py-1 text-xs font-medium transition focus-ring',
                active
                  ? 'border-brand bg-brand-soft text-brand'
                  : available
                    ? 'border-line bg-white text-muted hover:text-ink'
                    : 'cursor-not-allowed border-line-soft bg-canvas-2 text-faint',
              )}
            >
              {intervalLabels[iv] ?? iv}
            </button>
          )
        })}
        {loading ? <span className="ml-1 text-xs text-faint">更新中…</span> : null}
      </div>

      {data.notice ? (
        <p className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
          <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {data.notice}
        </p>
      ) : null}

      <MarketChart
        candles={data.candles}
        currency={currency}
        type={type}
        markers={markers}
        priceLines={priceLines}
        height={height}
      />

      <p className="mt-3 text-xs text-faint">
        {data.candles.length}本
        {data.aggregatedBy > 1 ? `（${data.aggregatedBy}本ずつまとめて表示）` : ''}
        {data.timezone ? ` ・ 時刻は${data.timezone === 'Asia/Tokyo' ? '日本時間' : '現地時間'}` : ''}
        {' ・ '}
        表示価格には遅延が発生する場合があります。実際の注文には使用しないでください。
      </p>
    </div>
  )
}
