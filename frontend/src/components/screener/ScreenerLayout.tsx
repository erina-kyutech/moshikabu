import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { cn } from '../ui/cn'
import {
  CandleIcon,
  ChartIcon,
  ClockIcon,
  HomeIcon,
  ListIcon,
  SearchIcon,
  StackIcon,
  WalletIcon,
} from '../Icons'

const ITEMS = [
  { to: '/', label: 'ホーム', Icon: HomeIcon, end: true },
  { to: '/past', label: '過去シミュレーション', Icon: ClockIcon },
  { to: '/portfolio', label: '仮想ポートフォリオ', Icon: WalletIcon },
  { to: '/daytrade', label: 'デイトレ練習', Icon: CandleIcon },
  { to: '/screener', label: '条件で銘柄を探す', Icon: SearchIcon },
  { to: '/screener/results', label: '検索結果', Icon: ListIcon },
  { to: '/backtest', label: 'ルールを過去で検証', Icon: StackIcon },
  { to: '/backtest/result', label: 'バックテスト結果', Icon: ChartIcon },
  { to: '/history', label: '取引履歴', Icon: ListIcon },
]

/**
 * 条件スクリーナー系の画面で使う、左サイドナビつきのレイアウト。
 * 既存画面のヘッダーナビはそのまま活かし、この区画の中だけサイドナビを足している。
 */
export function ScreenerLayout({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex gap-8">
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav aria-label="機能ナビゲーション" className="sticky top-20 space-y-0.5">
            {ITEMS.map(({ to, label, Icon, end }) => (
              <NavLink
                key={to + label}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'focus-ring flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition',
                    isActive ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-canvas-2 hover:text-ink',
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[1.75rem]">{title}</h1>
              {description ? (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>
              ) : null}
            </div>
            {action}
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
