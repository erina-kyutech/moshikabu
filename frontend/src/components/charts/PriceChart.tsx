import {
  CartesianGrid,
  Label,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Currency } from '../../lib/types'
import { formatPrice } from '../../lib/format'
import { ChartTooltip } from './ChartTooltip'
import { CHART_COLORS, makeDateTickFormatter, makeValueTickFormatter, paddedDomain } from './chartUtils'

export interface PricePointLite {
  date: string
  price: number
}

export interface Marker {
  date: string
  price: number
  label: string
  color: string
}

/** 株価の推移。購入地点と現在地点をポイントで示す。 */
export function PriceChart({
  data,
  currency,
  markers = [],
  height = 300,
}: {
  data: PricePointLite[]
  currency: Currency
  markers?: Marker[]
  height?: number
}) {
  const dates = data.map((d) => d.date)
  const tickX = makeDateTickFormatter(dates)
  const tickY = makeValueTickFormatter(currency)
  const domain = paddedDomain(data.map((d) => d.price))

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 28, right: 56, bottom: 4, left: 4 }}>
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
            width={52}
          />
          <Tooltip
            content={(props) => (
              <ChartTooltip {...props} labelPrefix="株価" formatValue={(v) => formatPrice(v, currency)} />
            )}
            cursor={{ stroke: CHART_COLORS.grid, strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke={CHART_COLORS.line}
            strokeWidth={2.4}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
            isAnimationActive={false}
          />
          {markers.map((m) => (
            <ReferenceDot
              key={`${m.label}-${m.date}`}
              x={m.date}
              y={m.price}
              r={5}
              fill={m.color}
              stroke="#fff"
              strokeWidth={2}
            >
              <Label
                value={m.label}
                position="top"
                offset={10}
                fill={m.color}
                fontSize={11}
                fontWeight={700}
              />
            </ReferenceDot>
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
