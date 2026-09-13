import { formatDateSlash } from '../../lib/format'

interface Entry {
  dataKey?: unknown
  value?: unknown
  name?: unknown
  color?: string
}

/** 共通ツールチップ。白カード＋薄い影で、情報は最小限に。 */
export function ChartTooltip({
  active,
  payload,
  label,
  formatValue,
  labelPrefix,
  names,
}: {
  active?: boolean
  payload?: readonly Entry[]
  label?: string | number
  formatValue: (v: number) => string
  /** 系列が1本のときの見出し */
  labelPrefix?: string
  /** dataKey → 表示名（系列が複数のとき） */
  names?: Record<string, string>
}) {
  if (!active || !payload?.length) return null
  const rows = payload.filter((e) => e.value != null && Number.isFinite(Number(e.value)))
  if (rows.length === 0) return null

  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2 shadow-card">
      <p className="text-xs text-muted">{formatDateSlash(String(label ?? ''))}</p>
      {rows.map((entry, i) => {
        const key = String(entry.dataKey ?? i)
        const name = names?.[key] ?? labelPrefix
        return (
          <p key={key} className="num mt-0.5 flex items-baseline gap-2 text-sm text-ink">
            {name ? <span className="text-xs font-normal text-muted">{name}</span> : null}
            {formatValue(Number(entry.value))}
          </p>
        )
      })}
    </div>
  )
}
