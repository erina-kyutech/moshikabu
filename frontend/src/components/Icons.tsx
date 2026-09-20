/** アプリ内で使うアイコン（外部依存なしの軽量インラインSVG）。 */
type P = { className?: string }
const base = 'h-5 w-5'
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export const HomeIcon = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
    <path d="M3.5 10.5 12 4l8.5 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-6V20H4.5a1 1 0 0 1-1-1z" />
  </svg>
)

export const ClockIcon = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
)

export const ChartIcon = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
    <path d="M5 19V11M12 19V5M19 19v-6" />
  </svg>
)

export const WalletIcon = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
    <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H18a2 2 0 0 1 2 2v1H6.5A2.5 2.5 0 0 1 4 8.5z" />
    <path d="M4 8.5V17a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1V9" />
    <circle cx="16.5" cy="13.5" r="1.1" fill="currentColor" stroke="none" />
  </svg>
)

export const ListIcon = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
    <path d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" />
  </svg>
)

export const SearchIcon = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </svg>
)

export const ArrowRightIcon = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

export const ArrowLeftIcon = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </svg>
)

export const ChevronRightIcon = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
    <path d="m9 6 6 6-6 6" />
  </svg>
)

export const CheckIcon = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
)

export const InfoIcon = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8.2v.01" />
  </svg>
)

export const SplitIcon = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
    <path d="M6 4v4a4 4 0 0 0 4 4h4a4 4 0 0 1 4 4v4M18 4v4a4 4 0 0 1-4 4h-4a4 4 0 0 0-4 4v4" />
  </svg>
)

export const MenuIcon = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
)

export const CloseIcon = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
)

export const TrashIcon = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
    <path d="M4 7h16M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12" />
  </svg>
)

export const CompareIcon = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
    <path d="M4 19V9M10 19V5M16 19v-7M22 19h-2" />
    <path d="M2 19h2" />
    <path d="M4 9 10 5l6 7" strokeDasharray="0" opacity="0.45" />
  </svg>
)

export const StackIcon = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
    <path d="M4 18h4v3H4zM10 13h4v8h-4zM16 8h4v13h-4z" />
    <path d="M4 6h9M9.5 3 13 6l-3.5 3" opacity="0.55" />
  </svg>
)

export const CalendarIcon = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
    <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
  </svg>
)

export const CandleIcon = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
    <path d="M7 4v3M7 17v3M17 3v4M17 16v5" />
    <rect x="4.5" y="7" width="5" height="10" rx="1" />
    <rect x="14.5" y="7" width="5" height="9" rx="1" />
  </svg>
)

export const Logo = ({ className = 'h-7 w-7' }: P) => (
  <svg viewBox="0 0 64 64" className={className} aria-hidden>
    <rect width="64" height="64" rx="16" fill="#2563EB" />
    <path
      d="M13 43 L25 31 L35 39 L51 19"
      fill="none"
      stroke="#fff"
      strokeWidth="6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="51" cy="19" r="5" fill="#10B981" stroke="#fff" strokeWidth="3" />
  </svg>
)
