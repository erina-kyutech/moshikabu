import type { ReactNode } from 'react'
import { cn } from './ui/cn'

type Tone = 'default' | 'gain' | 'loss' | 'brand'

const toneStyles: Record<Tone, { card: string; value: string; label: string }> = {
  default: { card: 'border-line bg-white', value: 'text-ink', label: 'text-muted' },
  brand: { card: 'border-brand/15 bg-brand-soft', value: 'text-brand', label: 'text-brand/70' },
  gain: { card: 'border-gain/20 bg-gain-soft', value: 'text-gain', label: 'text-gain/80' },
  loss: { card: 'border-loss/20 bg-loss-soft', value: 'text-loss', label: 'text-loss/80' },
}

/** ラベル小 / 数値大 の指標カード。 */
export function MetricCard({
  label,
  value,
  sub,
  tone = 'default',
  size = 'md',
  className,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: Tone
  size?: 'md' | 'lg'
  className?: string
}) {
  const s = toneStyles[tone]
  return (
    <div className={cn('rounded-2xl border p-4 shadow-card sm:p-5', s.card, className)}>
      <p className={cn('text-xs font-medium sm:text-[0.8125rem]', s.label)}>{label}</p>
      <p
        className={cn(
          'num mt-1.5 leading-tight',
          s.value,
          size === 'lg' ? 'text-2xl sm:text-[1.75rem]' : 'text-xl sm:text-2xl',
        )}
      >
        {value}
      </p>
      {sub ? <p className={cn('mt-1 text-xs', s.label)}>{sub}</p> : null}
    </div>
  )
}
