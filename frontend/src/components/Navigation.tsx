import { NavLink, Link } from 'react-router-dom'
import { cn } from './ui/cn'
import { ChartIcon, ClockIcon, HomeIcon, ListIcon, Logo, WalletIcon } from './Icons'

interface NavItem {
  to: string
  label: string
  shortLabel: string
  Icon: (props: { className?: string }) => React.ReactElement
  end?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'ホーム', shortLabel: 'ホーム', Icon: HomeIcon, end: true },
  { to: '/past', label: '過去シミュレーション', shortLabel: 'シミュレーション', Icon: ClockIcon },
  { to: '/portfolio', label: '仮想ポートフォリオ', shortLabel: 'ポートフォリオ', Icon: WalletIcon },
  { to: '/history', label: '取引履歴', shortLabel: '履歴', Icon: ListIcon },
]

/** PC 用のヘッダーナビゲーション。 */
export function Navigation() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 focus-ring rounded-lg">
          <Logo className="h-7 w-7" />
          <span className="text-[1.0625rem] font-bold tracking-tight text-ink">MoshiKabu</span>
        </Link>

        <nav aria-label="メインナビゲーション" className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'rounded-lg px-3 py-2 text-sm font-medium transition focus-ring',
                  isActive ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-canvas-2 hover:text-ink',
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <Link
          to="/invest"
          className="hidden h-9 items-center gap-1.5 rounded-lg bg-gain px-3.5 text-sm font-semibold text-white transition hover:bg-[#128a3f] focus-ring md:inline-flex"
        >
          <ChartIcon className="h-4 w-4" />
          仮想投資
        </Link>

        <span className="text-xs text-faint md:hidden">仮想投資シミュレーター</span>
      </div>
    </header>
  )
}

/** スマートフォン用の下部固定ナビゲーション。 */
export function MobileBottomNavigation() {
  return (
    <nav
      aria-label="モバイルナビゲーション"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/97 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto flex max-w-lg">
        {NAV_ITEMS.map(({ to, shortLabel, Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 py-2 text-[0.6875rem] font-medium transition',
                  isActive ? 'text-brand' : 'text-faint',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn('h-[22px] w-[22px]', isActive && 'text-brand')} />
                  {shortLabel}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
