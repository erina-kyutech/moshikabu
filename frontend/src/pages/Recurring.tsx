import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageContainer, PageHeader } from '../components/PageHeader'
import { Card, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Field, Input, RadioGroup, Select } from '../components/ui/Field'
import { ErrorBlock, LoadingBlock } from '../components/ui/States'
import { StockSearchInput } from '../components/StockSearchInput'
import { StockAvatar } from '../components/StockAvatar'
import { MetricCard } from '../components/MetricCard'
import { Change } from '../components/Change'
import { SimulationNote } from '../components/Disclaimer'
import { PrincipalValueChart } from '../components/charts/PrincipalValueChart'
import { ArrowLeftIcon, ArrowRightIcon, InfoIcon, SplitIcon } from '../components/Icons'
import { api, ApiError } from '../lib/api'
import type { BaseCurrency, Quote, RecurringSimulation } from '../lib/types'
import {
  displayCode,
  formatDateJa,
  formatDateSlash,
  formatMoney,
  formatPercent,
  formatPrice,
  formatShares,
  formatSignedMoney,
  todayISO,
} from '../lib/format'

const BUY_DAYS: Array<{ value: string; label: string }> = [
  { value: '1', label: '毎月1日' },
  { value: '5', label: '毎月5日' },
  { value: '10', label: '毎月10日' },
  { value: '15', label: '毎月15日' },
  { value: '20', label: '毎月20日' },
  { value: '25', label: '毎月25日' },
  { value: 'end', label: '月末' },
]

