import { useMemo } from 'react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Candle, ChartType, Currency } from '../../lib/types'
import { formatPrice, formatVolume } from '../../lib/format'
import { CHART_COLORS, candleGeometry, makeValueTickFormatter, paddedDomain } from './chartUtils'
import { cn } from '../ui/cn'

const UP = CHART_COLORS.gain
const DOWN = CHART_COLORS.loss

export interface ChartMarker {
  /** 売買した時刻（ISO）。表示中のローソクに合わせて自動でスナップする */
  time: string
  price: number
  side: 'buy' | 'sell'
  label: string
}

export interface PriceLine {
  price: number
  label: string
  color: string
  dashed?: boolean
  /** ラベルを置く側。同じ価格に複数の線が重なっても読めるように左右へ分ける */
  align?: 'left' | 'right'
}

interface Row {
  k: string
  label: string
  fullLabel: string
  o: number
  h: number
  l: number
  c: number
  v: number
  range: [number, number]
  up: boolean
}

/**
 * ローソク足／ラインの切り替えと出来高を1つにまとめたチャート。
 *
 * 横軸は時刻そのもの（t）をキーにしている。分足では「09:05」が日をまたいで重複するため、
 * ラベルを軸のキーにすると売買地点のマーカーがずれてしまう。
 */
