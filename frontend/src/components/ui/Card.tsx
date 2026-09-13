import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg'
  children: ReactNode
}

const paddings = {
  none: '',
  sm: 'p-4 sm:p-5',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-8',
}

export function Card({ padding = 'md', className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-line bg-white shadow-card',
        paddings[padding],
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

export function CardTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-base font-bold text-ink sm:text-lg">{children}</h2>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  )
}
