import type { ReactNode } from 'react'
import { cn } from './cn'

type Tone = 'neutral' | 'brand' | 'gain' | 'loss' | 'warn'

const tones: Record<Tone, string> = {
  neutral: 'bg-canvas-2 text-muted border-line',
  brand: 'bg-brand-soft text-brand border-brand/15',
  gain: 'bg-gain-soft text-gain border-gain/20',
  loss: 'bg-loss-soft text-loss border-loss/20',
  warn: 'bg-amber-50 text-amber-700 border-amber-200',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium',
        tones[tone],
      )}
    >
      {children}
    </span>
  )
}
