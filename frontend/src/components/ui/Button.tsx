import { Link } from 'react-router-dom'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

type Variant = 'primary' | 'success' | 'secondary' | 'danger' | 'ghost'
type Size = 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition ' +
  'focus-ring disabled:cursor-not-allowed disabled:opacity-50 select-none'

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-600 shadow-[0_2px_8px_rgba(37,99,235,0.20)]',
  success: 'bg-gain text-white hover:bg-[#128a3f] shadow-[0_2px_8px_rgba(22,163,74,0.20)]',
  secondary: 'bg-white text-ink border border-line hover:bg-canvas-2',
  danger: 'bg-white text-loss border border-loss/40 hover:bg-loss-soft',
  ghost: 'bg-transparent text-muted hover:bg-canvas-2',
}

const sizes: Record<Size, string> = {
  md: 'h-11 px-4 text-[0.9375rem]',
  lg: 'h-13 px-6 text-base',
}

interface CommonProps {
  variant?: Variant
  size?: Size
  full?: boolean
  className?: string
  children: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  full,
  className,
  children,
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], full && 'w-full', className)}
      {...rest}
    >
      {children}
    </button>
  )
}

export function ButtonLink({
  to,
  variant = 'primary',
  size = 'md',
  full,
  className,
  children,
}: CommonProps & { to: string }) {
  return (
    <Link to={to} className={cn(base, variants[variant], sizes[size], full && 'w-full', className)}>
      {children}
    </Link>
  )
}
