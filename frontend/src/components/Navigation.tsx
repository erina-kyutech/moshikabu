import { Link, NavLink, useLocation } from 'react-router-dom'
import { cn } from './ui/cn'
import {
  ChartIcon,
  ClockIcon,
  CompareIcon,
  HomeIcon,
  CandleIcon,
  ListIcon,
  Logo,
  StackIcon,
  WalletIcon,
} from './Icons'

interface NavItem {
  to: string
  label: string
  Icon: (props: { className?: string }) => React.ReactElement
  end?: boolean
  /** 配下のページも「選択中」として扱うためのプレフィックス */
  match?: string[]
}

/** PC のヘッダーに並べる項目。ラベルは短く保つ。 */
const DESKTOP_ITEMS: NavItem[] = [
  { to: '/', label: 'ホーム', Icon: HomeIcon, end: true },
  { to: '/past', label: '過去シミュレーション', Icon: ClockIcon },
  { to: '/compare', label: '銘柄比較', Icon: CompareIcon },
  { to: '/recurring', label: '積立', Icon: StackIcon, match: ['/compare-strategy'] },
  { to: '/daytrade', label: 'デイトレ', Icon: CandleIcon },
  { to: '/portfolio', label: 'ポートフォリオ', Icon: WalletIcon },
  { to: '/history', label: '取引履歴', Icon: ListIcon },
]

/** スマホの下部ナビ。4項目に絞り、各シミュレーションは一覧ページ経由で開く。 */
const MOBILE_ITEMS: NavItem[] = [
  { to: '/', label: 'ホーム', Icon: HomeIcon, end: true },
  {
    to: '/simulations',
    label: 'シミュレーション',
    Icon: ClockIcon,
    match: ['/past', '/compare', '/recurring', '/compare-strategy', '/daytrade'],
  },
  { to: '/portfolio', label: 'ポートフォリオ', Icon: WalletIcon },
  { to: '/history', label: '履歴', Icon: ListIcon },
]

const matchesSubPage = (item: NavItem, pathname: string) =>
  (item.match ?? []).some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))

export function Navigation() {
  const { pathname } = useLocation()
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" className="focus-ring flex items-center gap-2 rounded-lg">
          <Logo className="h-7 w-7" />
          <span className="text-[1.0625rem] font-bold tracking-tight text-ink">MoshiKabu</span>
        </Link>

        <nav aria-label="メインナビゲーション" className="hidden items-center gap-0.5 lg:flex">
          {DESKTOP_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'rounded-lg px-2.5 py-2 text-sm font-medium transition focus-ring',
                  isActive || matchesSubPage(item, pathname)
                    ? 'bg-brand-soft text-brand'
                    : 'text-muted hover:bg-canvas-2 hover:text-ink',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* 画面幅が足りないPCでは一覧ページへまとめる */}
        <nav aria-label="メインナビゲーション" className="hidden items-center gap-0.5 md:flex lg:hidden">
          <NavLink
            to="/simulations"
            className={({ isActive }) =>
              cn(
                'rounded-lg px-3 py-2 text-sm font-medium transition focus-ring',
                isActive ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-canvas-2 hover:text-ink',
              )
            }
          >
            シミュレーション
          </NavLink>
          <NavLink
            to="/portfolio"
            className={({ isActive }) =>
              cn(
                'rounded-lg px-3 py-2 text-sm font-medium transition focus-ring',
                isActive ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-canvas-2 hover:text-ink',
              )
            }
          >
            ポートフォリオ
          </NavLink>
          <NavLink
            to="/history"
            className={({ isActive }) =>
              cn(
                'rounded-lg px-3 py-2 text-sm font-medium transition focus-ring',
                isActive ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-canvas-2 hover:text-ink',
              )
            }
          >
            取引履歴
          </NavLink>
        </nav>

        <Link
          to="/invest"
          className="focus-ring hidden h-9 shrink-0 items-center gap-1.5 rounded-lg bg-gain px-3.5 text-sm font-semibold text-white transition hover:bg-[#128a3f] md:inline-flex"
        >
          <ChartIcon className="h-4 w-4" />
          仮想投資
        </Link>

        <span className="text-xs text-faint md:hidden">仮想投資シミュレーター</span>
      </div>
    </header>
  )
}

export function MobileBottomNavigation() {
  const { pathname } = useLocation()
  return (
    <nav
      aria-label="モバイルナビゲーション"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/97 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto flex max-w-lg">
        {MOBILE_ITEMS.map(({ to, label, Icon, end, match }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 whitespace-nowrap px-0.5 py-2 text-[0.625rem] font-medium transition',
                  isActive || matchesSubPage({ to, label, Icon, match }, pathname)
                    ? 'text-brand'
                    : 'text-faint',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn('h-[22px] w-[22px]', isActive && 'text-brand')} />
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