const fiveYearsAgo = () => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 5)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-01`
}

export default function Recurring() {
  const [ticker, setTicker] = useState('QQQ')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [start, setStart] = useState(fiveYearsAgo())
  const [amount, setAmount] = useState('30000')
  const [buyDay, setBuyDay] = useState('1')
  const [base, setBase] = useState<BaseCurrency>('JPY')

  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'done'>('idle')
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [result, setResult] = useState<RecurringSimulation | null>(null)

  const onResolved = useCallback((q: Quote | null) => setQuote(q), [])

  const submit = async () => {
    setFormError('')
    if (!ticker.trim()) return setFormError('銘柄を入力してください。')
    if (!quote) return setFormError('銘柄が確定していません。証券コードを入力するか、候補から銘柄を選んでください。')
    if (!start) return setFormError('積立開始日を入力してください。')
    if (start > todayISO()) return setFormError('積立開始日には過去の日付を指定してください。')
    const amountNum = Number(amount)
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return setFormError('毎月の積立金額は1以上の数値で入力してください。')
    }

    setStatus('loading')
    setError('')
    try {
      const res = await api.recurring({
        ticker: quote.ticker,
        start,
        amount: amountNum,
        buyDay,
        base,
        fractional: true,
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
          条件を変える
        </button>
        <RecurringResult result={result} />
      </PageContainer>
    )
  }

  return (
    <PageContainer narrow>
      <PageHeader
        title="もし毎月3万円積み立ててたら？"
        description="毎月一定額を投資していた場合の資産推移を確認できます。実際のお金は使いません。"
      />

      <Card padding="lg">
        <div className="space-y-6">
          <StockSearchInput value={ticker} onChange={setTicker} onResolved={onResolved} />

          <Field label="積立開始日" htmlFor="dca-start">
            <Input
              id="dca-start"
              type="date"
              value={start}
              max={todayISO()}
              min="1970-01-01"
              onChange={(e) => setStart(e.target.value)}
            />
          </Field>

          <Field label="毎月の積立金額" htmlFor="dca-amount">
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">
                ¥
              </span>
              <Input
                id="dca-amount"
                type="number"
                inputMode="numeric"
                min={1}
                step={1000}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-8"
              />
            </div>
          </Field>

          <Field
            label="買付日"
            htmlFor="dca-day"
            hint="指定日が休場だった月は、次の取引日の株価で買ったものとして計算します。"
          >
            <Select id="dca-day" value={buyDay} onChange={(e) => setBuyDay(e.target.value)}>
              {BUY_DAYS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
          </Field>

          {quote && quote.currency !== 'JPY' ? (
            <Field
              label="金額の見せかた"
              hint={
                base === 'JPY'
                  ? '毎月の積立額を円で決め、その月の為替レートでドルに替えて買ったものとして計算します。'
                  : '毎月の積立額をドルで決めた場合。為替の影響を除いた結果を見られます。'
              }
            >
              <RadioGroup
                name="dca-base"
                value={base}
                onChange={setBase}
                options={[
                  { value: 'JPY', label: '円で積み立てる' },
                  { value: 'LOCAL', label: '現地通貨で積み立てる' },
                ]}
              />
            </Field>
          ) : null}

          {formError ? (
            <p className="rounded-xl border border-loss/20 bg-loss-soft px-4 py-3 text-sm text-loss">
              {formError}
            </p>
          ) : null}

          <Button
            size="lg"
            full
            onClick={submit}
            disabled={status === 'loading'}
            className="bg-recurring shadow-[0_2px_8px_rgba(234,88,12,0.20)] hover:bg-[#c2410c]"
          >
            {status === 'loading' ? '計算中…' : '積立をシミュレーションする'}
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
          <span className="mt-0.5 text-recurring">
            <InfoIcon className="h-5 w-5" />
          </span>
          <div className="text-sm leading-relaxed text-muted">
            <p className="font-semibold text-ink">積立ってどういうこと？</p>
            <p className="mt-1">
              毎月おなじ金額を買い続ける方法です。株価が高い月は少なく、安い月は多く買えるので、
              買うタイミングを悩まなくて済むのが特長です。
            </p>
          </div>
        </div>
      </Card>
    </PageContainer>
  )
}

function RecurringResult({ result }: { result: RecurringSimulation }) {
  const [showAllLots, setShowAllLots] = useState(false)
  const c = result.baseCurrency
  const local = result.currency
  const tone = result.profit >= 0 ? ('gain' as const) : ('loss' as const)
  const hasSplit = result.lots.some((l) => Math.abs(l.shares - l.sharesNow) > 1e-9)
  const years = Math.floor(result.periodMonths / 12)
  const restMonths = result.periodMonths % 12
  const periodLabel =
    years > 0 ? `${years}年${restMonths > 0 ? `${restMonths}か月` : ''}` : `${restMonths}か月`

  const lots = showAllLots ? result.lots : result.lots.slice(-12).reverse()
  const orderedLots = showAllLots ? [...result.lots].reverse() : lots

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[1.75rem]">積立シミュレーション結果</h1>

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
            <span className="font-semibold text-ink">{formatDateJa(result.startDate)}</span> から
            <br className="hidden sm:block" />
            毎月 {formatMoney(result.monthlyAmount, c)} を積み立てていたら…
          </p>
        </div>
      </Card>

      {/* いちばん知りたい4つ */}
      <Card padding="lg">
        <p className="text-sm font-medium text-muted">現在評価額</p>
        <p className="num mt-1 text-4xl leading-tight text-ink sm:text-5xl">
          {formatMoney(result.currentValue, c)}
        </p>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard label="投資元本（入れたお金）" value={formatMoney(result.invested, c)} />
          <MetricCard
            label="利益（増えた額）"
            tone={tone}
            value={<Change value={result.profit} text={formatSignedMoney(result.profit, c)} size="md" />}
          />
          <MetricCard
            label="リターン"
            tone={tone}
            value={<Change value={result.returnPct} text={formatPercent(result.returnPct)} size="md" />}
          />
        </div>
        <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2 border-t border-line-soft pt-5 text-sm">
          <div className="flex gap-2">
            <dt className="text-muted">積立期間</dt>
            <dd className="num text-ink">{periodLabel}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted">積立回数</dt>
            <dd className="num text-ink">{result.contributions}回</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted">保有株数</dt>
            <dd className="num text-ink">
              {formatShares(Math.round(result.sharesNow * 1000) / 1000)}株
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted">現在株価</dt>
            <dd className="num text-ink">{formatPrice(result.currentPrice, local)}</dd>
          </div>
        </dl>
      </Card>

      <SimulationNote />

      {/* 元本 vs 評価額 */}
      <Card>
        <CardTitle hint="点線が自分で入れたお金">元本と評価額の推移</CardTitle>
        {result.series.length < 2 ? (
          <p className="py-12 text-center text-sm text-muted">
            表示できるデータがまだありません。開始日を早めてお試しください。
          </p>
        ) : (
          <PrincipalValueChart data={result.series} currency={c} height={340} />
        )}
      </Card>

      {hasSplit ? (
        <div className="flex gap-2.5 rounded-xl border border-brand/15 bg-brand-soft px-4 py-3 text-sm leading-relaxed text-brand">
          <SplitIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            積立期間中に株式分割がありました。買付履歴の株数は「その時点で買えた株数」、保有株数は分割を反映した現在の株数です。
          </p>
        </div>
      ) : null}

      {/* 買付履歴 */}
      <Card padding="none">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5 sm:px-6 sm:pt-6">
          <h2 className="text-base font-bold text-ink sm:text-lg">買付履歴</h2>
          <span className="text-xs text-muted">
            {showAllLots ? `全${result.lots.length}回` : `直近12回 / 全${result.lots.length}回`}
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="px-6 py-3 font-medium">買付日</th>
                <th className="px-3 py-3 text-right font-medium">投資額</th>
                <th className="px-3 py-3 text-right font-medium">株価</th>
                <th className="px-3 py-3 text-right font-medium">購入株数</th>
                <th className="px-6 py-3 text-right font-medium">現在の株数</th>
              </tr>
            </thead>
            <tbody>
              {orderedLots.map((lot) => (
                <tr key={`${lot.requestedDate}-${lot.tradeDate}`} className="border-t border-line-soft">
                  <td className="px-6 py-3.5">
                    <span className="text-ink">{formatDateSlash(lot.tradeDate)}</span>
                    {lot.marketClosed ? (
                      <span className="ml-2 text-xs text-muted">
                        （{formatDateSlash(lot.requestedDate)}は休場）
                      </span>
                    ) : null}
                  </td>
                  <td className="num px-3 py-3.5 text-right text-ink-soft">
                    {formatMoney(lot.amount, c)}
                    {c !== local ? (
                      <span className="block text-xs font-normal text-faint">
                        {formatMoney(lot.amountLocal, local)}
                      </span>
                    ) : null}
                  </td>
                  <td className="num px-3 py-3.5 text-right text-ink-soft">
                    {formatPrice(lot.price, local)}
                  </td>
                  <td className="num px-3 py-3.5 text-right text-ink">
                    {formatShares(Math.round(lot.shares * 10000) / 10000)}
                  </td>
                  <td className="num px-6 py-3.5 text-right text-ink-soft">
                    {formatShares(Math.round(lot.sharesNow * 10000) / 10000)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {result.lots.length > 12 ? (
          <div className="border-t border-line-soft px-5 py-4 text-center sm:px-6">
            <Button variant="secondary" onClick={() => setShowAllLots((v) => !v)}>
              {showAllLots ? '直近12回だけ表示' : `全${result.lots.length}回を表示`}
            </Button>
          </div>
        ) : null}
      </Card>

      <Card padding="lg" className="text-center">
        <p className="text-base font-bold text-ink">一括で買っていたらどうだった？</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          同じ総額を最初にまとめて投資した場合と、毎月積み立てた場合を並べて比べられます。
        </p>
        <div className="mt-6 flex justify-center">
          <Link
            to={`/compare-strategy?ticker=${encodeURIComponent(result.ticker)}&start=${
              result.startDate
            }&monthly=${result.monthlyAmount}&months=${result.contributions}&buyDay=${result.buyDay}`}
            className="focus-ring inline-flex h-12 items-center gap-2 rounded-xl bg-recurring px-6 text-base font-semibold text-white transition hover:bg-[#c2410c]"
          >
            一括投資と比べる
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </Card>
    </div>
  )
}
