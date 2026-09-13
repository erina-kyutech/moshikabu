import {
  Area,
  ComposedChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Currency } from '../../lib/types'
import { formatMoney } from '../../lib/format'
import { ChartTooltip } from './ChartTooltip'
import { CHART_COLORS, makeDateTickFormatter, makeValueTickFormatter, paddedDomain } from './chartUtils'

export interface ValuePointLite {
  date: string
  value: number
  /** その時点までの投資総額（追加購入があると増える） */
  invested?: number
}

/**
 * 仮想資産額の推移。
 *
 * 投資額を基準として重ねることで、「増えているのか / 買い増したから増えたのか」を
 * 初心者でも見分けられるようにする。
 */
export function ValueChart({
  data,
  currency,
  baseline,
  showInvestedLine = false,
  height = 280,
  tone,
}: {
  data: ValuePointLite[]
  currency: Currency
  /** 一定の投資額（過去シミュレーションなど、途中で増えない場合） */
  baseline?: number
  /** 投資額が時系列で変わる場合は線で重ねる */
  showInvestedLine?: boolean
  height?: number
  tone?: 'gain' | 'loss'
}) {
  const dates = data.map((d) => d.date)
  const tickX = makeDateTickFormatter(dates)
  const tickY = makeValueTickFormatter(currency)
  const values = data.map((d) => d.value)
  if (baseline != null) values.push(baseline)
  if (showInvestedLine) {
    for (const d of data) if (d.invested != null) values.push(d.invested)
  }
  const domain = paddedDomain(values)

  const color = tone === 'loss' ? CHART_COLORS.loss : tone === 'gain' ? CHART_COLORS.gain : CHART_COLORS.area
  const gradientId = `value-gradient-${tone ?? 'brand'}`

  return (
    <>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 4 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.18} />
                <stop offset="100%" stopColor={color} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={tickX}
              tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
              axisLine={{ stroke: CHART_COLORS.grid }}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              domain={domain}
              tickFormatter={tickY}
              tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip
              content={(props) => (
                <ChartTooltip
                  {...props}
                  labelPrefix={showInvestedLine ? undefined : '評価額'}
                  names={showInvestedLine ? { value: '評価額', invested: '投資額' } : undefined}
                  formatValue={(v) => formatMoney(v, currency)}
                />
              )}
              cursor={{ stroke: CHART_COLORS.grid, strokeWidth: 2 }}
            />
            {baseline != null && !showInvestedLine ? (
              <ReferenceLine
                y={baseline}
                stroke={CHART_COLORS.axis}
                strokeDasharray="4 4"
                strokeWidth={1.2}
                label={{
                  value: '投資額',
                  position: 'insideTopLeft',
                  fill: CHART_COLORS.axis,
                  fontSize: 11,
                }}
              />
            ) : null}
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2.4}
              fill={`url(#${gradientId})`}
              activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
              isAnimationActive={false}
            />
            {showInvestedLine ? (
              <Line
                type="stepAfter"
                dataKey="invested"
                stroke={CHART_COLORS.axis}
                strokeWidth={1.4}
                strokeDasharray="5 4"
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {showInvestedLine ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-5 rounded" style={{ backgroundColor: color }} />
            評価額
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-0 w-5 border-t border-dashed"
              style={{ borderColor: CHART_COLORS.axis }}
            />
            投資額（買い増すと増えます）
          </span>
        </div>
      ) : null}
    </>
  )
}
