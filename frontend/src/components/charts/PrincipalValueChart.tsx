import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Currency } from '../../lib/types'
import { formatDateSlash, formatMoney, formatSignedMoney } from '../../lib/format'
import { CHART_COLORS, makeDateTickFormatter, makeValueTickFormatter, paddedDomain } from './chartUtils'

export interface PrincipalValuePoint {
  date: string
  value: number
  principal: number
}

/**
 * 積立シミュレーションのグラフ。
 *
 * 「自分が入れたお金（元本）」と「今いくらになっているか（評価額）」を
 * 同じ軸で重ね、その差＝増えた金額が一目で分かるようにする。
 */
export function PrincipalValueChart({
  data,
  currency,
  height = 320,
}: {
  data: PrincipalValuePoint[]
  currency: Currency
  height?: number
}) {
  const dates = data.map((d) => d.date)
  const tickX = makeDateTickFormatter(dates)
  const tickY = makeValueTickFormatter(currency)
  const last = data[data.length - 1]
  const gaining = last ? last.value >= last.principal : true
  const valueColor = gaining ? CHART_COLORS.gain : CHART_COLORS.loss
  const domain = paddedDomain(data.flatMap((d) => [d.value, d.principal]))
  const gradientId = `dca-${gaining ? 'gain' : 'loss'}`

  return (
    <>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 4 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={valueColor} stopOpacity={0.18} />
                <stop offset="100%" stopColor={valueColor} stopOpacity={0.01} />
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
              width={58}
            />
            <Tooltip
              content={(props) => <DcaTooltip {...props} currency={currency} />}
              cursor={{ stroke: CHART_COLORS.grid, strokeWidth: 2 }}
            />
            <Area
              type="monotone"
              dataKey="value"
              name="評価額"
              stroke={valueColor}
              strokeWidth={2.4}
              fill={`url(#${gradientId})`}
              activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="principal"
              name="投資元本"
              stroke={CHART_COLORS.axis}
              strokeWidth={1.6}
              strokeDasharray="5 4"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 rounded" style={{ backgroundColor: valueColor }} />
          評価額（今いくら）
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-0 w-5 border-t border-dashed"
            style={{ borderColor: CHART_COLORS.axis }}
          />
          投資元本（自分が入れたお金）
        </span>
      </div>
    </>
  )
}

function DcaTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean
  payload?: readonly { dataKey?: unknown; value?: unknown }[]
  label?: string | number
  currency: Currency
}) {
  if (!active || !payload?.length) return null
  const get = (key: string) => {
    const hit = payload.find((e) => String(e.dataKey) === key)
    return hit ? Number(hit.value) : null
  }
  const value = get('value')
  const principal = get('principal')
  if (value == null || principal == null) return null
  const diff = value - principal

  return (
    <div className="min-w-44 rounded-xl border border-line bg-white px-3 py-2 shadow-card">
      <p className="mb-1 text-xs text-muted">{formatDateSlash(String(label ?? ''))}</p>
      <p className="flex items-center justify-between gap-4 text-sm">
        <span className="text-muted">評価額</span>
        <span className="num text-ink">{formatMoney(value, currency)}</span>
      </p>
      <p className="flex items-center justify-between gap-4 text-sm">
        <span className="text-muted">元本</span>
        <span className="num text-ink">{formatMoney(principal, currency)}</span>
      </p>
      <p className="mt-1 flex items-center justify-between gap-4 border-t border-line-soft pt-1 text-sm">
        <span className="text-muted">増えた額</span>
        <span className={`num ${diff >= 0 ? 'text-gain' : 'text-loss'}`}>
          {formatSignedMoney(diff, currency)}
        </span>
      </p>
    </div>
  )
}
