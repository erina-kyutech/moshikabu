import { cn } from './cn'

/** 期間切り替えなどのセグメント型タブ。選択中は青背景。 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  size = 'sm',
}: {
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: string }>
  ariaLabel: string
  size?: 'sm' | 'md'
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex flex-wrap gap-1 rounded-xl bg-canvas-2 p-1"
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded-lg font-medium transition focus-ring',
              size === 'sm' ? 'px-3 py-1.5 text-[0.8125rem]' : 'px-4 py-2 text-sm',
              active ? 'bg-brand text-white shadow-sm' : 'text-muted hover:text-ink',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** 下線タイプのタブ（銘柄詳細の 概要 / チャート / 保有詳細）。 */
export function UnderlineTabs<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: string }>
  ariaLabel: string
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex gap-6 border-b border-line">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              '-mb-px border-b-2 px-1 pb-3 text-sm font-medium transition focus-ring',
              active ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
