import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageContainer, PageHeader } from '../components/PageHeader'
import { StockSearchInput } from '../components/StockSearchInput'
import { Card, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Field, Input, RadioGroup } from '../components/ui/Field'
import { Badge } from '../components/ui/Badge'
import { MetricCard } from '../components/MetricCard'
import { Change } from '../components/Change'
import { StockAvatar } from '../components/StockAvatar'
import { SimulationNote } from '../components/Disclaimer'
import { ErrorBlock, LoadingBlock } from '../components/ui/States'
import { PriceChart } from '../components/charts/PriceChart'
import { ValueChart } from '../components/charts/ValueChart'
import { CHART_COLORS } from '../components/charts/chartUtils'
import { ArrowLeftIcon, ArrowRightIcon, InfoIcon, SplitIcon } from '../components/Icons'
import { api, ApiError } from '../lib/api'
import type { PastSimulation as Result, Quote } from '../lib/types'
import {
  currencySymbol,
  displayCode,
  formatDateJa,
  formatMoney,
  formatPercent,
  formatPrice,
  formatShares,
  formatSignedMoney,
  todayISO,
} from '../lib/format'

type BuyBy = 'shares' | 'amount'

const oneYearAgo = () => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 1)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function PastSimulation() {
  const [ticker, setTicker] = useState('')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [date, setDate] = useState(oneYearAgo())
  const [buyBy, setBuyBy] = useState<BuyBy>('shares')
  const [shares, setShares] = useState('100')
  const [amount, setAmount] = useState('300000')

  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'done'>('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [formError, setFormError] = useState('')

  const onResolved = useCallback((q: Quote | null) => setQuote(q), [])

  const currency = quote?.currency ?? 'JPY'

  const submit = async () => {
    setFormError('')
    if (!ticker.trim()) return setFormError('銘柄を入力してください。')
    if (!quote) return setFormError('銘柄が確定していません。証券コードを入力するか、候補から銘柄を選んでください。')
    if (!date) return setFormError('購入日を入力してください。')
    if (date > todayISO()) return setFormError('購入日には過去の日付を指定してください。')

    const sharesNum = Number(shares)
    const amountNum = Number(amount)
    if (buyBy === 'shares' && (!Number.isFinite(sharesNum) || sharesNum <= 0)) {
      return setFormError('購入株数は1以上の数値で入力してください。')
    }
    if (buyBy === 'amount' && (!Number.isFinite(amountNum) || amountNum <= 0)) {
      return setFormError('投資金額は1以上の数値で入力してください。')
    }

    setStatus('loading')
    setError('')
    try {
      const res = await api.simulatePast({
        ticker: quote.ticker,
        date,
        ...(buyBy === 'shares' ? { shares: sharesNum } : { amount: amountNum }),
        maxPoints: 400,
      })
      setResult(res)
      setStatus('done')
      window.scrollTo({ top: 0 })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '株価データを取得できませんでした。')
      setStatus('error')
    }
  }

  if (status === 'done' && result) {
    return (
      <PageContainer>
        <button
          type="button"
          onClick={() => {
            setStatus('idle')
            window.scrollTo({ top: 0 })
          }}
          className="focus-ring mb-5 inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-brand hover:underline"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          入力に戻る
        </button>
        <ResultView result={result} onRerun={() => setStatus('idle')} />
      </PageContainer>
    )
  }

  return (
    <PageContainer narrow>
      <PageHeader
        title="過去シミュレーション"
        description="あの日この株を買っていたら、今いくらになっていたかをシミュレーションします。"
      />

      <Card padding="lg">
        <div className="space-y-6">
          <StockSearchInput value={ticker} onChange={setTicker} onResolved={onResolved} autoFocus />

          <Field
            label="購入日"
            htmlFor="buy-date"
            hint="休場日を指定した場合は、次の取引日の終値で計算します。"
          >
            <Input
              id="buy-date"
              type="date"
              value={date}
              max={todayISO()}
              min="1970-01-01"
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>

          <Field label="購入方法">
            <RadioGroup
              name="buy-by"
              value={buyBy}
              onChange={setBuyBy}
              options={[
                { value: 'shares', label: '株数で指定' },
                { value: 'amount', label: '投資金額で指定' },
              ]}
            />
          </Field>

          {buyBy === 'shares' ? (
            <Field label="購入株数" htmlFor="shares">
              <div className="flex items-center gap-3">
                <Input
                  id="shares"
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
              htmlFor="amount"
              hint={`購入できる最大の株数（整数）で計算します。単位は${
                currency === 'JPY' ? '円' : 'ドル'
              }です。`}
            >
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">
                  {currencySymbol(currency)}
                </span>
                <Input
                  id="amount"
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

          {formError ? (
            <p className="rounded-xl border border-loss/20 bg-loss-soft px-4 py-3 text-sm text-loss">
              {formError}
            </p>
          ) : null}

          <Button size="lg" full onClick={submit} disabled={status === 'loading'}>
            {status === 'loading' ? '計算中…' : 'シミュレーションする'}
          </Button>
        </div>
      </Card>

      {status === 'loading' ? (
        <Card className="mt-6">
          <LoadingBlock />
        </Card>
      ) : null}

      {status === 'error' ? (
        <div className="mt-6">
          <ErrorBlock message={error} onRetry={submit} />
        </div>
      ) : null}

      <Card className="mt-6" padding="md">
        <div className="flex gap-3">
          <span className="mt-0.5 text-brand">
            <InfoIcon className="h-5 w-5" />
          </span>
          <div className="text-sm leading-relaxed text-muted">
            <p className="font-semibold text-ink">ヒント</p>
            <p className="mt-1">
              日本株は証券コード（例：5401・150A）、米国株はティッカー（例：AAPL）で探せます。「日本製鉄」「Apple」のように社名で探して、候補から選ぶこともできます。
            </p>
          </div>
        </div>
      </Card>
    </PageContainer>
  )
}

function ResultView({ result, onRerun }: { result: Result; onRerun: () => void }) {
  const c = result.currency
  const priceSeries = useMemo(
    () => result.series.map((p) => ({ date: p.date, price: p.price })),
    [result.series],
  )
  const valueSeries = useMemo(
    () => result.series.map((p) => ({ date: p.date, value: p.value })),
    [result.series],
  )
  const tone = result.profit >= 0 ? ('gain' as const) : ('loss' as const)
  const buyPointPrice = result.series[0]?.price ?? result.purchasePrice
  const hasSplit = result.splitFactor !== 1
  // 休場日によるズレ（数日）と、上場前など「データが無い」ケース（数か月〜）を区別する
  const gapDays = Math.round(
    (new Date(result.tradeDate).getTime() - new Date(result.requestedDate).getTime()) / 86_400_000,
  )

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[1.75rem]">
        シミュレーション結果
      </h1>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <StockAvatar ticker={result.ticker} name={result.name} size="lg" />
            <div>
              <p className="text-lg font-bold text-ink sm:text-xl">{result.name}</p>
              <p className="text-sm text-muted">
                {displayCode(result.ticker)}
                <span className="mx-1.5 text-line">|</span>
                {result.market === 'JP' ? '日本株' : '米国株'}
              </p>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-ink-soft sm:text-right">
            <span className="font-semibold text-ink">{formatDateJa(result.tradeDate)}</span> に
            <br className="hidden sm:block" />
            {formatShares(result.shares)}株 購入していたら…
          </p>
        </div>

        {result.marketClosed || hasSplit ? (
          <div className="mt-5 space-y-2.5 border-t border-line-soft pt-5">
            {result.marketClosed ? (
              <Notice tone="warn" icon={<InfoIcon className="h-4 w-4" />}>
                {gapDays > 7 ? (
                  <>
                    指定日（{formatDateJa(result.requestedDate)}）には株価データがなかったため、
                    データのある最初の取引日{' '}
                    <span className="font-semibold">{formatDateJa(result.tradeDate)}</span>{' '}
                    の終値で購入したものとして計算しました。上場前の日付を指定した可能性があります。
                  </>
                ) : (
                  <>
                    指定日（{formatDateJa(result.requestedDate)}）は休場日だったため、次の取引日{' '}
                    <span className="font-semibold">{formatDateJa(result.tradeDate)}</span>{' '}
                    の終値で購入したものとして計算しました。
                  </>
                )}
              </Notice>
            ) : null}
            {hasSplit ? (
              <Notice tone="brand" icon={<SplitIcon className="h-4 w-4" />}>
                購入後に株式分割（
                {result.splits.map((s) => `${formatDateJa(s.date)} 1:${s.ratio}`).join('、')}
                ）がありました。保有株数を {formatShares(result.shares)}株 →{' '}
                <span className="font-semibold">{formatShares(result.sharesNow)}株</span>{' '}
                として計算しています。
              </Notice>
            ) : null}
          </div>
        ) : null}
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="購入株価" value={formatPrice(result.purchasePrice, c)} />
        <MetricCard
          label="投資金額"
          value={formatMoney(result.invested, c)}
          sub={
            result.requestedAmount != null && result.leftoverCash >= 1
              ? `指定 ${formatMoney(result.requestedAmount, c)}（余り ${formatMoney(
                  result.leftoverCash,
                  c,
                )}）`
              : undefined
          }
        />
        <MetricCard label="現在株価" value={formatPrice(result.currentPrice, c)} />
        <MetricCard label="現在評価額" value={formatMoney(result.currentValue, c)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard
          label="損益"
          tone={tone}
          size="lg"
          value={<Change value={result.profit} text={formatSignedMoney(result.profit, c)} size="lg" />}
          sub={`現在の保有株数 ${formatShares(result.sharesNow)}株`}
        />
        <MetricCard
          label="リターン"
          tone={tone}
          size="lg"
          value={<Change value={result.returnPct} text={formatPercent(result.returnPct)} size="lg" />}
          sub={`${formatDateJa(result.tradeDate)} 〜 ${formatDateJa(result.currentDate)}`}
        />
      </div>

      <SimulationNote />

      <Card>
        <CardTitle hint={hasSplit ? '分割調整後の株価で表示' : undefined}>株価の推移</CardTitle>
        <PriceChart
          data={priceSeries}
          currency={c}
          markers={[
            {
              date: result.tradeDate,
              price: buyPointPrice,
              label: hasSplit
                ? `購入 ${formatPrice(buyPointPrice, c)}（調整後）`
                : `購入 ${formatPrice(result.purchasePrice, c)}`,
              color: CHART_COLORS.buy,
            },
            {
              date: result.currentDate,
              price: result.currentPrice,
              label: `現在 ${formatPrice(result.currentPrice, c)}`,
              color: CHART_COLORS.now,
            },
          ]}
        />
        {hasSplit ? (
          <p className="mt-3 text-xs leading-relaxed text-muted">
            ※ 株式分割があったため、チャートは分割調整後の株価で表示しています。実際に支払った株価は
            {formatPrice(result.purchasePrice, c)}（分割前）です。
          </p>
        ) : null}
      </Card>

      <Card>
        <CardTitle hint={`${formatShares(result.sharesNow)}株を保有し続けた場合`}>
          あなたの資産額の推移
        </CardTitle>
        <ValueChart data={valueSeries} currency={c} baseline={result.invested} tone={tone} />
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted">
          <span>
            投資金額 <span className="num text-ink">{formatMoney(result.invested, c)}</span>
          </span>
          <span>
            現在評価額 <span className="num text-ink">{formatMoney(result.currentValue, c)}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            損益
            <Change value={result.profit} text={formatSignedMoney(result.profit, c)} size="sm" />
          </span>
        </div>
      </Card>

      <Card padding="lg" className="text-center">
        <Badge tone="brand">次のステップ</Badge>
        <p className="mt-3 text-base font-bold text-ink">今日からこの銘柄で仮想投資してみますか？</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          今日の株価で「買ったことにして」ポートフォリオに登録すると、これからの値動きを毎日追いかけられます。
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            to={`/invest?ticker=${encodeURIComponent(result.ticker)}`}
            className="focus-ring inline-flex h-12 items-center gap-2 rounded-xl bg-gain px-6 text-base font-semibold text-white transition hover:bg-[#128a3f]"
          >
            仮想投資を始める
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
          <Button variant="secondary" size="lg" onClick={onRerun}>
            別の条件で試す
          </Button>
        </div>
      </Card>
    </div>
  )
}

function Notice({
  tone,
  icon,
  children,
}: {
  tone: 'warn' | 'brand'
  icon: React.ReactNode
  children: React.ReactNode
}) {
  const styles =
    tone === 'warn'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-brand/15 bg-brand-soft text-brand'
  return (
    <div className={`flex gap-2.5 rounded-xl border px-4 py-3 text-sm leading-relaxed ${styles}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <p>{children}</p>
    </div>
  )
}
