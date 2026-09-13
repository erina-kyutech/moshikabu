import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageContainer, PageHeader } from '../components/PageHeader'
import { Card } from '../components/ui/Card'
import { ButtonLink } from '../components/ui/Button'
import { Segmented } from '../components/ui/Segmented'
import { EmptyState, LoadingBlock } from '../components/ui/States'
import { Change } from '../components/Change'
import { StockAvatar } from '../components/StockAvatar'
import { ListIcon } from '../components/Icons'
import { usePositions } from '../hooks/usePositions'
import type { Position } from '../lib/storage'
import {
  formatDateTimeJa,
  formatHoldingPeriod,
  formatMoney,
  formatPercent,
  formatPrice,
  formatShares,
  formatSignedMoney,
} from '../lib/format'

type Filter = 'all' | 'open' | 'closed'
type Kind = 'buy' | 'sell'

interface TradeRow {
  key: string
  kind: Kind
  at: string
  position: Position
  price: number
  shares: number
  profit: number | null
  returnPct: number | null
  holdingPeriod?: string
}

/** ポジションを「購入」「売却」の2つの取引イベントに展開する。 */
function toTradeRows(positions: Position[]): TradeRow[] {
  const rows: TradeRow[] = []
  for (const p of positions) {
    rows.push({
      key: `${p.id}-buy`,
      kind: 'buy',
      at: p.buyAt,
      position: p,
      price: p.buyPrice,
      shares: p.shares,
      profit: null,
      returnPct: null,
    })
    if (p.status === 'closed' && p.sellPrice != null && p.sellAt) {
      const proceeds = p.proceeds ?? p.sellPrice * p.shares
      const profit = proceeds - p.invested
      rows.push({
        key: `${p.id}-sell`,
        kind: 'sell',
        at: p.sellAt,
        position: p,
        price: p.sellPrice,
        shares: p.shares,
        profit,
        returnPct: p.invested ? (profit / p.invested) * 100 : 0,
        holdingPeriod: formatHoldingPeriod(p.buyDate, p.sellDate ?? p.buyDate),
      })
    }
  }
  return rows.sort((a, b) => (a.at < b.at ? 1 : -1))
}

export default function TradeHistory() {
  const { positions, loaded } = usePositions()
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = useMemo(() => {
    const target =
      filter === 'all' ? positions : positions.filter((p) => p.status === (filter === 'open' ? 'open' : 'closed'))
    return toTradeRows(target)
  }, [positions, filter])

  const closed = positions.filter((p) => p.status === 'closed')
  const realized = closed.reduce((sum, p) => {
    const proceeds = p.proceeds ?? 0
    // 通貨が混ざる場合の合計は円換算せず件数のみ扱うため、ここでは同一通貨の集計に留める
    return p.currency === 'JPY' ? sum + (proceeds - p.invested) : sum
  }, 0)
  const hasUsClosed = closed.some((p) => p.currency !== 'JPY')

  if (!loaded) {
    return (
      <PageContainer>
        <LoadingBlock message="読み込み中…" />
      </PageContainer>
    )
  }

  if (positions.length === 0) {
    return (
      <PageContainer>
        <PageHeader title="取引履歴" description="これまでの仮想売買の記録です。" />
        <EmptyState
          icon={<ListIcon className="h-6 w-6" />}
          title="まだ取引の記録がありません"
          description="仮想購入すると、ここに購入・売却の履歴が残ります。"
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
      <PageHeader title="取引履歴" description="これまでの仮想売買の記録です。" />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          ariaLabel="表示する取引を絞り込む"
          size="md"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'すべて' },
            { value: 'open', label: '保有中' },
            { value: 'closed', label: '売却済み' },
          ]}
        />
        {closed.length > 0 ? (
          <p className="text-sm text-muted">
            確定損益（日本株）
            <span className="ml-2 inline-flex align-middle">
              <Change value={realized} text={formatSignedMoney(realized, 'JPY')} size="sm" />
            </span>
            {hasUsClosed ? <span className="ml-2 text-xs text-faint">※米国株は各行に表示</span> : null}
          </p>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="該当する取引がありません"
          description="フィルターを「すべて」に切り替えると、すべての記録を確認できます。"
        />
      ) : (
        <Card padding="none">
          {/* PC: テーブル */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[48rem] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="px-6 py-3 font-medium">日付</th>
                  <th className="px-3 py-3 font-medium">銘柄</th>
                  <th className="px-3 py-3 font-medium">取引</th>
                  <th className="px-3 py-3 text-right font-medium">株数</th>
                  <th className="px-3 py-3 text-right font-medium">価格</th>
                  <th className="px-6 py-3 text-right font-medium">損益</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.key} className="border-t border-line-soft">
                    <td className="px-6 py-4 text-xs leading-relaxed text-muted">
                      {formatDateTimeJa(row.at)}
                    </td>
                    <td className="px-3 py-4">
                      <Link
                        to={`/portfolio/${row.position.id}`}
                        className="focus-ring flex items-center gap-3 rounded-lg"
                      >
                        <StockAvatar ticker={row.position.ticker} name={row.position.name} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-ink">{row.position.name}</span>
                          <span className="block text-xs text-muted">{row.position.ticker}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-4">
                      <TradeLabel kind={row.kind} />
                    </td>
                    <td className="num px-3 py-4 text-right text-ink">{formatShares(row.shares)}</td>
                    <td className="num px-3 py-4 text-right text-ink">
                      {formatPrice(row.price, row.position.currency)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {row.profit != null ? (
                        <Change
                          value={row.profit}
                          text={formatSignedMoney(row.profit, row.position.currency)}
                          sub={formatPercent(row.returnPct)}
                          align="right"
                        />
                      ) : (
                        <span className="text-muted">−</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* スマホ: カード */}
          <ul className="divide-y divide-line-soft md:hidden">
            {filtered.map((row) => (
              <li key={row.key} className="px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <Link
                    to={`/portfolio/${row.position.id}`}
                    className="focus-ring flex min-w-0 items-center gap-3 rounded-lg"
                  >
                    <StockAvatar ticker={row.position.ticker} name={row.position.name} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink">{row.position.name}</span>
                      <span className="block text-xs text-muted">{formatDateTimeJa(row.at)}</span>
                    </span>
                  </Link>
                  <TradeLabel kind={row.kind} />
                </div>
                <div className="mt-3 flex items-end justify-between text-sm">
                  <p className="num text-ink">
                    {formatShares(row.shares)}株 × {formatPrice(row.price, row.position.currency)}
                  </p>
                  {row.profit != null ? (
                    <Change
                      value={row.profit}
                      text={formatSignedMoney(row.profit, row.position.currency)}
                      sub={formatPercent(row.returnPct)}
                      align="right"
                    />
                  ) : (
                    <span className="text-xs text-muted">
                      投資額 {formatMoney(row.position.invested, row.position.currency)}
                    </span>
                  )}
                </div>
                {row.holdingPeriod ? (
                  <p className="mt-1 text-xs text-faint">保有期間 {row.holdingPeriod}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="mt-4 text-xs leading-relaxed text-muted">
        ※ すべて仮想の取引記録です。実際の売買・入出金は一切行われていません。
      </p>
    </PageContainer>
  )
}

function TradeLabel({ kind }: { kind: Kind }) {
  return kind === 'buy' ? (
    <span className="inline-flex items-center gap-1 rounded-md border border-gain/20 bg-gain-soft px-2 py-0.5 text-xs font-semibold text-gain">
      ＋ 購入
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-md border border-line bg-canvas-2 px-2 py-0.5 text-xs font-semibold text-ink-soft">
      − 売却
    </span>
  )
}
