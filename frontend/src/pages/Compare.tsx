import { useCallback, useMemo, useState } from 'react'
import { PageContainer, PageHeader } from '../components/PageHeader'
import { Card, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Field, Input, RadioGroup } from '../components/ui/Field'
import { Badge } from '../components/ui/Badge'
import { ErrorBlock, LoadingBlock } from '../components/ui/States'
import { TickerRowInput } from '../components/TickerRowInput'
import type { ResolvedSymbol } from '../components/TickerRowInput'
import { StockAvatar } from '../components/StockAvatar'
import { Change } from '../components/Change'
import { SimulationNote } from '../components/Disclaimer'
import { MultiSeriesChart } from '../components/charts/MultiSeriesChart'
import type { SeriesMeta } from '../components/charts/MultiSeriesChart'
import { seriesColor } from '../components/charts/chartUtils'
import { ArrowLeftIcon, InfoIcon, SplitIcon } from '../components/Icons'
import { api, ApiError } from '../lib/api'
import type { BaseCurrency, Comparison, Currency } from '../lib/types'
import {
  displayCode,
  formatDateJa,
  formatMoney,
  formatPercent,
  formatPrice,
  formatShares,
  formatSignedMoney,
  todayISO,
} from '../lib/format'

const MAX_TICKERS = 10
const DEFAULT_TICKERS = ['AAPL', 'NVDA', 'QQQ']

/** 初心者がすぐ試せるように、代表的な銘柄・指数をワンタップで足せるようにする */
const PRESETS: Array<{ label: string; ticker: string }> = [
  { label: 'Apple', ticker: 'AAPL' },
  { label: 'NVIDIA', ticker: 'NVDA' },
  { label: 'Microsoft', ticker: 'MSFT' },
  { label: 'NASDAQ100', ticker: 'QQQ' },
  { label: 'S&P500', ticker: 'VOO' },
  { label: '全世界株', ticker: 'VT' },
  { label: '日経平均', ticker: '^N225' },
  { label: 'トヨタ', ticker: '7203' },
  { label: 'ソニー', ticker: '6758' },
  { label: '日本製鉄', ticker: '5401' },
]

