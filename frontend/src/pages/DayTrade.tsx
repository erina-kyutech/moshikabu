import { useCallback, useMemo, useState } from 'react'
import { PageContainer, PageHeader } from '../components/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { LoadingBlock } from '../components/ui/States'
import { SymbolCombobox } from '../components/SymbolCombobox'
import { QuoteStats } from '../components/QuoteStats'
import { ChartPanel } from '../components/ChartPanel'
import { MetricCard } from '../components/MetricCard'
import { Change } from '../components/Change'
import { CHART_COLORS } from '../components/charts/chartUtils'
import type { ChartMarker, PriceLine } from '../components/charts/MarketChart'
import { CashSetup } from '../components/daytrade/CashSetup'
import { OrderPanel } from '../components/daytrade/OrderPanel'
import { Watchlist } from '../components/daytrade/Watchlist'
import { DayStats, OrderLog, PositionsPanel } from '../components/daytrade/Panels'
import { InfoIcon } from '../components/Icons'
import { useDayTrade } from '../hooks/useDayTrade'
import { useQuotes } from '../hooks/useQuotes'
import { useUsdJpy } from '../hooks/useUsdJpy'
import { summarize, valuePositions } from '../lib/storage/dayTrade'
import type { OrderInput } from '../lib/storage/dayTrade'
import type { SymbolSearchResult } from '../lib/types'
import { displayCode, formatMoney, formatPrice, formatSignedMoney } from '../lib/format'

/** デイトレ練習に向く期間だけを出す（長期の足はチャート側で選べる） */
const DAYTRADE_RANGES = ['1d', '5d', '1mo'] as const

