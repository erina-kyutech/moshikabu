import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRightIcon } from './Icons'

export type ModeTone = 'brand' | 'gain' | 'compare' | 'recurring' | 'ink'

const TONES: Record<ModeTone, { icon: string; button: string; ring: string }> = {
  brand: {
    icon: 'bg-brand-soft text-brand',
    button: 'bg-brand hover:bg-brand-600 shadow-[0_2px_10px_rgba(37,99,235,0.22)]',
    ring: 'hover:border-brand/30',
  },
  gain: {
    icon: 'bg-gain-soft text-gain',
    button: 'bg-gain hover:bg-[#128a3f] shadow-[0_2px_10px_rgba(22,163,74,0.22)]',
    ring: 'hover:border-gain/30',
  },
  compare: {
    icon: 'bg-compare-soft text-compare',
    button: 'bg-compare hover:bg-[#6d28d9] shadow-[0_2px_10px_rgba(124,58,237,0.22)]',
    ring: 'hover:border-[color:var(--color-compare)]/30',
  },
  recurring: {
    icon: 'bg-recurring-soft text-recurring',
    button: 'bg-recurring hover:bg-[#c2410c] shadow-[0_2px_10px_rgba(234,88,12,0.22)]',
    ring: 'hover:border-[color:var(--color-recurring)]/30',
  },
  ink: {
    icon: 'bg-canvas-2 text-ink',
    button: 'bg-ink hover:bg-[#1e293b] shadow-[0_2px_10px_rgba(15,23,42,0.22)]',
    ring: 'hover:border-ink/25',
  },
}

/** ホームと「シミュレーション」一覧で共通して使う、機能選択の大きなカード。 */
export function ModeCard({
  to,
  tone,
  icon,
  title,
  description,
  cta,
  compact,
  className,
}: {
  to: string
  tone: ModeTone
  icon: ReactNode
  title: ReactNode
  description: ReactNode
  cta: string
  compact?: boolean
  className?: string
}) {
  const styles = TONES[tone]
  return (
    <Link
      to={to}
      className={`group flex flex-col rounded-2xl border border-line bg-white text-center shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover focus-ring ${
        compact ? 'p-6' : 'p-7 sm:p-8'
      } ${styles.ring} ${className ?? ''}`}
    >
      <span
        className={`mx-auto flex items-center justify-center rounded-2xl ${
          compact ? 'h-12 w-12' : 'h-14 w-14'
        } ${styles.icon}`}
      >
        {icon}
      </span>
      <h3
        className={`mt-4 font-bold leading-snug text-ink ${
          compact ? 'text-lg' : 'text-lg sm:text-xl'
        }`}
      >
        {title}
      </h3>
      <p className="mt-2.5 flex-1 text-sm leading-relaxed text-muted">{description}</p>
      <span
        className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl font-semibold text-white transition ${
          compact ? 'h-11 text-[0.9375rem]' : 'h-13 text-base'
        } ${styles.button}`}
      >
        {cta}
        <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}

/** 4つの機能の定義。ホームと一覧ページで同じものを使う。 */
export interface ModeDef {
  to: string
  tone: ModeTone
  title: ReactNode
  description: ReactNode
  cta: string
  iconKey: 'clock' | 'chart' | 'compare' | 'stack' | 'candle'
}

export const MODES: ModeDef[] = [
  {
    to: '/past',
    tone: 'brand',
    iconKey: 'clock',
    title: (
      <>
        もし、あの日
        <br />
        買っていたら？
      </>
    ),
    description: '過去に1つの株を買っていた場合をシミュレーション',
    cta: 'シミュレーションする',
  },
  {
    to: '/invest',
    tone: 'gain',
    iconKey: 'chart',
    title: (
      <>
        今日から
        <br />
        仮想投資
      </>
    ),
    description: '現実の株価でお金を使わず投資体験',
    cta: '仮想投資を始める',
  },
  {
    to: '/compare',
    tone: 'compare',
    iconKey: 'compare',
    title: (
      <>
        もし100万円ずつ
        <br />
        投資してたら？
      </>
    ),
    description: '複数の銘柄を同じ条件で比較',
    cta: '銘柄を比較する',
  },
  {
    to: '/recurring',
    tone: 'recurring',
    iconKey: 'stack',
    title: (
      <>
        もし毎月3万円
        <br />
        積み立ててたら？
      </>
    ),
    description: '過去の株価から積立投資をシミュレーション',
    cta: '積立を試す',
  },
  {
    to: '/daytrade',
    tone: 'ink',
    iconKey: 'candle',
    title: <>デイトレ練習</>,
    description: '実際の値動きを見ながら、お金を使わず売買練習',
    cta: '練習を始める',
  },
]
