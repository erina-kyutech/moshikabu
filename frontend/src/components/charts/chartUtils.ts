/** チャート共通のスタイル・軸フォーマット。 */
export const CHART_COLORS = {
  grid: '#EEF2F7',
  axis: '#94A3B8',
  line: '#2563EB',
  area: '#2563EB',
  gain: '#16A34A',
  loss: '#EF4444',
  buy: '#EF4444',
  now: '#16A34A',
}

/**
 * 複数銘柄を重ねるときの系列色。
 * 明度・色相を離して、隣り合う線を見分けやすくしている。
 */
export const SERIES_COLORS = [
  '#2563EB', // ブルー
  '#16A34A', // グリーン
  '#7C3AED', // パープル
  '#EA580C', // オレンジ
  '#0891B2', // シアン
  '#BE123C', // ローズ
  '#65A30D', // ライム
  '#4338CA', // インディゴ
  '#B45309', // アンバー
  '#0F766E', // ティール
] as const

export const seriesColor = (index: number): string =>
  SERIES_COLORS[index % SERIES_COLORS.length]

/** 期間の長さに応じて X 軸ラベルの粒度を変える。 */
export function makeDateTickFormatter(dates: string[]): (v: string) => string {
  if (dates.length === 0) return (v) => v
  const first = dates[0]
  const last = dates[dates.length - 1]
  const spanDays = (new Date(last).getTime() - new Date(first).getTime()) / 86400000

  if (spanDays > 730) return (v) => `${v.slice(0, 4)}/${v.slice(5, 7)}`
  if (spanDays > 120) return (v) => `${Number(v.slice(5, 7))}月`
  return (v) => `${Number(v.slice(5, 7))}/${Number(v.slice(8, 10))}`
}

/** 数値軸を「1.2万」「350」のように短く表示する。 */
export function makeValueTickFormatter(currency: 'JPY' | 'USD') {
  return (v: number) => {
    if (!Number.isFinite(v)) return ''
    const abs = Math.abs(v)
    if (currency === 'JPY') {
      if (abs >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}億`
      if (abs >= 10_000) return `${Math.round(v / 10_000).toLocaleString('ja-JP')}万`
      return Math.round(v).toLocaleString('ja-JP')
    }
    if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000) return `${(v / 1_000).toFixed(1)}k`
    return v.toFixed(abs < 10 ? 1 : 0)
  }
}

/** データ範囲に少し余白を持たせた Y 軸ドメイン。 */
export function paddedDomain(values: number[]): [number, number] {
  const clean = values.filter((v) => Number.isFinite(v))
  if (clean.length === 0) return [0, 1]
  const min = Math.min(...clean)
  const max = Math.max(...clean)
  const pad = (max - min) * 0.12 || Math.abs(max) * 0.05 || 1
  return [Math.max(0, min - pad), max + pad]
}
