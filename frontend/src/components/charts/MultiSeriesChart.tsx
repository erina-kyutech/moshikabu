import { useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Currency } from '../../lib/types'
import { formatDateSlash, formatMoney } from '../../lib/format'
import { cn } from '../ui/cn'
import {
  CHART_COLORS,
  makeDateTickFormatter,
  makeValueTickFormatter,
  paddedDomain,
  seriesColor,
} from './chartUtils'

export interface SeriesMeta {
  /** Recharts の dataKey。ティッカーは点を含むので使わない */
  key: string
  label: string
  sublabel?: string
  color: string
}

/**
 * 複数銘柄の資産額推移を1つのグラフに重ねる。
 * 凡例をクリックすると、その銘柄の表示・非表示を切り替えられる。
 */
export function MultiSeriesChart({
  data,
  seriesList,
  currency,
  height = 340,
}: {
  data: Array<Record<string, number | string>>
  seriesList: SeriesMeta[]
  currency: Currency
  height?: number
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  const toggle = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev)
      // 最後の1本まで消すと何も見えなくなるので、その場合は無視する
      if (next.has(key)) next.delete(key)
      else if (seriesList.length - next.size > 1) next.add(key)
      return next
    })

  const visible = seriesList.filter((s) => !hidden.has(s.key))
  const dates = data.map((d) => String(d.date))
  const tickX = makeDateTickFormatter(dates)
  const tickY = makeValueTickFormatter(currency)
  const values = data.flatMap((row) =>
    visible.map((s) => row[s.key]).filter((v): v is number => typeof v === 'number'),
  )
  const domain = paddedDomain(values)

  return (
    <>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 4 }}>
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
              content={(props) => (
                <MultiTooltip {...props} seriesList={visible} currency={currency} />
              )}
              cursor={{ stroke: CHART_COLORS.grid, strokeWidth: 2 }}
            />
            {visible.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2.2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 凡例。クリックで表示切り替え */}
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
        {seriesList.map((s) => {
          const off = hidden.has(s.key)
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => toggle(s.key)}
                aria-pressed={!off}
                className={cn(
                  'focus-ring flex items-center gap-2 rounded-lg px-2 py-1 text-sm transition',
                  off ? 'text-faint hover:text-muted' : 'text-ink hover:bg-canvas-2',
                )}
              >
                <span
                  className="inline-block h-0.5 w-5 shrink-0 rounded"
                  style={{ backgroundColor: off ? '#CBD5E1' : s.color }}
                />
                <span className={cn('font-medium', off && 'line-through')}>{s.label}</span>
                {s.sublabel ? <span className="text-xs text-muted">{s.sublabel}</span> : null}
              </button>
            </li>
          )
        })}
      </ul>
      <p className="mt-2 text-xs text-faint">凡例をクリックすると表示・非表示を切り替えられます。</p>
    </>
  )
}

function MultiTooltip({
  active,
  payload,
  label,
  seriesList,
  currency,
}: {
  active?: boolean
  payload?: readonly { dataKey?: unknown; value?: unknown }[]
  label?: string | number
  seriesList: SeriesMeta[]
  currency: Currency
}) {
  if (!active || !payload?.length) return null

  const byKey = new Map(seriesList.map((s) => [s.key, s]))
  const rows = payload
    .map((entry) => ({
      meta: byKey.get(String(entry.dataKey)),
      value: Number(entry.value),
    }))
    .filter((r) => r.meta && Number.isFinite(r.value))
    .sort((a, b) => b.value - a.value)

  if (rows.length === 0) return null

  return (
    <div className="min-w-44 rounded-xl border border-line bg-white px-3 py-2 shadow-card">
      <p className="mb-1 text-xs text-muted">{formatDateSlash(String(label ?? ''))}</p>
      {rows.map((r) => (
        <p key={r.meta!.key} className="flex items-center justify-between gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-ink">
            <span
              className="inline-block h-0.5 w-3 shrink-0 rounded"
              style={{ backgroundColor: r.meta!.color }}
            />
            {r.meta!.label}
          </span>
          <span className="num text-ink">{formatMoney(r.value, currency)}</span>
        </p>
      ))}
    </div>
  )
}

export const defaultSeriesColor = seriesColor
