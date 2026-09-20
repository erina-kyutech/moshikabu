import { useState } from 'react'
import { Card, CardTitle } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input } from '../ui/Field'
import { Change } from '../Change'
import { StockAvatar } from '../StockAvatar'
import { MetricCard } from '../MetricCard'
import type {
  DayOrder,
  DayRoundTrip,
  DayTradeSummary,
  PositionValue,
} from '../../lib/storage/dayTrade'
import {
  displayCode,
  formatMoney,
  formatPercent,
  formatPrice,
  formatShares,
  formatSignedMoney,
} from '../../lib/format'
import { cn } from '../ui/cn'

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })

const dateTimeOf = (iso: string) =>
  new Date(iso).toLocaleString('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

const holdingOf = (ms: number) => {
  const minutes = Math.round(ms / 60000)
  if (minutes < 60) return `${minutes}分`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}時間${minutes % 60 > 0 ? `${minutes % 60}分` : ''}`
  return `${Math.floor(hours / 24)}日`
}

/** 保有ポジション。 */
export function PositionsPanel({
  values,
  onSelect,
  onSell,
}: {
  values: PositionValue[]
  onSelect: (ticker: string) => void
  onSell: (ticker: string) => void
}) {
  return (
    <Card padding="none">
      <div className="px-5 pt-5 sm:px-6 sm:pt-6">
        <CardTitle hint={`${values.length}銘柄`}>保有ポジション</CardTitle>
      </div>

      {values.length === 0 ? (
        <p className="px-5 pb-6 text-sm text-muted sm:px-6">
          まだポジションはありません。右の「買う」から仮想購入できます。
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[44rem] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="px-6 py-3 font-medium">銘柄</th>
                  <th className="px-3 py-3 text-right font-medium">保有株数</th>
                  <th className="px-3 py-3 text-right font-medium">平均購入価格</th>
                  <th className="px-3 py-3 text-right font-medium">現在価格</th>
                  <th className="px-3 py-3 text-right font-medium">評価額</th>
                  <th className="px-3 py-3 text-right font-medium">含み損益</th>
                  <th className="px-6 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {values.map((v) => (
                  <tr key={v.position.ticker} className="border-t border-line-soft">
                    <td className="px-6 py-3.5">
                      <button
                        type="button"
                        onClick={() => onSelect(v.position.ticker)}
                        className="focus-ring flex items-center gap-2.5 rounded-lg text-left"
                      >
                        <StockAvatar ticker={v.position.ticker} name={v.position.name} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-ink">{v.position.name}</span>
                          <span className="num block text-xs text-muted">
                            {displayCode(v.position.ticker)}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="num px-3 py-3.5 text-right text-ink">
                      {formatShares(v.position.shares)}
                    </td>
                    <td className="num px-3 py-3.5 text-right text-ink-soft">
                      {formatPrice(v.position.avgPrice, v.position.currency)}
                    </td>
                    <td className="num px-3 py-3.5 text-right text-ink">
                      {v.price != null ? formatPrice(v.price, v.position.currency) : '—'}
                    </td>
                    <td className="num px-3 py-3.5 text-right text-ink">
                      {v.value != null ? formatPrice(v.value, v.position.currency) : '—'}
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      {v.profitLocal != null ? (
                        <Change
                          value={v.profitLocal}
                          text={formatSignedMoney(v.profitLocal, v.position.currency)}
                          sub={formatPercent(v.returnPct)}
                          align="right"
                        />
                      ) : (
                        <span className="text-xs text-muted">取得できません</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <Button
                        variant="danger"
                        onClick={() => onSell(v.position.ticker)}
                        className="h-9 px-3 text-xs"
                      >
                        売る
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-line-soft md:hidden">
            {values.map((v) => (
              <li key={v.position.ticker} className="px-5 py-4">
                <button
                  type="button"
                  onClick={() => onSelect(v.position.ticker)}
                  className="focus-ring flex w-full items-center gap-3 rounded-lg text-left"
                >
                  <StockAvatar ticker={v.position.ticker} name={v.position.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{v.position.name}</span>
                    <span className="num block text-xs text-muted">
                      {formatShares(v.position.shares)}株 ・ 平均{' '}
                      {formatPrice(v.position.avgPrice, v.position.currency)}
                    </span>
                  </span>
                </button>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className="text-xs text-muted">評価額</p>
                    <p className="num text-lg text-ink">
                      {v.value != null ? formatPrice(v.value, v.position.currency) : '—'}
                    </p>
                  </div>
                  {v.profitLocal != null ? (
                    <Change
                      value={v.profitLocal}
                      text={formatSignedMoney(v.profitLocal, v.position.currency)}
                      sub={formatPercent(v.returnPct)}
                      align="right"
                    />
                  ) : null}
                </div>
                <div className="mt-3 flex justify-end">
                  <Button
                    variant="danger"
                    onClick={() => onSell(v.position.ticker)}
                    className="h-9 px-4 text-xs"
                  >
                    売る
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}

/** 売買履歴。1件ずつメモを書き換えられる。 */
export function OrderLog({
  orders,
  onMemo,
}: {
  orders: DayOrder[]
  onMemo: (orderId: string, memo: string) => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  return (
    <Card padding="none">
      <div className="px-5 pt-5 sm:px-6 sm:pt-6">
        <CardTitle hint={`${orders.length}件`}>売買履歴</CardTitle>
      </div>

      {orders.length === 0 ? (
        <p className="px-5 pb-6 text-sm text-muted sm:px-6">まだ取引がありません。</p>
      ) : (
        <ul className="divide-y divide-line-soft">
          {orders.map((o) => (
            <li key={o.id} className="px-5 py-3.5 sm:px-6">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="num text-xs text-muted">{timeOf(o.at)}</span>
                <span
                  className={cn(
                    'rounded-md border px-1.5 py-0.5 text-xs font-bold',
                    o.side === 'buy'
                      ? 'border-gain/20 bg-gain-soft text-gain'
                      : 'border-loss/20 bg-loss-soft text-loss',
                  )}
                >
                  {o.side === 'buy' ? '買' : '売'}
                </span>
                <span className="min-w-0 truncate text-sm font-semibold text-ink">{o.name}</span>
                <span className="num text-xs text-muted">{displayCode(o.ticker)}</span>
                <span className="num ml-auto text-sm text-ink">
                  {formatShares(o.shares)}株 × {formatPrice(o.price, o.currency)}
                </span>
                {o.realizedBase != null ? (
                  <Change
                    value={o.realizedBase}
                    text={formatSignedMoney(o.realizedBase, 'JPY')}
                    size="sm"
                  />
                ) : null}
              </div>

              {editing === o.id ? (
                <div className="mt-2 flex gap-2">
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="高値更新で買った"
                    className="h-10"
                    autoFocus
                  />
                  <Button
                    className="h-10 shrink-0 px-3 text-xs"
                    onClick={() => {
                      onMemo(o.id, draft)
                      setEditing(null)
                    }}
                  >
                    保存
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-10 shrink-0 px-3 text-xs"
                    onClick={() => setEditing(null)}
                  >
                    やめる
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(o.id)
                    setDraft(o.memo ?? '')
                  }}
                  className="focus-ring mt-1.5 rounded-md text-left text-xs text-muted hover:text-ink"
                >
                  {o.memo ? `メモ: ${o.memo}` : '＋ メモを書く'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/** 本日の成績と、買って売るまでの振り返り。 */
export function DayStats({
  summary,
  trades,
  onSelect,
}: {
  summary: DayTradeSummary
  trades: DayRoundTrip[]
  onSelect: (ticker: string) => void
}) {
  return (
    <Card>
      <CardTitle hint="買って売るまでを1回と数えます">本日の成績</CardTitle>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="取引回数" value={`${summary.tradeCount}回`} />
        <MetricCard label="勝ち / 負け" value={`${summary.wins} / ${summary.losses}`} />
        <MetricCard
          label="勝率"
          value={summary.tradeCount ? formatPercent(summary.winRate, false) : '—'}
        />
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
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
        <span>
          利益合計 <span className="num text-gain">{formatMoney(summary.grossProfit, 'JPY')}</span>
        </span>
        <span>
          損失合計 <span className="num text-loss">{formatMoney(summary.grossLoss, 'JPY')}</span>
        </span>
      </div>

      <h3 className="mt-6 text-sm font-bold text-ink">トレードの振り返り</h3>
      {trades.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          売却するとここに記録されます。チャートには買った地点・売った地点が表示されます。
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-2 pr-3 font-medium">銘柄</th>
                <th className="px-3 py-2 text-right font-medium">株数</th>
                <th className="px-3 py-2 font-medium">購入</th>
                <th className="px-3 py-2 font-medium">売却</th>
                <th className="px-3 py-2 text-right font-medium">保有時間</th>
                <th className="py-2 pl-3 text-right font-medium">損益</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.id} className="border-t border-line-soft">
                  <td className="py-3 pr-3">
                    <button
                      type="button"
                      onClick={() => onSelect(t.ticker)}
                      className="focus-ring rounded-md text-left"
                    >
                      <span className="block truncate font-semibold text-ink">{t.name}</span>
                      <span className="num block text-xs text-muted">{displayCode(t.ticker)}</span>
                    </button>
                  </td>
                  <td className="num px-3 py-3 text-right text-ink">{formatShares(t.shares)}</td>
                  <td className="px-3 py-3 text-xs">
                    <span className="num block text-ink">{formatPrice(t.buyPrice, t.currency)}</span>
                    <span className="block text-muted">{dateTimeOf(t.buyAt)}</span>
                  </td>
                  <td className="px-3 py-3 text-xs">
                    <span className="num block text-ink">{formatPrice(t.sellPrice, t.currency)}</span>
                    <span className="block text-muted">{dateTimeOf(t.sellAt)}</span>
                  </td>
                  <td className="num px-3 py-3 text-right text-ink-soft">{holdingOf(t.holdingMs)}</td>
                  <td className="py-3 pl-3 text-right">
                    <Change
                      value={t.profitBase}
                      text={formatSignedMoney(t.profitBase, 'JPY')}
                      sub={formatPercent(t.returnPct)}
                      align="right"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
