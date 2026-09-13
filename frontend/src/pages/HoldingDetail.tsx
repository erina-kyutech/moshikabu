import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageContainer } from '../components/PageHeader'
import { Card, CardTitle } from '../components/ui/Card'
import { Button, ButtonLink } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Segmented, UnderlineTabs } from '../components/ui/Segmented'
import { EmptyState, ErrorBlock, LoadingBlock } from '../components/ui/States'
import { MetricCard } from '../components/MetricCard'
import { Change } from '../components/Change'
import { StockAvatar } from '../components/StockAvatar'
import { PriceChart } from '../components/charts/PriceChart'
import { ValueChart } from '../components/charts/ValueChart'
import { CHART_COLORS } from '../components/charts/chartUtils'
import { SellDialog } from '../components/SellDialog'
import { SimulationNote } from '../components/Disclaimer'
import { ArrowLeftIcon, SplitIcon, TrashIcon } from '../components/Icons'
import { api } from '../lib/api'
import { portfolioRepository } from '../lib/storage'
import type { Position } from '../lib/storage'
import { splitFactorSince, valuePosition } from '../lib/portfolio'
import type { Actions, PricePoint, Quote, SymbolInfo } from '../lib/types'
import {
  formatDateJa,
  formatDateTimeJa,
  formatHoldingPeriod,
  formatMoney,
  formatPercent,
  formatPrice,
  formatShares,
  formatSignedMoney,
  todayISO,
} from '../lib/format'

type Tab = 'overview' | 'chart' | 'holding'
type Range = '1w' | '1m' | '3m' | '6m' | '1y' | 'all'

const RANGE_DAYS: Record<Range, number | null> = {
  '1w': 7,
  '1m': 31,
  '3m': 92,
  '6m': 183,
  '1y': 365,
  all: null,
}

