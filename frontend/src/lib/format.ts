/** 表示フォーマット。市場に応じて ¥ / $ を出し分ける。 */
import type { Currency } from './types'

export const currencySymbol = (c: Currency): string => (c === 'JPY' ? '¥' : '$')

/** 通貨の最小表示単位。日本株は整数、米国株は小数2桁。 */
const fractionDigits = (c: Currency) => (c === 'JPY' ? 0 : 2)

export function formatMoney(value: number | null | undefined, currency: Currency): string {
  if (value == null || Number.isNaN(value)) return '—'
  const d = fractionDigits(currency)
  const body = Math.abs(value).toLocaleString('ja-JP', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })
  return `${value < 0 ? '-' : ''}${currencySymbol(currency)}${body}`
}

/** 損益など、符号を必ず付けて表示する。 */
export function formatSignedMoney(value: number | null | undefined, currency: Currency): string {
  if (value == null || Number.isNaN(value)) return '—'
  const sign = value > 0 ? '+' : value < 0 ? '-' : '±'
  const d = fractionDigits(currency)
  return `${sign}${currencySymbol(currency)}${Math.abs(value).toLocaleString('ja-JP', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })}`
}

/** 株価。日本株でも1円未満の値動きがある銘柄があるので、小さい値は小数を残す。 */
export function formatPrice(value: number | null | undefined, currency: Currency): string {
  if (value == null || Number.isNaN(value)) return '—'
  if (currency === 'JPY') {
    const d = Math.abs(value) < 100 ? 1 : 0
    return `¥${value.toLocaleString('ja-JP', { minimumFractionDigits: d, maximumFractionDigits: d })}`
  }
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatPercent(value: number | null | undefined, signed = true): string {
  if (value == null || Number.isNaN(value)) return '—'
  const sign = signed ? (value > 0 ? '+' : value < 0 ? '-' : '±') : ''
  return `${sign}${Math.abs(value).toFixed(2)}%`
}

export function formatShares(value: number): string {
  const rounded = Math.round(value * 10000) / 10000
  return Number.isInteger(rounded) ? rounded.toLocaleString('ja-JP') : rounded.toString()
}

/** 'YYYY-MM-DD' → '2023年1月10日' */
export function formatDateJa(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${y}年${m}月${d}日`
}

/** 'YYYY-MM-DD' → '2023/01/10' */
export function formatDateSlash(iso: string): string {
  return iso.slice(0, 10).replaceAll('-', '/')
}

export function formatDateTimeJa(iso: string): string {
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return iso
  return dt.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const todayISO = (): string => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 保有期間を「1年2か月」のように表す。 */
export function formatHoldingPeriod(fromISO: string, toISO: string): string {
  const [fy, fm, fd] = fromISO.slice(0, 10).split('-').map(Number)
  const [ty, tm, td] = toISO.slice(0, 10).split('-').map(Number)
  const from = new Date(fy, fm - 1, fd)
  const to = new Date(ty, tm - 1, td)
  const days = Math.max(0, Math.round((to.getTime() - from.getTime()) / 86400000))
  if (days < 31) return `${days}日`

  // 暦月で数える（30日換算だと「4月1日→8月1日」が3か月になってしまう）
  let months = (ty - fy) * 12 + (tm - fm)
  if (td < fd) months -= 1
  if (months < 12) return `${months}か月`
  const rest = months % 12
  return `${Math.floor(months / 12)}年${rest > 0 ? `${rest}か月` : ''}`
}

export const signOf = (v: number): 'gain' | 'loss' | 'flat' => (v > 0 ? 'gain' : v < 0 ? 'loss' : 'flat')

/**
 * 画面に出す銘柄コード。Yahoo Finance 用の「.T」は内部の都合なので見せない。
 *   150A.T → 150A、5401.T → 5401、AAPL → AAPL
 */
export const displayCode = (ticker: string): string => ticker.replace(/\.T$/i, '')

/** 出来高。桁が大きいので万・億でまとめる。 */
export function formatVolume(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  if (abs >= 100_000_000) return `${(value / 100_000_000).toFixed(2)}億`
  if (abs >= 10_000) return `${(value / 10_000).toFixed(1)}万`
  return Math.round(value).toLocaleString('ja-JP')
}

/** 増減を表す指標（成長率・騰落率）だけ、プラスの符号を付けると読みやすい。 */
const SIGNED_CATEGORIES = new Set(['growth', 'technical'])

/** 指標の値を単位つきで表示する（PBR 0.82倍 / ROE 14.2% / 時価総額 320億円）。 */
export function formatMetric(
  value: number | null | undefined,
  metric: { unit: string; decimals: number; category?: string; id?: string } | undefined,
): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const decimals = metric?.decimals ?? 2
  const unit = metric?.unit ?? ''
  const body = Math.abs(value).toLocaleString('ja-JP', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  const wantsSign =
    unit === '%' &&
    (SIGNED_CATEGORIES.has(metric?.category ?? '') || (metric?.id ?? '').startsWith('return'))
  const sign = value < 0 ? '-' : wantsSign && value > 0 ? '+' : ''
  return `${sign}${body}${unit}`
}

/** 条件の説明文（PBR 1.0倍 以下）。 */
export function formatCondition(
  metric: { label: string; unit: string } | undefined,
  operator: string,
  value: number,
  operatorLabels: Record<string, string> = {},
): string {
  const op = operatorLabels[operator] ?? operator
  if (!metric) return `${operator} ${value}`
  return `${metric.label} ${value.toLocaleString('ja-JP')}${metric.unit} ${op}`
}
