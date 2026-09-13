import { cn } from './ui/cn'

const PALETTE = ['#2563EB', '#0EA5E9', '#6366F1', '#0F766E', '#B45309', '#7C3AED', '#0891B2', '#BE123C']

function hueOf(ticker: string): string {
  let h = 0
  for (let i = 0; i < ticker.length; i++) h = (h * 31 + ticker.charCodeAt(i)) % 9973
  return PALETTE[h % PALETTE.length]
}

/** 銘柄のアイコン代わり。外部リクエストなしで一意な見た目にする。 */
export function StockAvatar({
  ticker,
  name,
  size = 'md',
}: {
  ticker: string
  name?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const label = ticker.endsWith('.T') ? ticker.slice(0, 2) : ticker.slice(0, 2)
  const dims = { sm: 'h-8 w-8 text-[0.7rem]', md: 'h-10 w-10 text-xs', lg: 'h-14 w-14 text-base' }[size]
  return (
    <span
      aria-hidden
      title={name}
      className={cn('flex shrink-0 items-center justify-center rounded-xl font-bold text-white', dims)}
      style={{ backgroundColor: hueOf(ticker) }}
    >
      {label}
    </span>
  )
}
