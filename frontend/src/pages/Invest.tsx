import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageContainer, PageHeader } from '../components/PageHeader'
import { StockSearchInput } from '../components/StockSearchInput'
import { Card } from '../components/ui/Card'
import { Button, ButtonLink } from '../components/ui/Button'
import { Field, Input, RadioGroup } from '../components/ui/Field'
import { MetricCard } from '../components/MetricCard'
import { StockAvatar } from '../components/StockAvatar'
import { Sparkline } from '../components/charts/Sparkline'
import { CheckIcon, InfoIcon } from '../components/Icons'
import { api, ApiError } from '../lib/api'
import { portfolioRepository } from '../lib/storage'
import type { Position } from '../lib/storage'
import type { PricePoint, Quote } from '../lib/types'
import {
  currencySymbol,
  displayCode,
  formatDateTimeJa,
  formatMoney,
  formatPrice,
  formatShares,
} from '../lib/format'

type BuyBy = 'shares' | 'amount'

export default function Invest() {
  const [params] = useSearchParams()
  const [ticker, setTicker] = useState(params.get('ticker') ?? '')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [buyBy, setBuyBy] = useState<BuyBy>('shares')
  const [shares, setShares] = useState('10')
  const [amount, setAmount] = useState('100000')
  const [spark, setSpark] = useState<PricePoint[]>([])

  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [done, setDone] = useState<Position | null>(null)

  const onResolved = useCallback((q: Quote | null) => {
    setQuote(q)
    setFormError('')
  }, [])

  // 銘柄が決まったら直近1か月のミニチャートを取得する
  useEffect(() => {
    if (!quote) {
      setSpark([])
      return
    }
    let cancelled = false
    const start = new Date()
    start.setMonth(start.getMonth() - 1)
    const p = (n: number) => String(n).padStart(2, '0')
    api
      .history(quote.ticker, {
        start: `${start.getFullYear()}-${p(start.getMonth() + 1)}-${p(start.getDate())}`,
        maxPoints: 60,
      })
      .then((h) => !cancelled && setSpark(h.points))
      .catch(() => !cancelled && setSpark([]))
    return () => {
      cancelled = true
    }
  }, [quote])

  const currency = quote?.currency ?? 'JPY'

  const previewShares = useMemo(() => {
    if (!quote) return null
    if (buyBy === 'shares') {
      const n = Number(shares)
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : null
    }
    const a = Number(amount)
    if (!Number.isFinite(a) || a <= 0 || quote.price <= 0) return null
    const n = Math.floor(a / quote.price)
    return n >= 1 ? n : null
  }, [quote, buyBy, shares, amount])

  const submit = async () => {
    setFormError('')
    if (!quote) return setFormError('銘柄が確定していません。証券コードを入力するか、候補から銘柄を選んでください。')
    if (previewShares == null) {
      return setFormError(
        buyBy === 'shares'
          ? '購入株数は1以上の数値で入力してください。'
          : '投資金額が1株分の価格に届いていません。金額を増やしてください。',
      )
    }

    setSubmitting(true)
    try {
      // 仮想購入した瞬間の価格を確定させるため、直前に最新価格を取り直す
      const fresh = await api.quote(quote.ticker)
      const saved = await portfolioRepository.add({
        ticker: fresh.ticker,
        name: fresh.name ?? quote.name ?? fresh.ticker,
        market: fresh.market,
        currency: fresh.currency,
        buyPrice: fresh.price,
        shares: previewShares,
      })
      setDone(saved)
      window.scrollTo({ top: 0 })
    } catch (e) {
      setFormError(
        e instanceof ApiError ? e.message : '株価データを取得できませんでした。もう一度お試しください。',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <PageContainer narrow>
        <Card padding="lg" className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gain-soft text-gain">
            <CheckIcon className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-xl font-bold text-ink">仮想購入が完了しました</h1>
          <p className="mt-2 text-sm text-muted">
            実際のお金は使われていません。購入価格はこの時点の株価で固定されます。
          </p>

          <div className="mt-7 flex items-center gap-3 rounded-2xl border border-line bg-canvas-2 p-4 text-left">
            <StockAvatar ticker={done.ticker} name={done.name} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-ink">{done.name}</p>
              <p className="text-xs text-muted">
                {displayCode(done.ticker)}
                <span className="mx-1.5 text-line">|</span>
                {formatDateTimeJa(done.buyAt)}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <MetricCard label="購入価格" value={formatPrice(done.buyPrice, done.currency)} />
            <MetricCard label="購入株数" value={`${formatShares(done.shares)}株`} />
            <MetricCard label="投資金額" value={formatMoney(done.invested, done.currency)} />
          </div>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <ButtonLink to="/portfolio" size="lg" variant="primary">
              ポートフォリオを見る
            </ButtonLink>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => {
                setDone(null)
                setTicker('')
                setQuote(null)
              }}
            >
              続けて別の銘柄を買う
            </Button>
          </div>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer narrow>
      <PageHeader
        title="今日から仮想投資"
        description="今この株を買ったことにして、仮想ポートフォリオに追加します。実際の取引は行われません。"
      />

      <Card padding="lg">
        <div className="space-y-6">
          <StockSearchInput
            value={ticker}
            onChange={setTicker}
            onResolved={onResolved}
            autoFocus={!params.get('ticker')}
            showPrice={false}
          />

          <Field label="購入方法">
            <RadioGroup
              name="invest-by"
              value={buyBy}
              onChange={setBuyBy}
              options={[
                { value: 'shares', label: '株数で指定' },
                { value: 'amount', label: '投資金額で指定' },
              ]}
            />
          </Field>

          {buyBy === 'shares' ? (
            <Field label="購入株数" htmlFor="invest-shares">
              <div className="flex items-center gap-3">
                <Input
                  id="invest-shares"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={shares}
                  onChange={(e) => setShares(e.target.value)}
                />
                <span className="shrink-0 text-sm text-muted">株</span>
              </div>
            </Field>
          ) : (
            <Field
              label="投資金額"
              htmlFor="invest-amount"
              hint={`購入できる最大の株数（整数）に換算します。単位は${
                currency === 'JPY' ? '円' : 'ドル'
              }です。`}
            >
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">
                  {currencySymbol(currency)}
                </span>
                <Input
                  id="invest-amount"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-8"
                />
              </div>
            </Field>
          )}

          {quote ? (
            <div className="rounded-2xl border border-line bg-canvas-2 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-muted">現在の株価（参考）</p>
                  <p className="num mt-1 text-3xl text-ink">{formatPrice(quote.price, currency)}</p>
                  <p className="mt-1 text-xs text-muted">{formatDateTimeJa(quote.asOf)} 更新</p>
                </div>
                <div className="w-32 sm:w-40">
                  <Sparkline
                    data={spark.map((p) => ({ date: p.date, price: p.close }))}
                    tone={(quote.changePercent ?? 0) >= 0 ? 'gain' : 'loss'}
                  />
                  <p className="mt-0.5 text-right text-[0.6875rem] text-faint">直近1か月</p>
                </div>
              </div>

              {previewShares != null ? (
                <p className="mt-4 border-t border-line pt-4 text-sm text-ink-soft">
                  <span className="num font-semibold text-ink">{formatShares(previewShares)}株</span>
                  {' を '}
                  <span className="num font-semibold text-ink">{formatPrice(quote.price, currency)}</span>
                  {' で購入 → 投資金額 '}
                  <span className="num font-semibold text-ink">
                    {formatMoney(previewShares * quote.price, currency)}
                  </span>
                </p>
              ) : null}
            </div>
          ) : null}

          {formError ? (
            <p className="rounded-xl border border-loss/20 bg-loss-soft px-4 py-3 text-sm text-loss">
              {formError}
            </p>
          ) : null}

          <Button variant="success" size="lg" full onClick={submit} disabled={submitting || !quote}>
            {submitting ? '購入処理中…' : '仮想購入する'}
          </Button>

          <p className="text-center text-xs leading-relaxed text-muted">
            ※ 購入後も最新の株価と比較して損益を確認できます。購入時の価格は変わりません。
          </p>
        </div>
      </Card>

      <Card className="mt-6" padding="md">
        <div className="flex gap-3">
          <span className="mt-0.5 text-brand">
            <InfoIcon className="h-5 w-5" />
          </span>
          <div className="text-sm leading-relaxed text-muted">
            <p className="font-semibold text-ink">記録はこの端末のブラウザに保存されます</p>
            <p className="mt-1">
              サーバーには送信されません。履歴は
              <Link to="/history" className="mx-1 text-brand hover:underline">
                取引履歴
              </Link>
              からいつでも確認できます。
            </p>
          </div>
        </div>
      </Card>
    </PageContainer>
  )
}
