import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ScreenerLayout } from '../components/screener/ScreenerLayout'
import { Card, CardTitle } from '../components/ui/Card'
import { ButtonLink } from '../components/ui/Button'
import { UnderlineTabs } from '../components/ui/Segmented'
import { EmptyState } from '../components/ui/States'
import { MetricCard } from '../components/MetricCard'
import { Change } from '../components/Change'
import { StockAvatar } from '../components/StockAvatar'
import { MarketChart } from '../components/charts/MarketChart'
import type { ChartMarker } from '../components/charts/MarketChart'
import {
  CHART_COLORS,
  makeDateTickFormatter,
  makeValueTickFormatter,
  paddedDomain,
} from '../components/charts/chartUtils'
import { InfoIcon, StackIcon } from '../components/Icons'
import { api } from '../lib/api'
import type { BacktestResponse, BacktestTrade } from '../lib/screener'
import type { Candle } from '../lib/types'
import { backtestStore } from '../lib/storage/rules'
import {
  formatDateSlash,
  formatMoney,
  formatPercent,
  formatPrice,
  formatSignedMoney,
} from '../lib/format'
import { cn } from '../components/ui/cn'

type Tab = 'summary' | 'equity' | 'yearly' | 'trades'
type SortKey = 'returnPct' | 'profit' | 'buyDate' | 'name'

const BENCH_COLOR = '#7C3AED'

