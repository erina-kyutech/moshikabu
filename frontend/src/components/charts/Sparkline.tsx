import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts'
import { CHART_COLORS, paddedDomain } from './chartUtils'

/** 銘柄カードなどに添える小さな折れ線。軸・目盛りは出さない。 */
export function Sparkline({
  data,
  tone = 'brand',
  height = 44,
}: {
  data: Array<{ date: string; price: number }>
  tone?: 'brand' | 'gain' | 'loss'
  height?: number
}) {
  if (data.length < 2) return null
  const color =
    tone === 'gain' ? CHART_COLORS.gain : tone === 'loss' ? CHART_COLORS.loss : CHART_COLORS.line
  return (
    <div style={{ width: '100%', height }} aria-hidden>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 4, right: 2, bottom: 4, left: 2 }}>
          <YAxis hide domain={paddedDomain(data.map((d) => d.price))} />
          <Line
            type="monotone"
            dataKey="price"
            stroke={color}
            strokeWidth={1.8}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
