import { useMemo, useState } from 'react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input } from '../ui/Field'
import { Change } from '../Change'
import { CloseIcon } from '../Icons'
import { maxSharesFor } from '../../lib/storage/dayTrade'
import type { DayPosition, OrderInput, OrderKind } from '../../lib/storage/dayTrade'
import type { Currency, Market } from '../../lib/types'
import {
  displayCode,
  formatMoney,
  formatPercent,
  formatPrice,
  formatShares,
  formatSignedMoney,
} from '../../lib/format'
import { cn } from '../ui/cn'

export interface OrderTarget {
  ticker: string
  name: string
  market: Market
  currency: Currency
  price: number
}

/**
 * 仮想の注文パネル（買う / 売る）。
 * MVP は成行のみだが、指値・逆指値を足せるよう注文種類を持たせてある。
 */
export function OrderPanel({
  target,
  position,
  cash,
  usdJpy,
  onSubmit,
}: {
  target: OrderTarget | null
  position: DayPosition | null
  cash: number
  usdJpy: number
  onSubmit: (side: 'buy' | 'sell', input: OrderInput) => Promise<void> | void
}) {
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [shares, setShares] = useState('100')
  const [memo, setMemo] = useState('')
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const kind: OrderKind = 'market'
  const currency = target?.currency ?? 'JPY'
  const fxRate = currency === 'JPY' ? 1 : usdJpy
  const count = Math.floor(Number(shares))
  const valid = Number.isFinite(count) && count > 0

  const amountLocal = target && valid ? count * target.price : 0
  const amountBase = amountLocal * fxRate
  const buyable = target ? maxSharesFor(cash, target.price, fxRate) : 0
  const expectedProfitLocal =
    target && position && valid ? (target.price - position.avgPrice) * count : null

  const problem = useMemo(() => {
    if (!target) return '銘柄を選んでください。'
    if (!valid) return '株数は1株以上で入力してください。'
    if (side === 'buy' && amountBase > cash) return '仮想資金が不足しています。'
    if (side === 'sell' && !position) return 'この銘柄は保有していません。'
    if (side === 'sell' && position && count > position.shares) return '保有している株数を超えています。'
    return ''
  }, [target, valid, side, amountBase, cash, position, count])

  const open = () => {
    if (problem) {
      setError(problem)
      return
    }
    setError('')
    setConfirming(true)
  }

  const confirm = async () => {
    if (!target) return
    setSubmitting(true)
    try {
      await onSubmit(side, {
        ticker: target.ticker,
        name: target.name,
        market: target.market,
        currency: target.currency,
        shares: count,
        price: target.price,
        fxRate,
        kind,
        memo,
      })
      setConfirming(false)
      setMemo('')
      setError('')
    } catch (e) {
      setConfirming(false)
      setError(e instanceof Error ? e.message : '注文できませんでした。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card padding="md">
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-canvas-2 p-1">
        {(['buy', 'sell'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setSide(s)
              setError('')
            }}
            aria-pressed={side === s}
            className={cn(
              'rounded-lg py-2 text-sm font-bold transition focus-ring',
              side === s
                ? s === 'buy'
                  ? 'bg-gain text-white shadow-sm'
                  : 'bg-loss text-white shadow-sm'
                : 'text-muted hover:text-ink',
            )}
          >
            {s === 'buy' ? '買う' : '売る'}
          </button>
        ))}
      </div>

      {!target ? (
        <p className="py-6 text-center text-sm text-muted">銘柄を選ぶと注文できます。</p>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted">現在価格</p>
            <p className="num text-2xl text-ink">{formatPrice(target.price, currency)}</p>
          </div>

          <div>
            <label htmlFor="order-shares" className="mb-2 block text-sm font-medium text-ink-soft">
              株数
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="order-shares"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={shares}
                onChange={(e) => {
                  setShares(e.target.value)
                  setError('')
                }}
                className="h-11"
              />
              <span className="shrink-0 text-sm text-muted">株</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[100, 500].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setShares(String(n))}
                  className="focus-ring rounded-lg border border-line bg-white px-2.5 py-1 text-xs text-muted hover:text-ink"
                >
                  {n}株
                </button>
              ))}
              <button
                type="button"
                onClick={() =>
                  setShares(String(side === 'buy' ? buyable : (position?.shares ?? 0)))
                }
                className="focus-ring rounded-lg border border-line bg-white px-2.5 py-1 text-xs text-muted hover:text-ink"
              >
                {side === 'buy' ? `買える最大（${formatShares(buyable)}株）` : '全部売る'}
              </button>
            </div>
          </div>

          <dl className="space-y-1.5 rounded-xl bg-canvas-2 p-3 text-sm">
            {side === 'buy' ? (
              <>
                <Row label="予想購入金額" value={formatPrice(amountLocal, currency)} />
                {currency !== 'JPY' ? <Row label="円換算" value={formatMoney(amountBase, 'JPY')} /> : null}
                <Row label="注文後の現金" value={formatMoney(cash - amountBase, 'JPY')} />
              </>
            ) : (
              <>
                <Row
                  label="平均購入価格"
                  value={position ? formatPrice(position.avgPrice, currency) : '—'}
                />
                <Row label="予想売却金額" value={formatPrice(amountLocal, currency)} />
                <div className="flex items-center justify-between">
                  <dt className="text-muted">予想損益</dt>
                  <dd>
                    {expectedProfitLocal != null ? (
                      <Change
                        value={expectedProfitLocal}
                        text={formatSignedMoney(expectedProfitLocal, currency)}
                        size="sm"
                      />
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </dd>
                </div>
              </>
            )}
          </dl>

          <div>
            <label htmlFor="order-memo" className="mb-2 block text-sm font-medium text-ink-soft">
              メモ（任意）
            </label>
            <Input
              id="order-memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="出来高が増えたので買った"
              className="h-11"
            />
          </div>

          {error ? (
            <p className="rounded-xl border border-loss/20 bg-loss-soft px-3 py-2 text-sm text-loss">
              {error}
            </p>
          ) : null}

          <Button
            size="lg"
            full
            variant={side === 'buy' ? 'success' : 'primary'}
            className={side === 'sell' ? 'bg-loss hover:bg-[#dc2626]' : undefined}
            onClick={open}
          >
            {side === 'buy' ? '買い注文' : '売り注文'}
          </Button>
          <p className="text-center text-xs text-faint">成行注文のみ・実際の取引は行われません</p>
        </div>
      )}

      {confirming && target ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/25 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="注文の確認"
          onClick={(e) => e.target === e.currentTarget && setConfirming(false)}
        >
          <div className="w-full max-w-sm rounded-t-2xl border border-line bg-white p-6 shadow-xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-bold text-ink">
                {side === 'buy' ? '仮想購入の確認' : '仮想売却の確認'}
              </h3>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                aria-label="閉じる"
                className="focus-ring -mr-1 -mt-1 rounded-lg p-1 text-faint hover:bg-canvas-2 hover:text-ink"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-ink">
              <span className="font-bold">{target.name}</span>（{displayCode(target.ticker)}）を
              <br />
              <span className="num font-bold">{formatShares(count)}株</span> を{' '}
              <span className="num font-bold">{formatPrice(target.price, currency)}</span> 付近で
              {side === 'buy' ? '仮想購入' : '仮想売却'}します。
            </p>

            <dl className="mt-4 space-y-1.5 rounded-xl bg-canvas-2 p-3 text-sm">
              <Row
                label={side === 'buy' ? '概算購入金額' : '概算売却金額'}
                value={formatPrice(amountLocal, currency)}
              />
              {currency !== 'JPY' ? <Row label="円換算" value={formatMoney(amountBase, 'JPY')} /> : null}
              {side === 'sell' && expectedProfitLocal != null ? (
                <div className="flex items-center justify-between">
                  <dt className="text-muted">予想損益</dt>
                  <dd>
                    <Change
                      value={expectedProfitLocal}
                      text={formatSignedMoney(expectedProfitLocal, currency)}
                      sub={
                        position
                          ? formatPercent(
                              ((target.price - position.avgPrice) / position.avgPrice) * 100,
                            )
                          : undefined
                      }
                      align="right"
                      size="sm"
                    />
                  </dd>
                </div>
              ) : null}
            </dl>

            <p className="mt-4 text-xs leading-relaxed text-muted">
              ※ 実際の売買は行われません。表示価格には遅延が発生する場合があります。
            </p>

            <div className="mt-5 flex gap-3">
              <Button variant="secondary" full onClick={() => setConfirming(false)} disabled={submitting}>
                キャンセル
              </Button>
              <Button
                full
                variant={side === 'buy' ? 'success' : 'primary'}
                className={side === 'sell' ? 'bg-loss hover:bg-[#dc2626]' : undefined}
                onClick={confirm}
                disabled={submitting}
              >
                {submitting ? '処理中…' : '注文する'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="num text-ink">{value}</dd>
    </div>
  )
}