export default function DayTrade() {
  const { session, loaded, start, buy, sell, memo, watchlist, reset } = useDayTrade()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [showMarkers, setShowMarkers] = useState(true)
  const { usdJpy } = useUsdJpy()

  // ウォッチリスト＋保有＋表示中の銘柄をまとめて定期取得する
  const tickers = useMemo(() => {
    const list = new Set<string>(session?.watchlist ?? [])
    session?.positions.forEach((p) => list.add(p.ticker))
    if (selected) list.add(selected)
    return [...list]
  }, [session, selected])

  const { quotes } = useQuotes(tickers, { live: true, refreshSeconds: 60 })

  const current = selected ? (quotes[selected] ?? null) : null
  const values = useMemo(
    () => (session ? valuePositions(session, (t) => quotes[t]?.price, usdJpy) : []),
    [session, quotes, usdJpy],
  )
  const summary = useMemo(
    () => (session ? summarize(session, values) : null),
    [session, values],
  )
  const position = useMemo(
    () => session?.positions.find((p) => p.ticker === selected) ?? null,
    [session, selected],
  )

  // チャートに出す売買地点と価格ライン
  const markers: ChartMarker[] = useMemo(() => {
    if (!session || !selected || !showMarkers) return []
    return session.orders
      .filter((o) => o.ticker === selected)
      .map((o) => ({
        time: o.at,
        price: o.price,
        side: o.side,
        label: `${o.side === 'buy' ? '▲ BUY' : '▼ SELL'} ${formatPrice(o.price, o.currency)}`,
      }))
  }, [session, selected, showMarkers])

  const priceLines: PriceLine[] = useMemo(() => {
    const lines: PriceLine[] = []
    if (current) lines.push({ price: current.price, label: '現在', color: CHART_COLORS.axis })
    if (position) lines.push({ price: position.avgPrice, label: '平均取得', color: CHART_COLORS.line })
    return lines
  }, [current, position])

  const onPick = useCallback(
    (picked: SymbolSearchResult | null) => {
      if (!picked) return
      setSelected(picked.ticker)
      if (session && !session.watchlist.includes(picked.ticker)) {
        void watchlist([...session.watchlist, picked.ticker])
      }
    },
    [session, watchlist],
  )

  const submitOrder = async (side: 'buy' | 'sell', input: OrderInput) => {
    if (side === 'buy') await buy(input)
    else await sell(input)
  }

  if (!loaded) {
    return (
      <PageContainer>
        <LoadingBlock message="読み込み中…" />
      </PageContainer>
    )
  }

  if (!session) {
    return (
      <PageContainer narrow>
        <PageHeader
          title="デイトレ練習"
          description="実際の値動きを見ながら、お金を使わず売買の練習ができます。実際の証券口座とは接続していません。"
        />
        <CashSetup onStart={(cash) => void start(cash)} />
        <Disclaimer />
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <PageHeader
        title="デイトレ練習"
        description="実際の値動きを見ながら、お金を使わず売買の練習ができます。"
        action={
          <Button
            variant="secondary"
            onClick={() => {
              if (window.confirm('練習をリセットします。仮想資金・ポジション・履歴は消えます。よろしいですか？')) {
                void reset()
              }
            }}
          >
            リセット
          </Button>
        }
      />

      {/* 仮想資産のサマリー */}
      {summary ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="総資産"
            size="lg"
            value={formatMoney(summary.totalAssets, 'JPY')}
            sub={`開始時 ${formatMoney(session.initialCash, 'JPY')}`}
          />
          <MetricCard label="現金" value={formatMoney(summary.cash, 'JPY')} />
          <MetricCard label="株式評価額" value={formatMoney(summary.stockValueBase, 'JPY')} />
          <MetricCard
            label="本日の損益"
            tone={summary.dayProfit >= 0 ? 'gain' : 'loss'}
            value={
              <Change
                value={summary.dayProfit}
                text={formatSignedMoney(summary.dayProfit, 'JPY')}
                size="md"
              />
            }
            sub={`実現 ${formatSignedMoney(summary.realizedBase, 'JPY')} / 含み ${formatSignedMoney(
              summary.unrealizedBase,
              'JPY',
            )}`}
          />
        </div>
      ) : null}

      {/* 銘柄検索とウォッチリスト */}
      <Card className="mt-6" padding="md">
        <div className="max-w-md">
          <label htmlFor="daytrade-search" className="mb-2 block text-sm font-medium text-ink-soft">
            銘柄を選ぶ
          </label>
          <SymbolCombobox
            id="daytrade-search"
            value={query}
            onChange={setQuery}
            onPick={onPick}
            placeholder="150A / JSH / 5401 / 日本製鉄 / AAPL"
            compact
          />
        </div>
        <div className="mt-4">
          <p className="mb-2 text-xs text-muted">ウォッチリスト</p>
          <Watchlist
            tickers={session.watchlist}
            quotes={quotes}
            selected={selected}
            onSelect={setSelected}
            onRemove={(t) => void watchlist(session.watchlist.filter((x) => x !== t))}
          />
        </div>
      </Card>

      {/* 中央：チャート / 右：注文パネル（スマホでは縦に並ぶ） */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card padding="md">
            {current ? (
              <>
                <QuoteStats quote={current} size="lg" />
                <div className="mt-4 flex items-center justify-end">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={showMarkers}
                      onChange={(e) => setShowMarkers(e.target.checked)}
                      className="h-3.5 w-3.5 accent-[#2563eb] focus-ring"
                    />
                    自分の売買地点を表示
                  </label>
                </div>
                <div className="mt-2">
                  <ChartPanel
                    ticker={current.ticker}
                    currency={current.currency}
                    defaultRange="1d"
                    defaultInterval="5m"
                    defaultType="candle"
                    ranges={[...DAYTRADE_RANGES]}
                    markers={markers}
                    priceLines={priceLines}
                    height={380}
                  />
                </div>
              </>
            ) : (
              <p className="py-20 text-center text-sm text-muted">
                上の検索欄かウォッチリストから銘柄を選ぶと、チャートが表示されます。
              </p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <OrderPanel
            target={
              current
                ? {
                    ticker: current.ticker,
                    name: current.name ?? displayCode(current.ticker),
                    market: current.market,
                    currency: current.currency,
                    price: current.price,
                  }
                : null
            }
            position={position}
            cash={session.cash}
            usdJpy={usdJpy}
            onSubmit={submitOrder}
          />

          {session.positions.some((p) => p.currency !== 'JPY') ? (
            <p className="text-xs leading-relaxed text-muted">
              ※ 米国株は注文時の為替レート（1ドル = {formatMoney(usdJpy, 'JPY')}）で円に換算しています。
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-6 space-y-6">
        <PositionsPanel values={values} onSelect={setSelected} onSell={setSelected} />
        {summary ? <DayStats summary={summary} trades={session.trades} onSelect={setSelected} /> : null}
        <OrderLog orders={session.orders} onMemo={(id, text) => void memo(id, text)} />
      </div>

      <Disclaimer />
    </PageContainer>
  )
}

function Disclaimer() {
  return (
    <Card className="mt-6" padding="md">
      <div className="flex gap-3">
        <span className="mt-0.5 text-brand">
          <InfoIcon className="h-5 w-5" />
        </span>
        <div className="text-sm leading-relaxed text-muted">
          <p className="font-semibold text-ink">練習用のペーパートレードです</p>
          <p className="mt-1">
            表示価格には遅延が発生する場合があります。実際の注文には使用しないでください。
            証券会社の板情報とは一致せず、約定の再現でもありません。売買の練習としてお使いください。
          </p>
        </div>
      </div>
    </Card>
  )
}