const fiveYearsAgo = () => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 5)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-01`
}

interface Row {
  id: number
  text: string
  /** 候補から確定した銘柄（未確定なら null） */
  resolved: ResolvedSymbol | null
}

let nextRowId = 0
const makeRow = (text = ''): Row => ({ id: nextRowId++, text, resolved: null })

export default function Compare() {
  const [rows, setRows] = useState<Row[]>(() => DEFAULT_TICKERS.map((t) => makeRow(t)))
  const [date, setDate] = useState(fiveYearsAgo())
  const [amount, setAmount] = useState('1000000')
  const [base, setBase] = useState<BaseCurrency>('JPY')

  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'done'>('idle')
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [result, setResult] = useState<Comparison | null>(null)

  const setText = (id: number, text: string) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, text } : r)))

  const setResolved = useCallback(
    (id: number, resolved: ResolvedSymbol | null) =>
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, resolved } : r))),
    [],
  )

  const addRow = (text = '') =>
    setRows((prev) => (prev.length >= MAX_TICKERS ? prev : [...prev, makeRow(text)]))

  const removeRow = (id: number) =>
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)))

  const addPreset = (ticker: string) => {
    setRows((prev) => {
      const key = ticker.toUpperCase()
      if (prev.some((r) => r.text.trim().toUpperCase() === key)) return prev
      const empty = prev.find((r) => !r.text.trim())
      if (empty) return prev.map((r) => (r.id === empty.id ? { ...r, text: ticker, resolved: null } : r))
      if (prev.length >= MAX_TICKERS) return prev
      return [...prev, makeRow(ticker)]
    })
  }

  const submit = async () => {
    setFormError('')
    const filledRows = rows.filter((r) => r.text.trim())
    if (filledRows.length === 0) return setFormError('比較する銘柄を1つ以上入力してください。')
    const unresolved = filledRows.findIndex((r) => !r.resolved)
    if (unresolved >= 0) {
      return setFormError(
        `${rows.indexOf(filledRows[unresolved]) + 1}行目の銘柄が確定していません。候補から銘柄を選んでください。`,
      )
    }
    const filled = filledRows.map((r) => r.resolved!.ticker)
    if (!date) return setFormError('開始日を入力してください。')
    if (date > todayISO()) return setFormError('開始日には過去の日付を指定してください。')
    const amountNum = Number(amount)
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return setFormError('投資金額は1以上の数値で入力してください。')
    }

    setStatus('loading')
    setError('')
    try {
      const res = await api.compare({
        tickers: filled,
        date,
        amount: amountNum,
        base,
        fractional: true,
        maxPoints: 300,
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
        <CompareResult result={result} />
      </PageContainer>
    )
  }

  return (
    <PageContainer narrow>
      <PageHeader
        title="もし100万円ずつ投資してたら？"
        description="同じ金額をそれぞれの銘柄に投資していた場合の結果を比較できます。金額は分け合うのではなく、各銘柄に同額ずつ投資します。"
      />

      <Card padding="lg">
        <div className="space-y-6">
          <Field label="開始日" htmlFor="compare-date" hint="休場日の場合は次の取引日で購入したものとして計算します。">
            <Input
              id="compare-date"
              type="date"
              value={date}
              max={todayISO()}
              min="1970-01-01"
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>

          <Field
            label="投資金額（1銘柄あたり）"
            htmlFor="compare-amount"
            hint="この金額を、それぞれの銘柄に同額ずつ投資したものとして計算します。"
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">
                ¥
              </span>
              <Input
                id="compare-amount"
                type="number"
                inputMode="numeric"
                min={1}
                step={10000}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-8"
              />
            </div>
          </Field>

          <div>
            <p className="mb-2 block text-sm font-medium text-ink-soft">
              比較する銘柄
              <span className="ml-2 text-xs font-normal text-muted">
                {rows.filter((r) => r.text.trim()).length} / {MAX_TICKERS}
              </span>
            </p>
            <div className="space-y-2.5">
              {rows.map((row, i) => (
                <TickerRowInput
                  key={row.id}
                  index={i}
                  value={row.text}
                  color={seriesColor(i)}
                  canRemove={rows.length > 1}
                  onChange={(v) => setText(row.id, v)}
                  onResolved={(r) => setResolved(row.id, r)}
                  onRemove={() => removeRow(row.id)}
                />
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => addRow()}
                disabled={rows.length >= MAX_TICKERS}
                className="h-10 px-3 text-sm"
              >
                ＋ 銘柄を追加
              </Button>
              <span className="text-xs text-muted">証券コード（5401・150A）や社名でも探せます</span>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-xs text-muted">よく使う銘柄</p>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.ticker}
                    type="button"
                    onClick={() => addPreset(preset.ticker)}
                    className="focus-ring rounded-full border border-line bg-canvas-2 px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-[color:var(--color-compare)]/30 hover:bg-compare-soft hover:text-compare"
                  >
                    ＋ {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Field
            label="金額の見せかた"
            hint={
              base === 'JPY'
                ? '米国株は購入日の為替レートで円に換算して投資したものとして計算します。'
                : '各銘柄をその市場の通貨で同額ずつ買った場合。為替の影響を除いた、株価だけのリターンを見られます。'
            }
          >
            <RadioGroup
              name="compare-base"
              value={base}
              onChange={setBase}
              options={[
                { value: 'JPY', label: '円に換算して比較' },
                { value: 'LOCAL', label: '現地通貨のまま比較' },
              ]}
            />
          </Field>

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
            className="bg-compare shadow-[0_2px_8px_rgba(124,58,237,0.20)] hover:bg-[#6d28d9]"
          >
            {status === 'loading' ? '計算中…' : '比較する'}
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
    </PageContainer>
  )
}

function CompareResult({ result }: { result: Comparison }) {
  // 円換算モードは常に円。現地通貨モードは、全銘柄が同じ通貨のときだけその通貨で表示する
  const currencies = new Set(result.items.map((i) => i.currency))
  const displayCurrency: Currency =
    result.base === 'JPY' || currencies.size !== 1 ? 'JPY' : [...currencies][0]
  const seriesList: SeriesMeta[] = useMemo(
    () =>
      result.items
        .slice()
        .sort((a, b) => Number(a.key.slice(1)) - Number(b.key.slice(1)))
        .map((item, i) => ({
          key: item.key,
          label: item.name.length > 16 ? `${item.name.slice(0, 16)}…` : item.name,
          sublabel: displayCode(item.ticker),
          color: seriesColor(i),
        })),
    [result.items],
  )
  const colorByKey = new Map(seriesList.map((s) => [s.key, s.color]))

  const chartData = useMemo(
    () => result.series.map((row) => ({ date: row.date, ...row.values })),
    [result.series],
  )

  const year = result.startDate.slice(0, 4)
  const best = result.items[0]

  /** 現地通貨モードでは銘柄ごとに通貨が違うので、行ごとに切り替える */
  const moneyOf = (value: number, currency: Currency) =>
    formatMoney(value, result.base === 'JPY' ? 'JPY' : currency)
  const priceOf = (value: number, currency: Currency) => formatPrice(value, currency)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[1.75rem]">
          {year}年に{formatMoney(result.amount, 'JPY')}ずつ投資していたら？
        </h1>
        <p className="mt-2 text-sm text-muted">
          {formatDateJa(result.startDate)}から{formatDateJa(best.currentDate)}まで・
          {result.items.length}銘柄を比較
        </p>
      </div>

      {result.failed.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold">一部の銘柄は比較できませんでした</p>
          <ul className="mt-1 list-disc pl-5">
            {result.failed.map((f) => (
              <li key={f.ticker}>{f.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.mixedCurrency ? (
        <div className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
          <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            異なる通貨を単純比較しています（円建てとドル建てが混ざっています）。為替の影響を含めて比べたい場合は「円に換算して比較」を選んでください。
          </p>
        </div>
      ) : null}

      {/* ランキング */}
      <div>
        <h2 className="mb-3 text-base font-bold text-ink sm:text-lg">結果ランキング</h2>
        <ol className="space-y-3">
          {result.items.map((item) => (
            <li
              key={item.key}
              className="rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: colorByKey.get(item.key) }}
                >
                  {item.rank}
                </span>
                <StockAvatar ticker={item.ticker} name={item.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink">{item.name}</p>
                  <p className="text-xs text-muted">
                    {displayCode(item.ticker)}・{item.market === 'JP' ? '日本株' : '米国株'}
                  </p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-xs text-muted">
                    {moneyOf(item.invested, item.currency)} →
                  </p>
                  <p className="num text-xl text-ink sm:text-2xl">
                    {moneyOf(item.currentValue, item.currency)}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-line-soft pt-3">
                <Change
                  value={item.profit}
                  text={formatSignedMoney(
                    item.profit,
                    result.base === 'JPY' ? 'JPY' : item.currency,
                  )}
                />
                <Change value={item.returnPct} text={formatPercent(item.returnPct)} />
                {item.splitFactor !== 1 ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted">
                    <SplitIcon className="h-3.5 w-3.5" />
                    株式分割 1:{item.splitFactor} を反映
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </div>

      <SimulationNote />

      {/* 比較グラフ */}
      <Card>
        <CardTitle hint={`${formatMoney(result.amount, 'JPY')}からのスタート`}>
          資産額の推移くらべ
        </CardTitle>
        {chartData.length < 2 ? (
          <p className="py-12 text-center text-sm text-muted">
            表示できるデータがありませんでした。開始日を見直してください。
          </p>
        ) : (
          <MultiSeriesChart
            data={chartData}
            seriesList={seriesList}
            currency={displayCurrency}
            height={360}
          />
        )}
      </Card>

      {/* 比較表 */}
      <Card padding="none">
        <div className="px-5 pt-5 sm:px-6 sm:pt-6">
          <CardTitle hint="端株ありで計算">くわしい比較</CardTitle>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="px-6 py-3 font-medium">銘柄</th>
                <th className="px-3 py-3 text-right font-medium">投資額</th>
                <th className="px-3 py-3 text-right font-medium">購入価格</th>
                <th className="px-3 py-3 text-right font-medium">購入株数</th>
                <th className="px-3 py-3 text-right font-medium">現在価格</th>
                <th className="px-3 py-3 text-right font-medium">現在評価額</th>
                <th className="px-6 py-3 text-right font-medium">損益・リターン</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((item) => (
                <tr key={item.key} className="border-t border-line-soft">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2.5">
                      <span
                        aria-hidden
                        className="h-6 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: colorByKey.get(item.key) }}
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-ink">{item.name}</span>
                        <span className="block text-xs text-muted">{displayCode(item.ticker)}</span>
                      </span>
                    </div>
                  </td>
                  <td className="num px-3 py-4 text-right text-ink-soft">
                    {moneyOf(item.invested, item.currency)}
                    {result.base === 'JPY' && item.currency !== 'JPY' ? (
                      <span className="block text-xs font-normal text-faint">
                        {formatMoney(item.investedLocal, item.currency)}
                      </span>
                    ) : null}
                  </td>
                  <td className="num px-3 py-4 text-right text-ink-soft">
                    {priceOf(item.purchasePrice, item.currency)}
                  </td>
                  <td className="num px-3 py-4 text-right text-ink-soft">
                    {formatShares(Math.round(item.shares * 1000) / 1000)}
                    {item.splitFactor !== 1 ? (
                      <span className="block text-xs font-normal text-faint">
                        → 現在 {formatShares(Math.round(item.sharesNow * 1000) / 1000)}株
                      </span>
                    ) : null}
                  </td>
                  <td className="num px-3 py-4 text-right text-ink">
                    {priceOf(item.currentPrice, item.currency)}
                  </td>
                  <td className="num px-3 py-4 text-right text-ink">
                    {moneyOf(item.currentValue, item.currency)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Change
                      value={item.profit}
                      text={formatSignedMoney(
                        item.profit,
                        result.base === 'JPY' ? 'JPY' : item.currency,
                      )}
                      sub={formatPercent(item.returnPct)}
                      align="right"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 pb-5 pt-3 sm:px-6 sm:pb-6">
          <p className="text-xs leading-relaxed text-muted">
            {result.base === 'JPY'
              ? `※ 米国株は購入日の為替レートで円に換算しています（現在 1ドル = ${formatMoney(
                  result.items.find((i) => i.currency !== 'JPY')?.fxRateNow ?? 0,
                  'JPY',
                )}）。`
              : '※ それぞれの市場の通貨で同額ずつ買った場合の比較です。為替の影響は含まれません。'}
          </p>
        </div>
      </Card>

      <Card padding="md">
        <div className="flex gap-3">
          <span className="mt-0.5 text-compare">
            <InfoIcon className="h-5 w-5" />
          </span>
          <div className="text-sm leading-relaxed text-muted">
            <p className="font-semibold text-ink">指数とも比べられます</p>
            <p className="mt-1">
              入力欄に <Badge tone="neutral">^N225</Badge>（日経平均）や{' '}
              <Badge tone="neutral">QQQ</Badge>（NASDAQ100）、<Badge tone="neutral">VOO</Badge>
              （S&amp;P500）を足すと、個別銘柄が指数に勝てていたかを確認できます。
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
