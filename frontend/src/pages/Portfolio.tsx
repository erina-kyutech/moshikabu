import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageContainer, PageHeader } from '../components/PageHeader'
import { Card, CardTitle } from '../components/ui/Card'
import { Button, ButtonLink } from '../components/ui/Button'
import { Segmented } from '../components/ui/Segmented'
import { EmptyState, ErrorBlock, LoadingBlock } from '../components/ui/States'
import { MetricCard } from '../components/MetricCard'
import { Change } from '../components/Change'
import { StockAvatar } from '../components/StockAvatar'
import { ValueChart } from '../components/charts/ValueChart'
import { SellDialog } from '../components/SellDialog'
import { SimulationNote } from '../components/Disclaimer'
import { ChevronRightIcon, WalletIcon } from '../components/Icons'
import { usePositions } from '../hooks/usePositions'
import { useMarketData } from '../hooks/useMarketData'
import { buildPortfolioSeries, summarize, valuePosition } from '../lib/portfolio'
import type { PositionValuation } from '../lib/portfolio'
import type { Position } from '../lib/storage'
import {
  displayCode,
  formatMoney,
  formatPercent,
  formatPrice,
  formatShares,
  formatSignedMoney,
} from '../lib/format'

type Range = '1w' | '1m' | '3m' | '6m' | '1y' | 'all'

const RANGES: Array<{ value: Range; label: string; days: number | null }> = [
  { value: '1w', label: '1週間', days: 7 },
  { value: '1m', label: '1か月', days: 31 },
  { value: '3m', label: '3か月', days: 92 },
  { value: '6m', label: '6か月', days: 183 },
  { value: '1y', label: '1年', days: 365 },
  { value: 'all', label: '全期間', days: null },
]

