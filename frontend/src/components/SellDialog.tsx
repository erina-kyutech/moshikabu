import { useEffect, useState } from 'react'
import { Button } from './ui/Button'
import { StockAvatar } from './StockAvatar'
import { Change } from './Change'
import { Spinner } from './ui/States'
import { CloseIcon } from './Icons'
import { api, ApiError } from '../lib/api'
import { portfolioRepository } from '../lib/storage'
import type { Position } from '../lib/storage'
import {
  formatHoldingPeriod,
  formatMoney,
  formatPercent,
  formatPrice,
  formatShares,
  formatSignedMoney,
  todayISO,
} from '../lib/format'

/**
 * 仮想売却の確認ダイアログ。
 * 実際の取引は行わず、その時点の株価を記録するだけ。
 */
export function SellDialog({
  position,
  sharesNow,
  onClose,
  onSold,
}: {
  position: Position
  sharesNow: number
  onClose: () => void
  onSold: () => void
}) {
  const [price, setPrice] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    api
      .quote(position.ticker)
      .then((q) => {
        if (cancelled) return
        setPrice(q.price)
        setLoading(false)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof ApiError ? e.message : '株価データを取得できませんでした。')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [position.ticker])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const c = position.currency
  const proceeds = price != null ? sharesNow * price : null
  const profit = proceeds != null ? proceeds - position.invested : null
  const returnPct = profit != null && position.invested ? (profit / position.invested) * 100 : null

  const confirm = async () => {
    if (price == null) return
    setSubmitting(true)
    try {
      // 売却時点の価格を確定させるため直前に取り直す
      const fresh = await api.quote(position.ticker).catch(() => null)
      await portfolioRepository.sell(position.id, { price: fresh?.price ?? price })
      onSold()
    } catch (e) {
      setError(e instanceof Error ? e.message : '売却を記録できませんでした。')
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/25 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="仮想売却の確認"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-t-2xl border border-line bg-white p-6 shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">仮想売却の確認</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="focus-ring -mr-1 -mt-1 rounded-lg p-1 text-faint hover:bg-canvas-2 hover:text-ink"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 flex items-center gap-3 rounded-xl border border-line bg-canvas-2 p-3.5">
          <StockAvatar ticker={position.ticker} name={position.name} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink">{position.name}</p>
            <p className="text-xs text-muted">
              {position.ticker}
              <span className="mx-1.5 text-line">|</span>
              {formatShares(sharesNow)}株
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted">
            <Spinner /> 株価データを取得中…
          </div>
        ) : error ? (
          <p className="mt-5 rounded-xl border border-loss/20 bg-loss-soft px-4 py-3 text-sm text-loss">
            {error}
          </p>
        ) : (
          <dl className="mt-5 space-y-2.5 text-sm">
            <Row label="購入価格" value={formatPrice(position.buyPrice, c)} />
            <Row label="売却価格（現在）" value={formatPrice(price!, c)} />
            <Row label="投資金額" value={formatMoney(position.invested, c)} />
            <Row label="売却代金" value={formatMoney(proceeds!, c)} />
            <Row label="保有期間" value={formatHoldingPeriod(position.buyDate, todayISO())} />
            <div className="flex items-center justify-between border-t border-line pt-3">
              <dt className="text-muted">損益</dt>
              <dd>
                <Change
                  value={profit}
                  text={formatSignedMoney(profit!, c)}
                  sub={formatPercent(returnPct)}
                  align="right"
                />
              </dd>
            </div>
          </dl>
        )}

        <p className="mt-5 text-xs leading-relaxed text-muted">
          ※ 実際の売買は行われません。この時点の株価を記録して、取引履歴に残します。
        </p>

        <div className="mt-5 flex gap-3">
          <Button variant="secondary" full onClick={onClose} disabled={submitting}>
            キャンセル
          </Button>
          <Button variant="primary" full onClick={confirm} disabled={loading || !!error || submitting}>
            {submitting ? '記録中…' : '仮想売却する'}
          </Button>
        </div>
      </div>
    </div>
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