export function MarketChart({
  candles,
  currency,
  type = 'line',
  markers = [],
  priceLines = [],
  height = 320,
  volumeHeight = 78,
  showVolume = true,
  clampMarkers = false,
}: {
  candles: Candle[]
  currency: Currency
  type?: ChartType
  markers?: ChartMarker[]
  priceLines?: PriceLine[]
  height?: number
  volumeHeight?: number
  showVolume?: boolean
  /** 表示期間の外にある売買地点を、端のローソクに寄せて必ず描く
      （表示期間＝その売買の期間、と決まっている画面で使う） */
  clampMarkers?: boolean
}) {
  const rows: Row[] = useMemo(
    () =>
      candles.map((c) => ({
        k: c.t,
        label: c.label,
        fullLabel: c.fullLabel,
        o: c.o,
        h: c.h,
        l: c.l,
        c: c.c,
        v: c.v ?? 0,
        range: [c.l, c.h] as [number, number],
        up: c.c >= c.o,
      })),
    [candles],
  )

  const labelByKey = useMemo(() => new Map(rows.map((r) => [r.k, r.label])), [rows])

  /**
   * 売買時刻を、表示中のローソクの位置に合わせる。
   * 表示期間より前の取引は描かない（先頭に寄せると誤解を招くため）。
   */
  const placedMarkers = useMemo(() => {
    if (rows.length === 0) return []
    const times = rows.map((r) => new Date(r.k).getTime())
    const first = times[0]
    return markers.flatMap((m) => {
      const at = new Date(m.time).getTime()
      if (!Number.isFinite(at)) return []
      if (at < first) {
        // 休場日に買った場合など、先頭のローソクより前になることがある
        return clampMarkers ? [{ ...m, k: rows[0].k }] : []
      }
      let index = 0
      for (let i = 0; i < times.length; i++) {
        if (times[i] <= at) index = i
        else break
      }
      return [{ ...m, k: rows[index].k }]
    })
  }, [rows, markers, clampMarkers])
  const domain = useMemo(
    () =>
      paddedDomain(
        rows.flatMap((r) => (type === 'candle' ? [r.l, r.h] : [r.c])).concat(priceLines.map((l) => l.price)),
      ),
    [rows, type, priceLines],
  )
  const tickY = makeValueTickFormatter(currency)
  const hasVolume = showVolume && rows.some((r) => r.v > 0)

  if (rows.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted">表示できるデータがありませんでした。</p>
    )
  }

  const axisProps = {
    dataKey: 'k',
    tickFormatter: (k: string) => labelByKey.get(k) ?? '',
    tick: { fill: CHART_COLORS.axis, fontSize: 11 },
    axisLine: { stroke: CHART_COLORS.grid },
    tickLine: false,
    minTickGap: 44,
  } as const

  return (
    <div>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <ComposedChart data={rows} margin={{ top: 16, right: 56, bottom: 4, left: 4 }} syncId="market">
            <defs>
              <linearGradient id="market-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.line} stopOpacity={0.16} />
                <stop offset="100%" stopColor={CHART_COLORS.line} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis {...axisProps} hide={hasVolume} />
            <YAxis
              domain={domain}
              tickFormatter={tickY}
              tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={58}
              orientation="right"
            />
            <Tooltip
              content={(props) => <CandleTooltip {...props} currency={currency} />}
              cursor={{ stroke: CHART_COLORS.axis, strokeWidth: 1, strokeDasharray: '3 3' }}
            />

            {priceLines.map((line) => (
              <ReferenceLine
                key={`${line.label}-${line.price}`}
                y={line.price}
                stroke={line.color}
                strokeWidth={1.2}
                strokeDasharray={line.dashed === false ? undefined : '4 4'}
                label={{
                  value: `${line.label} ${formatPrice(line.price, currency)}`,
                  position: line.align === 'left' ? 'insideBottomLeft' : 'insideTopRight',
                  fill: line.color,
                  fontSize: 10,
                  fontWeight: 600,
                }}
              />
            ))}

            {type === 'candle' ? (
              <Bar dataKey="range" shape={<CandleShape />} isAnimationActive={false} />
            ) : (
              <Area
                type="monotone"
                dataKey="c"
                stroke={CHART_COLORS.line}
                strokeWidth={2}
                fill="url(#market-area)"
                activeDot={{ r: 3.5, strokeWidth: 2, stroke: '#fff' }}
                isAnimationActive={false}
              />
            )}

            {placedMarkers.map((m) => (
              <ReferenceDot
                key={`${m.side}-${m.time}-${m.price}`}
                x={m.k}
                y={m.price}
                r={5}
                fill={m.side === 'buy' ? CHART_COLORS.line : DOWN}
                stroke="#fff"
                strokeWidth={2}
                label={{
                  value: m.label,
                  position: m.side === 'buy' ? 'bottom' : 'top',
                  fill: m.side === 'buy' ? CHART_COLORS.line : DOWN,
                  fontSize: 10,
                  fontWeight: 700,
                }}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {hasVolume ? (
        <div style={{ width: '100%', height: volumeHeight }}>
          <ResponsiveContainer>
            <BarChart data={rows} margin={{ top: 4, right: 56, bottom: 4, left: 4 }} syncId="market">
              <XAxis {...axisProps} />
              <YAxis hide domain={[0, (max: number) => max * 1.15]} />
              <Tooltip content={() => null} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
              <Bar dataKey="v" isAnimationActive={false} shape={<VolumeShape />} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </div>
  )
}

/** ローソク1本（ヒゲ＋実体）。Bar の range=[安値, 高値] から価格→ピクセルを割り出す。 */
function CandleShape(props: unknown) {
  const { x, y, width, height, payload } = props as {
    x: number
    y: number
    width: number
    height: number
    payload: Row
  }
  if (payload == null || !Number.isFinite(y) || !Number.isFinite(height)) return null

  const { bodyTop, bodyHeight, up } = candleGeometry(y, height, payload)
  const color = up ? UP : DOWN
  const bodyW = Math.max(1, Math.min(width * 0.72, 14))
  const cx = x + width / 2

  return (
    <g>
      {/* ヒゲ（高値〜安値）と実体（始値〜終値） */}
      <line x1={cx} x2={cx} y1={y} y2={y + height} stroke={color} strokeWidth={1} />
      <rect x={cx - bodyW / 2} y={bodyTop} width={bodyW} height={bodyHeight} fill={color} />
    </g>
  )
}

/** 出来高の棒。上げの足は緑、下げの足は赤にして価格と対応させる。 */
function VolumeShape(props: unknown) {
  const { x, y, width, height, payload } = props as {
    x: number
    y: number
    width: number
    height: number
    payload: Row
  }
  if (!Number.isFinite(height) || height <= 0) return null
  const w = Math.max(1, Math.min(width * 0.72, 14))
  return (
    <rect
      x={x + width / 2 - w / 2}
      y={y}
      width={w}
      height={height}
      fill={payload?.up ? UP : DOWN}
      opacity={0.3}
    />
  )
}

function CandleTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean
  payload?: readonly { payload?: Row }[]
  currency: Currency
}) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  const diff = row.c - row.o
  return (
    <div className="min-w-44 rounded-xl border border-line bg-white px-3 py-2 shadow-card">
      <p className="mb-1 text-xs text-muted">{row.fullLabel}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        <Row2 label="始値" value={formatPrice(row.o, currency)} />
        <Row2 label="高値" value={formatPrice(row.h, currency)} />
        <Row2 label="安値" value={formatPrice(row.l, currency)} />
        <Row2
          label="終値"
          value={formatPrice(row.c, currency)}
          className={cn(diff > 0 ? 'text-gain' : diff < 0 ? 'text-loss' : 'text-ink')}
        />
        {row.v > 0 ? <Row2 label="出来高" value={formatVolume(row.v)} /> : null}
      </dl>
    </div>
  )
}

function Row2({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className={cn('num text-right text-ink', className)}>{value}</dd>
    </>
  )
}
