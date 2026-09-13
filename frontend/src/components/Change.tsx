import { cn } from './ui/cn'
import { signOf } from '../lib/format'

/**
 * 損益の表示。色だけに頼らず、必ず「▲/▼ + 符号」でも判別できるようにする。
 */
export function Change({
  value,
  text,
  sub,
  size = 'md',
  align = 'left',
}: {
  /** 正負の判定に使う数値 */
  value: number | null | undefined
  /** 表示テキスト（すでに符号付きで整形済みのもの） */
  text: string
  sub?: string
  size?: 'sm' | 'md' | 'lg'
  align?: 'left' | 'right'
}) {
  const sign = value == null ? 'flat' : signOf(value)
  const color =
    sign === 'gain' ? 'text-gain' : sign === 'loss' ? 'text-loss' : 'text-muted'
  const sizes = {
    sm: 'text-[0.8125rem]',
    md: 'text-[0.9375rem]',
    lg: 'text-2xl sm:text-3xl',
  }[size]

  return (
    <span className={cn('inline-flex flex-col', align === 'right' && 'items-end')}>
      <span className={cn('num inline-flex items-center gap-1', color, sizes)}>
        <Arrow sign={sign} size={size} />
        {text}
      </span>
      {sub ? <span className={cn('num text-xs', color)}>{sub}</span> : null}
    </span>
  )
}

function Arrow({ sign, size }: { sign: 'gain' | 'loss' | 'flat'; size: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'h-4 w-4' : 'h-3 w-3'
  if (sign === 'flat') {
    return (
      <svg viewBox="0 0 12 12" className={cls} aria-label="変化なし" role="img" fill="currentColor">
        <rect x="1" y="5" width="10" height="2" rx="1" />
      </svg>
    )
  }
  return (
    <svg
      viewBox="0 0 12 12"
      className={cls}
      role="img"
      aria-label={sign === 'gain' ? '上昇' : '下落'}
      fill="currentColor"
    >
      {sign === 'gain' ? <path d="M6 1.5 11 9.5H1z" /> : <path d="M6 10.5 1 2.5h10z" />}
    </svg>
  )
}