const isoDaysAgo = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function Portfolio() {
  const { positions, loaded } = usePositions()
  const openPositions = useMemo(() => positions.filter((p) => p.status === 'open'), [positions])
  const { data, loading, error, reload } = useMarketData(openPositions, { withHistory: true })
  const [range, setRange] = useState<Range>('3m')
  const [selling, setSelling] = useState<{ position: Position; sharesNow: number } | null>(null)

  const fx = { usdJpy: data.usdJpy, series: data.usdJpySeries }

  const valuations = useMemo(
    () => openPositions.map((p) => valuePosition(p, data.quotes[p.ticker], data.actions[p.ticker], fx)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [openPositions, data],
  )
  const summary = useMemo(() => summarize(valuations), [valuations])

  const series = useMemo(() => {
    const days = RANGES.find((r) => r.value === range)?.days ?? null
    return buildPortfolioSeries(
      openPositions,
      data.histories,
      data.actions,
      fx,
      days ? isoDaysAgo(days) : undefined,
      data.quotes,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPositions, data, range])

  const hasUsStock = openPositions.some((p) => p.currency !== 'JPY')

  if (!loaded) {
    return (
      <PageContainer>
        <LoadingBlock message="読み込み中…" />
      </PageContainer>
    )
  }

  if (openPositions.length === 0) {
    return (
      <PageContainer>
        <PageHeader title="仮想ポートフォリオ" description="あなたの仮想資産の状況です。" />
        <EmptyState
          icon={<WalletIcon className="h-6 w-6" />}
          title="まだ仮想保有している銘柄がありません"
          description="今日の株価で「買ったことにする」と、ここに評価額と損益が表示されます。お金は一切使いません。"
          action={
            <ButtonLink to="/invest" variant="success" size="lg">
              仮想投資を始める
            </ButtonLink>
          }
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <PageHeader
        title="仮想ポートフォリオ"
        description="あなたの仮想資産の状況です。アプリを開くたびに最新の株価で再計算します。"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void reload()} disabled={loading}>
              {loading ? '更新中…' : '最新に更新'}
            </Button>
            <ButtonLink to="/invest" variant="success">
              ＋ 銘柄を追加
            </ButtonLink>
          </div>
        }
      />

      {error ? (
        <div className="mb-6">
          <ErrorBlock message={error} onRetry={() => void reload()} />
        </div>
      ) : null}

      {/* サマリー4カード */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="総資産額"
          size="lg"
          value={formatMoney(summary.totalValueBase, 'JPY')}
          sub={`保有 ${summary.positionCount}銘柄`}
        />
        <MetricCard
          label="本日の変化"
          tone={summary.dayChangeBase >= 0 ? 'gain' : 'loss'}
          value={
            <Change
              value={summary.dayChangeBase}
              text={formatSignedMoney(summary.dayChangeBase, 'JPY')}
              size="md"
            />
          }
          sub={formatPercent(summary.dayChangePercent)}
        />
        <MetricCard
          label="累計損益"
          tone={summary.totalProfitBase >= 0 ? 'gain' : 'loss'}
          value={
            <Change
              value={summary.totalProfitBase}
              text={formatSignedMoney(summary.totalProfitBase, 'JPY')}
              size="md"
            />
          }
          sub={`投資総額 ${formatMoney(summary.totalInvestedBase, 'JPY')}`}
        />
        <MetricCard
          label="累計リターン"
          tone={summary.totalReturnPct >= 0 ? 'gain' : 'loss'}
          value={
            <Change value={summary.totalReturnPct} text={formatPercent(summary.totalReturnPct)} size="md" />
          }
        />
      </div>

      {hasUsStock ? (
        <p className="mt-3 text-xs text-muted">
          ※ 総額は円換算で表示しています（1ドル = {formatMoney(data.usdJpy, 'JPY')}）。
        </p>
      ) : null}

      {/* 資産推移 */}
      <Card className="mt-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-ink sm:text-lg">資産推移</h2>
          <Segmented
            ariaLabel="期間を選択"
            value={range}
            onChange={setRange}
            options={RANGES.map((r) => ({ value: r.value, label: r.label }))}
          />
        </div>
        {loading && series.length === 0 ? (
          <LoadingBlock />
        ) : series.length < 2 ? (
          <p className="py-12 text-center text-sm text-muted">
            この期間に表示できるデータがまだありません。購入から日が浅い場合は、翌営業日以降に表示されます。
          </p>
        ) : (
          <ValueChart
            data={series}
            currency="JPY"
            showInvestedLine
            tone={summary.totalProfitBase >= 0 ? 'gain' : 'loss'}
          />
        )}
      </Card>

      {/* 保有銘柄 */}
      <Card className="mt-6" padding="none">
        <div className="px-5 pt-5 sm:px-6 sm:pt-6">
          <CardTitle hint={`${openPositions.length}銘柄`}>保有銘柄</CardTitle>
        </div>
        <HoldingsList valuations={valuations} onSell={(v) => setSelling({ position: v.position, sharesNow: v.sharesNow })} />
      </Card>

      <div className="mt-4">
        <SimulationNote />
      </div>

      {selling ? (
        <SellDialog
          position={selling.position}
          sharesNow={selling.sharesNow}
          onClose={() => setSelling(null)}
          onSold={() => setSelling(null)}
        />
      ) : null}
    </PageContainer>
  )
}

function HoldingsList({
  valuations,
  onSell,
}: {
  valuations: PositionValuation[]
  onSell: (v: PositionValuation) => void
}) {
  return (
    <>
      {/* PC: テーブル。線を多用せず余白で区切る */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[46rem] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="px-6 py-3 font-medium">銘柄</th>
              <th className="px-3 py-3 text-right font-medium">保有株数</th>
              <th className="px-3 py-3 text-right font-medium">購入価格</th>
              <th className="px-3 py-3 text-right font-medium">現在価格</th>
              <th className="px-3 py-3 text-right font-medium">評価額</th>
              <th className="px-3 py-3 text-right font-medium">損益</th>
              <th className="px-6 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {valuations.map((v) => {
              const p = v.position
              return (
                <tr key={p.id} className="border-t border-line-soft align-middle">
                  <td className="px-6 py-4">
                    <Link to={`/portfolio/${p.id}`} className="focus-ring flex items-center gap-3 rounded-lg">
                      <StockAvatar ticker={p.ticker} name={p.name} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-ink">{p.name}</span>
                        <span className="block text-xs text-muted">{displayCode(p.ticker)}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="num px-3 py-4 text-right text-ink">{formatShares(v.sharesNow)}</td>
                  <td className="num px-3 py-4 text-right text-ink-soft">
                    {formatPrice(p.buyPrice, p.currency)}
                  </td>
                  <td className="num px-3 py-4 text-right text-ink">
                    {v.currentPrice != null ? formatPrice(v.currentPrice, p.currency) : '—'}
                  </td>
                  <td className="num px-3 py-4 text-right text-ink">
                    {v.currentValue != null ? formatMoney(v.currentValue, p.currency) : '—'}
                  </td>
                  <td className="px-3 py-4 text-right">
                    {v.profit != null ? (
                      <Change
                        value={v.profit}
                        text={formatSignedMoney(v.profit, p.currency)}
                        sub={formatPercent(v.returnPct)}
                        align="right"
                      />
                    ) : (
                      <span className="text-xs text-muted">取得できません</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={`/portfolio/${p.id}`}
                        className="focus-ring rounded-lg px-2 py-1 text-xs font-medium text-brand hover:bg-brand-soft"
                      >
                        詳細
                      </Link>
                      <Button variant="danger" onClick={() => onSell(v)} className="h-9 px-3 text-xs">
                        売却
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* スマホ: カード一覧 */}
      <ul className="divide-y divide-line-soft md:hidden">
        {valuations.map((v) => {
          const p = v.position
          return (
            <li key={p.id} className="px-5 py-4">
              <Link to={`/portfolio/${p.id}`} className="focus-ring flex items-center gap-3 rounded-lg">
                <StockAvatar ticker={p.ticker} name={p.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{p.name}</span>
                  <span className="block text-xs text-muted">
                    {displayCode(p.ticker)} ・ {formatShares(v.sharesNow)}株
                  </span>
                </span>
                <ChevronRightIcon className="h-4 w-4 shrink-0 text-faint" />
              </Link>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <p className="text-xs text-muted">評価額</p>
                  <p className="num text-lg text-ink">
                    {v.currentValue != null ? formatMoney(v.currentValue, p.currency) : '—'}
                  </p>
                </div>
                <div className="text-right">
                  {v.profit != null ? (
                    <Change
                      value={v.profit}
                      text={formatSignedMoney(v.profit, p.currency)}
                      sub={formatPercent(v.returnPct)}
                      align="right"
                    />
                  ) : (
                    <span className="text-xs text-muted">取得できません</span>
                  )}
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <Button variant="danger" onClick={() => onSell(v)} className="h-9 px-4 text-xs">
                  売却
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}