const isoDaysAgo = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function HoldingDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [position, setPosition] = useState<Position | null | undefined>(undefined)
  const [quote, setQuote] = useState<Quote | undefined>()
  const [info, setInfo] = useState<SymbolInfo | undefined>()
  const [actions, setActions] = useState<Actions | undefined>()
  const [history, setHistory] = useState<PricePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('overview')
  const [range, setRange] = useState<Range>('3m')
  const [selling, setSelling] = useState(false)

  useEffect(() => {
    if (!id) return
    void portfolioRepository.get(id).then(setPosition)
    return portfolioRepository.subscribe(() => {
      void portfolioRepository.get(id).then(setPosition)
    })
  }, [id])

  useEffect(() => {
    if (!position) return
    let cancelled = false
    setLoading(true)
    setError('')
    Promise.all([
      api.quote(position.ticker).catch(() => undefined),
      api.info(position.ticker).catch(() => undefined),
      api.actions(position.ticker).catch(() => undefined),
      api
        .history(position.ticker, { start: position.buyDate, maxPoints: 400 })
        .then((h) => h.points)
        .catch(() => [] as PricePoint[]),
    ]).then(([q, i, a, h]) => {
      if (cancelled) return
      setQuote(q)
      setInfo(i)
      setActions(a)
      setHistory(h)
      if (!q && h.length === 0) {
        setError('株価データを取得できませんでした。しばらくしてからもう一度お試しください。')
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [position])

  const valuation = useMemo(
    () => (position ? valuePosition(position, quote, actions, { usdJpy: 1 }) : null),
    [position, quote, actions],
  )

  const splitFactor = useMemo(
    () => (position ? splitFactorSince(actions, position.buyDate, position.sellDate) : 1),
    [position, actions],
  )

  const chartData = useMemo(() => {
    const days = RANGE_DAYS[range]
    const from = days ? isoDaysAgo(days) : ''
    return history.filter((p) => p.date >= from).map((p) => ({ date: p.date, price: p.close }))
  }, [history, range])

  const valueSeries = useMemo(() => {
    if (!position) return []
    const sharesNow = position.shares * splitFactor
    const points = history
      .filter((p) => p.date >= position.buyDate)
      .map((p) => ({ date: p.date, value: sharesNow * p.close }))

    // 購入直後で日足がまだ無い場合でも「購入時→現在」の線を引けるようにする
    if (points[0]?.date !== position.buyDate) {
      points.unshift({ date: position.buyDate, value: position.invested })
    }
    const last = valuation?.currentValue
    const lastDate = position.sellDate ?? todayISO()
    if (last != null && points[points.length - 1]?.date !== lastDate) {
      points.push({ date: lastDate, value: last })
    }
    return points
  }, [history, position, splitFactor, valuation])

  if (position === undefined) {
    return (
      <PageContainer>
        <LoadingBlock message="読み込み中…" />
      </PageContainer>
    )
  }

  if (position === null) {
    return (
      <PageContainer>
        <EmptyState
          title="この仮想保有は見つかりませんでした"
          description="削除されたか、別のブラウザで登録された可能性があります。"
          action={
            <ButtonLink to="/portfolio" variant="primary">
              ポートフォリオに戻る
            </ButtonLink>
          }
        />
      </PageContainer>
    )
  }

  const c = position.currency
  const closed = position.status === 'closed'
  const v = valuation!

  const remove = async () => {
    if (!window.confirm('この仮想取引の記録を削除しますか？この操作は取り消せません。')) return
    await portfolioRepository.remove(position.id)
    navigate('/portfolio')
  }

  return (
    <PageContainer>
      <Link
        to={closed ? '/history' : '/portfolio'}
        className="focus-ring mb-5 inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-brand hover:underline"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        {closed ? '取引履歴に戻る' : 'ポートフォリオに戻る'}
      </Link>

      {/* 銘柄ヘッダー */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <StockAvatar ticker={position.ticker} name={position.name} size="lg" />
            <div>
              <h1 className="text-xl font-bold text-ink sm:text-2xl">{position.name}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted">
                <span>{position.ticker}</span>
                <span className="text-line">|</span>
                <span>{info?.exchange ?? (position.market === 'JP' ? '東証' : '米国市場')}</span>
                {info?.sector ? (
                  <>
                    <span className="text-line">|</span>
                    <span>{info.sector}</span>
                  </>
                ) : null}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {closed ? (
              <Badge tone="neutral">売却済み</Badge>
            ) : (
              <>
                <ButtonLink
                  to={`/invest?ticker=${encodeURIComponent(position.ticker)}`}
                  variant="secondary"
                >
                  追加購入
                </ButtonLink>
                <Button variant="danger" onClick={() => setSelling(true)}>
                  売却
                </Button>
              </>
            )}
            <Button variant="ghost" onClick={remove} aria-label="この記録を削除" className="px-2">
              <TrashIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {splitFactor !== 1 ? (
          <div className="mt-5 flex gap-2.5 rounded-xl border border-brand/15 bg-brand-soft px-4 py-3 text-sm leading-relaxed text-brand">
            <SplitIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              購入後に株式分割がありました。保有株数を {formatShares(position.shares)}株 →{' '}
              <span className="font-semibold">{formatShares(v.sharesNow)}株</span> として計算しています。
            </p>
          </div>
        ) : null}
      </Card>

      <div className="mt-6">
        <UnderlineTabs
          ariaLabel="銘柄詳細のタブ"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'overview', label: '概要' },
            { value: 'chart', label: 'チャート' },
            { value: 'holding', label: '保有詳細' },
          ]}
        />
      </div>

      {error ? (
        <div className="mt-6">
          <ErrorBlock message={error} />
        </div>
      ) : null}

      {tab === 'overview' ? (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard
              label={closed ? '売却価格' : '現在価格'}
              value={v.currentPrice != null ? formatPrice(v.currentPrice, c) : '—'}
              sub={
                !closed && quote?.changePercent != null
                  ? `本日 ${formatPercent(quote.changePercent)}`
                  : undefined
              }
            />
            <MetricCard label="保有株数" value={`${formatShares(v.sharesNow)}株`} />
            <MetricCard
              label={closed ? '売却代金' : '評価額'}
              value={v.currentValue != null ? formatMoney(v.currentValue, c) : '—'}
            />
            <MetricCard
              label="損益"
              tone={(v.profit ?? 0) >= 0 ? 'gain' : 'loss'}
              value={
                v.profit != null ? (
                  <Change value={v.profit} text={formatSignedMoney(v.profit, c)} size="md" />
                ) : (
                  '—'
                )
              }
              sub={v.returnPct != null ? formatPercent(v.returnPct) : undefined}
            />
          </div>

          <Card>
            <CardTitle hint={`購入日 ${formatDateJa(position.buyDate)} 以降`}>資産額の推移</CardTitle>
            {loading && valueSeries.length === 0 ? (
              <LoadingBlock />
            ) : valueSeries.length < 2 ? (
              <p className="py-12 text-center text-sm text-muted">
                表示できるデータがまだありません。購入から日が浅い場合は、翌営業日以降に表示されます。
              </p>
            ) : (
              <ValueChart
                data={valueSeries}
                currency={c}
                baseline={position.invested}
                tone={(v.profit ?? 0) >= 0 ? 'gain' : 'loss'}
              />
            )}
          </Card>

          <SimulationNote />
        </div>
      ) : null}

      {tab === 'chart' ? (
        <Card className="mt-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold text-ink sm:text-lg">株価の推移</h2>
            <Segmented
              ariaLabel="期間を選択"
              value={range}
              onChange={setRange}
              options={[
                { value: '1w', label: '1週間' },
                { value: '1m', label: '1か月' },
                { value: '3m', label: '3か月' },
                { value: '6m', label: '6か月' },
                { value: '1y', label: '1年' },
                { value: 'all', label: '全期間' },
              ]}
            />
          </div>
          {loading && chartData.length === 0 ? (
            <LoadingBlock />
          ) : chartData.length < 2 ? (
            <p className="py-12 text-center text-sm text-muted">
              この期間に表示できるデータがありません。期間を広げてお試しください。
            </p>
          ) : (
            <PriceChart
              data={chartData}
              currency={c}
              markers={[
                ...(chartData[0] && chartData[0].date <= position.buyDate
                  ? [
                      {
                        date: position.buyDate,
                        price: position.buyPrice / splitFactor,
                        label: `購入 ${formatPrice(position.buyPrice, c)}`,
                        color: CHART_COLORS.buy,
                      },
                    ]
                  : []),
                ...(v.currentPrice != null
                  ? [
                      {
                        date: chartData[chartData.length - 1].date,
                        price: chartData[chartData.length - 1].price,
                        label: `現在 ${formatPrice(chartData[chartData.length - 1].price, c)}`,
                        color: CHART_COLORS.now,
                      },
                    ]
                  : []),
              ]}
            />
          )}
        </Card>
      ) : null}

      {tab === 'holding' ? (
        <div className="mt-6 space-y-6">
          <Card>
            <CardTitle>保有情報</CardTitle>
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <Row label="購入日" value={`${formatDateTimeJa(position.buyAt)}`} />
              <Row label="購入株数" value={`${formatShares(position.shares)}株`} />
              <Row label="購入価格" value={formatPrice(position.buyPrice, c)} />
              <Row label="投資金額" value={formatMoney(position.invested, c)} />
              <Row
                label={closed ? '売却価格' : '現在価格'}
                value={v.currentPrice != null ? formatPrice(v.currentPrice, c) : '—'}
              />
              <Row
                label={closed ? '売却代金' : '現在評価額'}
                value={v.currentValue != null ? formatMoney(v.currentValue, c) : '—'}
              />
              <Row label="現在の保有株数" value={`${formatShares(v.sharesNow)}株`} />
              <Row
                label="保有期間"
                value={formatHoldingPeriod(position.buyDate, position.sellDate ?? todayISO())}
              />
              {closed && position.sellAt ? (
                <Row label="売却日" value={formatDateTimeJa(position.sellAt)} />
              ) : null}
            </dl>

            <div className="mt-6 grid gap-4 border-t border-line-soft pt-6 sm:grid-cols-2">
              <MetricCard
                label="損益"
                tone={(v.profit ?? 0) >= 0 ? 'gain' : 'loss'}
                value={
                  v.profit != null ? (
                    <Change value={v.profit} text={formatSignedMoney(v.profit, c)} size="md" />
                  ) : (
                    '—'
                  )
                }
              />
              <MetricCard
                label="損益率"
                tone={(v.returnPct ?? 0) >= 0 ? 'gain' : 'loss'}
                value={
                  v.returnPct != null ? (
                    <Change value={v.returnPct} text={formatPercent(v.returnPct)} size="md" />
                  ) : (
                    '—'
                  )
                }
              />
            </div>
          </Card>
          <SimulationNote />
        </div>
      ) : null}

      {selling ? (
        <SellDialog
          position={position}
          sharesNow={v.sharesNow}
          onClose={() => setSelling(false)}
          onSold={() => setSelling(false)}
        />
      ) : null}
    </PageContainer>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line-soft pb-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="num text-sm text-ink">{value}</dd>
    </div>
  )
}