export default function BacktestResult() {
  const [result, setResult] = useState<BacktestResponse | null>(null)
  const [tab, setTab] = useState<Tab>('summary')

  useEffect(() => {
    setResult(backtestStore.load())
  }, [])

  if (!result) {
    return (
      <ScreenerLayout title="バックテスト結果">
        <EmptyState
          icon={<StackIcon className="h-6 w-6" />}
          title="まだ検証していません"
          description="条件を作って「バックテスト開始」を押すと、過去の検証結果がここに表示されます。"
          action={
            <ButtonLink to="/backtest" variant="primary" size="lg">
              検証の設定をする
            </ButtonLink>
          }
        />
      </ScreenerLayout>
    )
  }

  const beatsBenchmark =
    result.benchmarkReturn != null && result.returnRate > result.benchmarkReturn

  return (
    <ScreenerLayout
      title="バックテスト結果"
      description={`${result.ruleName ?? '投資ルール'} を ${result.startDate} 〜 ${result.endDate} で検証した結果です。過去の結果であり、将来の成績を保証するものではありません。`}
      action={
        <ButtonLink to="/backtest" variant="secondary">
          条件を変えて再検証
        </ButtonLink>
      }
    >
      {result.trades.length === 0 ? (
        <Card padding="lg" className="mb-6 border-amber-200 bg-amber-50">
          <p className="text-sm font-bold text-amber-800">売買が1件も成立しませんでした</p>
          <ul className="mt-2 space-y-1 text-xs leading-relaxed text-amber-800">
            {result.notes.map((n) => (
              <li key={n}>・{n}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="総投資額" value={formatMoney(result.totalInvested, 'JPY')} />
        <MetricCard label="最終評価額" size="lg" value={formatMoney(result.finalValue, 'JPY')} />
        <MetricCard
          label="利益"
          tone={result.profit >= 0 ? 'gain' : 'loss'}
          value={<Change value={result.profit} text={formatSignedMoney(result.profit, 'JPY')} size="md" />}
        />
        <MetricCard
          label="リターン"
          tone={result.returnRate >= 0 ? 'gain' : 'loss'}
          value={<Change value={result.returnRate} text={formatPercent(result.returnRate)} size="md" />}
          sub={
            result.benchmarkReturn != null
              ? `${result.benchmarkLabel} ${formatPercent(result.benchmarkReturn)}`
              : undefined
          }
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <MetricCard label="勝率" value={formatPercent(result.winRate, false)} sub={`${result.trades.length}回の売買`} />
        <MetricCard
          label="平均リターン"
          tone={result.averageReturn >= 0 ? 'gain' : 'loss'}
          value={<Change value={result.averageReturn} text={formatPercent(result.averageReturn)} size="md" />}
        />
        <MetricCard
          label="中央値リターン"
          tone={result.medianReturn >= 0 ? 'gain' : 'loss'}
          value={<Change value={result.medianReturn} text={formatPercent(result.medianReturn)} size="md" />}
        />
      </div>

      {result.benchmarkReturn != null && result.trades.length > 0 ? (
        <p className="mt-3 text-sm text-muted">
          この期間では、{result.benchmarkLabel}（{formatPercent(result.benchmarkReturn)}）
          {beatsBenchmark ? 'を上回る' : 'を下回る'}結果でした。
        </p>
      ) : null}

      <div className="mt-6">
        <UnderlineTabs
          ariaLabel="バックテスト結果のタブ"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'summary', label: 'サマリー' },
            { value: 'equity', label: '資産推移' },
            { value: 'yearly', label: '年別成績' },
            { value: 'trades', label: '銘柄別結果' },
          ]}
        />
      </div>

      {tab === 'summary' ? <Summary result={result} /> : null}
      {tab === 'equity' ? <EquityTab result={result} /> : null}
      {tab === 'yearly' ? <YearlyTab result={result} /> : null}
      {tab === 'trades' ? <TradesTab result={result} /> : null}

      <Card padding="md" className="mt-6">
        <div className="flex gap-3">
          <span className="mt-0.5 text-brand">
            <InfoIcon className="h-5 w-5" />
          </span>
          <div className="text-xs leading-relaxed text-muted">
            <p className="font-semibold text-ink">この結果の読み方</p>
            <ul className="mt-1.5 space-y-1.5">
              {result.notes.map((n) => (
                <li key={n}>・{n}</li>
              ))}
              {Object.entries(result.excludedReasons).length > 0 ? (
                <li>
                  ・検証対象外になった銘柄：
                  {Object.entries(result.excludedReasons)
                    .map(([reason, count]) => `${reason} ${count}件`)
                    .join(' / ')}
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      </Card>
    </ScreenerLayout>
  )
}

function Summary({ result }: { result: BacktestResponse }) {
  return (
    <div className="mt-6 space-y-6">
      <Card>
        <CardTitle hint={`${result.universeLabel}・${result.holdingPeriod}か月保有`}>検証の条件</CardTitle>
        <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <Row label="ルール" value={result.ruleName ?? '（名前なし）'} />
          <Row label="検証期間" value={`${result.startDate} 〜 ${result.endDate}`} />
          <Row label="抽出タイミング" value={`毎年${result.screeningMonth}月1日`} />
          <Row label="保有期間" value={result.holdingPeriod === 12 ? '1年' : `${result.holdingPeriod}か月`} />
          <Row label="対象銘柄" value={result.universeLabel} />
          <Row label="ベンチマーク" value={result.benchmarkLabel} />
          <Row label="抽出した日" value={result.screeningDates.join(' / ') || '—'} />
          <Row label="売買回数" value={`${result.trades.length}回`} />
        </dl>
      </Card>
      <EquityTab result={result} />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line-soft pb-2">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-ink">{value}</dd>
    </div>
  )
}

function EquityTab({ result }: { result: BacktestResponse }) {
  const data = result.equity
  const tickX = makeDateTickFormatter(data.map((d) => d.date))
  const tickY = makeValueTickFormatter('JPY')
  const domain = paddedDomain(data.flatMap((d) => [d.value, d.benchmark ?? d.value]))

  if (data.length < 2) {
    return (
      <Card className="mt-6">
        <p className="py-12 text-center text-sm text-muted">表示できる資産推移がありません。</p>
      </Card>
    )
  }

  return (
    <Card className="mt-6">
      <CardTitle hint="どちらも同じ初期資金からのスタート">資産推移の比較</CardTitle>
      <div style={{ width: '100%', height: 340 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 4 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={tickX}
              tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
              axisLine={{ stroke: CHART_COLORS.grid }}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              domain={domain}
              tickFormatter={tickY}
              tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={58}
            />
            <Tooltip
              cursor={{ stroke: CHART_COLORS.grid, strokeWidth: 2 }}
              content={(props) => {
                const { active, payload, label } = props as {
                  active?: boolean
                  payload?: readonly { dataKey?: unknown; value?: unknown }[]
                  label?: string
                }
                if (!active || !payload?.length) return null
                const pick = (k: string) => {
                  const hit = payload.find((e) => String(e.dataKey) === k)
                  return hit?.value == null ? null : Number(hit.value)
                }
                const mine = pick('value')
                const bench = pick('benchmark')
                return (
                  <div className="min-w-44 rounded-xl border border-line bg-white px-3 py-2 shadow-card">
                    <p className="mb-1 text-xs text-muted">{formatDateSlash(String(label ?? ''))}</p>
                    {mine != null ? (
                      <p className="flex items-center justify-between gap-4 text-sm">
                        <span className="text-ink">自分のルール</span>
                        <span className="num text-ink">{formatMoney(mine, 'JPY')}</span>
                      </p>
                    ) : null}
                    {bench != null ? (
                      <p className="flex items-center justify-between gap-4 text-sm">
                        <span className="text-ink">{result.benchmarkLabel}</span>
                        <span className="num text-ink">{formatMoney(bench, 'JPY')}</span>
                      </p>
                    ) : null}
                  </div>
                )
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              name="自分のルール"
              stroke={CHART_COLORS.line}
              strokeWidth={2.4}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="benchmark"
              name={result.benchmarkLabel}
              stroke={BENCH_COLOR}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 rounded" style={{ backgroundColor: CHART_COLORS.line }} />
          自分のルール
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-0 w-5 border-t border-dashed"
            style={{ borderColor: BENCH_COLOR }}
          />
          {result.benchmarkLabel}
        </span>
      </div>
    </Card>
  )
}

function YearlyTab({ result }: { result: BacktestResponse }) {
  const data = result.yearly.map((y) => ({
    year: String(y.year),
    mine: y.averageReturn,
    bench: y.benchmarkReturn ?? 0,
  }))

  return (
    <div className="mt-6 space-y-6">
      <Card>
        <CardTitle hint="年ごとの平均リターン">年別リターンの推移</CardTitle>
        {data.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted">表示できるデータがありません。</p>
        ) : (
          <>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 4 }}>
                  <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
                  <XAxis
                    dataKey="year"
                    tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
                    axisLine={{ stroke: CHART_COLORS.grid }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                    tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(15,23,42,0.04)' }}
                    formatter={(v, name) => [`${Number(v).toFixed(1)}%`, String(name)]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="mine" name="自分のルール" fill={CHART_COLORS.line} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="bench" name={result.benchmarkLabel} fill={BENCH_COLOR} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </Card>

      <Card padding="none">
        <div className="px-5 pt-5 sm:px-6 sm:pt-6">
          <CardTitle>年別の成績</CardTitle>
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="px-6 py-3 font-medium">年</th>
                <th className="px-3 py-3 text-right font-medium">該当銘柄数</th>
                <th className="px-3 py-3 text-right font-medium">売買</th>
                <th className="px-3 py-3 text-right font-medium">勝率</th>
                <th className="px-3 py-3 text-right font-medium">平均リターン</th>
                <th className="px-3 py-3 text-right font-medium">中央値</th>
                <th className="px-6 py-3 text-right font-medium">{result.benchmarkLabel}</th>
              </tr>
            </thead>
            <tbody>
              {result.yearly.map((y) => (
                <tr key={y.year} className="border-t border-line-soft">
                  <td className="px-6 py-3.5">
                    <span className="num font-semibold text-ink">{y.year}</span>
                    <span className="ml-2 text-xs text-muted">{formatDateSlash(y.screeningDate)}抽出</span>
                  </td>
                  <td className="num px-3 py-3.5 text-right text-ink">{y.candidates}</td>
                  <td className="num px-3 py-3.5 text-right text-ink-soft">{y.trades}</td>
                  <td className="num px-3 py-3.5 text-right text-ink">
                    {y.trades ? formatPercent(y.winRate, false) : '—'}
                  </td>
                  <td className="px-3 py-3.5 text-right">
                    {y.trades ? (
                      <Change value={y.averageReturn} text={formatPercent(y.averageReturn)} align="right" />
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3.5 text-right">
                    {y.trades ? (
                      <Change value={y.medianReturn} text={formatPercent(y.medianReturn)} align="right" />
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    {y.benchmarkReturn != null ? (
                      <Change
                        value={y.benchmarkReturn}
                        text={formatPercent(y.benchmarkReturn)}
                        align="right"
                      />
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* スマホ: 横スクロールを避けてカードで並べる */}
        <ul className="space-y-3 px-5 pb-5 md:hidden">
          {result.yearly.map((y) => (
            <li key={y.year} className="rounded-xl border border-line bg-canvas-2 p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="num text-base font-bold text-ink">{y.year}年</span>
                <span className="text-xs text-muted">{formatDateSlash(y.screeningDate)}抽出</span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                <MiniRow label="該当銘柄数" value={`${y.candidates}件`} />
                <MiniRow label="売買" value={`${y.trades}件`} />
                <MiniRow label="勝率" value={y.trades ? formatPercent(y.winRate, false) : '—'} />
                <MiniRow
                  label="中央値"
                  value={y.trades ? formatPercent(y.medianReturn) : '—'}
                  change={y.trades ? y.medianReturn : undefined}
                />
                <MiniRow
                  label="平均リターン"
                  value={y.trades ? formatPercent(y.averageReturn) : '—'}
                  change={y.trades ? y.averageReturn : undefined}
                />
                <MiniRow
                  label={result.benchmarkLabel}
                  value={y.benchmarkReturn != null ? formatPercent(y.benchmarkReturn) : '—'}
                  change={y.benchmarkReturn ?? undefined}
                  wide
                />
              </dl>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

/** カード表示用の「ラベル ＋ 数値」1行 */
function MiniRow({
  label,
  value,
  change,
  wide,
}: {
  label: string
  value: string
  change?: number
  wide?: boolean
}) {
  return (
    <div className={cn('flex items-center justify-between gap-2', wide && 'col-span-2')}>
      <dt className="min-w-0 break-words text-xs text-muted">{label}</dt>
      <dd className="num shrink-0 text-right text-sm">
        {change == null ? (
          <span className="text-ink">{value}</span>
        ) : (
          <Change value={change} text={value} align="right" />
        )}
      </dd>
    </div>
  )
}

function TradesTab({ result }: { result: BacktestResponse }) {
  const [sortBy, setSortBy] = useState<SortKey>('returnPct')
  const [desc, setDesc] = useState(true)
  const [selected, setSelected] = useState<BacktestTrade | null>(null)

  const trades = useMemo(() => {
    const sorted = [...result.trades].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name, 'ja')
      if (sortBy === 'buyDate') return a.buyDate.localeCompare(b.buyDate)
      return (a[sortBy] as number) - (b[sortBy] as number)
    })
    return desc ? sorted.reverse() : sorted
  }, [result.trades, sortBy, desc])

  if (result.trades.length === 0) {
    return (
      <Card className="mt-6">
        <p className="py-12 text-center text-sm text-muted">売買はありませんでした。</p>
      </Card>
    )
  }

  return (
    <div className="mt-6 space-y-6">
      <Card padding="none">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
          <CardTitle hint={`${result.trades.length}件`}>取引一覧</CardTitle>
          <div className="mb-5 flex items-center gap-2">
            <label htmlFor="trade-sort" className="text-xs text-muted">
              並び替え
            </label>
            <select
              id="trade-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="focus-ring h-9 rounded-lg border border-line bg-white px-2 text-sm text-ink"
            >
              <option value="returnPct">リターン</option>
              <option value="profit">利益額</option>
              <option value="buyDate">購入日</option>
              <option value="name">銘柄</option>
            </select>
            <button
              type="button"
              onClick={() => setDesc((v) => !v)}
              className="focus-ring h-9 rounded-lg border border-line bg-white px-2.5 text-sm text-muted hover:text-ink"
            >
              {desc ? '降順 ↓' : '昇順 ↑'}
            </button>
          </div>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="px-6 py-3 font-medium">銘柄</th>
                <th className="px-3 py-3 font-medium">購入日</th>
                <th className="px-3 py-3 font-medium">売却日</th>
                <th className="px-3 py-3 text-right font-medium">購入価格</th>
                <th className="px-3 py-3 text-right font-medium">売却価格</th>
                <th className="px-3 py-3 text-right font-medium">投資金額</th>
                <th className="px-3 py-3 text-right font-medium">最終評価額</th>
                <th className="px-6 py-3 text-right font-medium">リターン</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t, i) => (
                <tr
                  key={`${t.ticker}-${t.buyDate}-${i}`}
                  className={cn(
                    'cursor-pointer border-t border-line-soft transition hover:bg-canvas-2',
                    selected === t && 'bg-brand-soft',
                  )}
                  onClick={() => setSelected(selected === t ? null : t)}
                >
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <StockAvatar ticker={t.ticker} name={t.name} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-ink">{t.name}</span>
                        <span className="num block text-xs text-muted">{t.code}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-xs text-muted">{formatDateSlash(t.buyDate)}</td>
                  <td className="px-3 py-3.5 text-xs text-muted">{formatDateSlash(t.sellDate)}</td>
                  <td className="num px-3 py-3.5 text-right text-ink-soft">
                    {formatPrice(t.buyPrice, 'JPY')}
                  </td>
                  <td className="num px-3 py-3.5 text-right text-ink-soft">
                    {formatPrice(t.sellPrice, 'JPY')}
                  </td>
                  <td className="num px-3 py-3.5 text-right text-ink-soft">
                    {formatMoney(t.invested, 'JPY')}
                  </td>
                  <td className="num px-3 py-3.5 text-right text-ink">
                    {formatMoney(t.finalValue, 'JPY')}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <Change
                      value={t.returnPct}
                      text={formatPercent(t.returnPct)}
                      sub={formatSignedMoney(t.profit, 'JPY')}
                      align="right"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* スマホ: 横スクロールを避けてカードで並べる */}
        <ul className="space-y-3 px-5 md:hidden">
          {trades.map((t, i) => (
            <li key={`card-${t.ticker}-${t.buyDate}-${i}`}>
              <button
                type="button"
                onClick={() => setSelected(selected === t ? null : t)}
                className={cn(
                  'focus-ring w-full rounded-xl border p-4 text-left transition',
                  selected === t ? 'border-brand bg-brand-soft' : 'border-line bg-canvas-2',
                )}
              >
                <div className="flex items-center gap-2.5">
                  <StockAvatar ticker={t.ticker} name={t.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{t.name}</span>
                    <span className="num block text-xs text-muted">{t.code}</span>
                  </span>
                  <Change
                    value={t.returnPct}
                    text={formatPercent(t.returnPct)}
                    sub={formatSignedMoney(t.profit, 'JPY')}
                    align="right"
                  />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line-soft pt-3">
                  <MiniRow label="購入日" value={formatDateSlash(t.buyDate)} />
                  <MiniRow label="売却日" value={formatDateSlash(t.sellDate)} />
                  <MiniRow label="購入価格" value={formatPrice(t.buyPrice, 'JPY')} />
                  <MiniRow label="売却価格" value={formatPrice(t.sellPrice, 'JPY')} />
                  <MiniRow label="投資金額" value={formatMoney(t.invested, 'JPY')} />
                  <MiniRow label="最終評価額" value={formatMoney(t.finalValue, 'JPY')} />
                </dl>
              </button>
            </li>
          ))}
        </ul>
        <p className="px-5 pb-5 pt-3 text-xs text-muted sm:px-6">
          行（スマホではカード）をタップすると、その期間のチャートに購入・売却の地点を表示します。
        </p>
      </Card>

      {selected ? <TradeChart trade={selected} /> : null}
    </div>
  )
}

function TradeChart({ trade }: { trade: BacktestTrade }) {
  const [candles, setCandles] = useState<Candle[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setCandles(null)
    setError('')
    api
      .candles(trade.ticker, { range: '5y', interval: '1d', maxBars: 2000 })
      .then((res) => {
        // バックテストの期間だけに絞る
        const from = trade.buyDate
        const to = trade.sellDate
        setCandles(res.candles.filter((c) => c.t.slice(0, 10) >= from && c.t.slice(0, 10) <= to))
      })
      .catch(() => setError('チャートを取得できませんでした。'))
  }, [trade])

  const markers: ChartMarker[] = [
    {
      time: `${trade.buyDate}T00:00:00`,
      price: trade.buyPrice,
      side: 'buy',
      label: `▲BUY ${formatPrice(trade.buyPrice, 'JPY')}`,
    },
    {
      time: `${trade.sellDate}T00:00:00`,
      price: trade.sellPrice,
      side: 'sell',
      label: `▼SELL ${formatPrice(trade.sellPrice, 'JPY')}`,
    },
  ]

  return (
    <Card>
      <CardTitle
        hint={`${formatDateSlash(trade.buyDate)} → ${formatDateSlash(trade.sellDate)} ／ ${formatPercent(
          trade.returnPct,
        )}`}
      >
        {trade.name}（{trade.code}）の取引チャート
      </CardTitle>
      {error ? (
        <p className="py-10 text-center text-sm text-loss">{error}</p>
      ) : !candles ? (
        <p className="py-10 text-center text-sm text-muted">読み込み中…</p>
      ) : candles.length < 2 ? (
        <p className="py-10 text-center text-sm text-muted">この期間のチャートを取得できませんでした。</p>
      ) : (
        <MarketChart
          candles={candles}
          currency="JPY"
          type="line"
          markers={markers}
          clampMarkers
          height={280}
          showVolume={false}
        />
      )}
    </Card>
  )
}
