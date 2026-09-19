import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageContainer, PageHeader } from '../components/PageHeader'
import { Card, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Field, Input, Select } from '../components/ui/Field'
import { Badge } from '../components/ui/Badge'
import { ErrorBlock, LoadingBlock } from '../components/ui/States'
import { StockSearchInput } from '../components/StockSearchInput'
import { Change } from '../components/Change'
import { SimulationNote } from '../components/Disclaimer'
import { CHART_COLORS, makeDateTickFormatter, makeValueTickFormatter, paddedDomain } from '../components/charts/chartUtils'
import { ArrowLeftIcon, CheckIcon, InfoIcon } from '../components/Icons'
import { api, ApiError } from '../lib/api'
import type { Quote, StrategyComparison, StrategySide } from '../lib/types'
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

const BUY_DAYS = ['1', '5', '10', '15', '20', '25', 'end'] as const

const buyDayLabel = (v: string) => (v === 'end' ? '月末' : `毎月${v}日`)

const fiveYearsAgo = () => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 5)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-01`
}

export default function StrategyCompare() {
  const [params] = useSearchParams()
  const [ticker, setTicker] = useState(params.get('ticker') ?? 'QQQ')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [start, setStart] = useState(params.get('start') ?? fiveYearsAgo())
  const [monthly, setMonthly] = useState(params.get('monthly') ?? '30000')
  const [months, setMonths] = useState(params.get('months') ?? '60')
  const [buyDay, setBuyDay] = useState(params.get('buyDay') ?? '1')

  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'done'>('idle')
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [result, setResult] = useState<StrategyComparison | null>(null)

  const onResolved = useCallback((q: Quote | null) => setQuote(q), [])

  // 積立ページから条件つきで飛んできた場合は自動で計算する
  const auto = params.get('ticker') != null
  const [autoRan, setAutoRan] = useState(false)
  useEffect(() => {
    if (auto && !autoRan && quote) {
      setAutoRan(true)
      void submit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, autoRan, quote])

  async function submit() {
    setFormError('')
    if (!quote) return setFormError('銘柄が確定していません。証券コードを入力するか、候補から銘柄を選んでください。')
    if (!start) return setFormError('開始日を入力してください。')
    if (start > todayISO()) return setFormError('開始日には過去の日付を指定してください。')
    const monthlyNum = Number(monthly)
    const monthsNum = Number(months)
    if (!Number.isFinite(monthlyNum) || monthlyNum <= 0) {
      return setFormError('毎月の積立金額は1以上の数値で入力してください。')
    }
    if (!Number.isFinite(monthsNum) || monthsNum < 1) {
      return setFormError('積立する月数は1以上で入力してください。')
    }

    setStatus('loading')
    setError('')
    try {
      const res = await api.strategy({
        ticker: quote.ticker,
        start,
        monthly: monthlyNum,
        months: Math.floor(monthsNum),
        buyDay,
        base: 'JPY',
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
        <StrategyResult result={result} />
      </PageContainer>
    )
  }

  const total = Number(monthly) * Number(months)

  return (
    <PageContainer narrow>
      <PageHeader
        title="一括投資 vs 積立投資"
        description="同じ総額を「最初にまとめて」投資した場合と、「毎月コツコツ」積み立てた場合を比べます。"
      />

      <Card padding="lg">
        <div className="space-y-6">
          <StockSearchInput value={ticker} onChange={setTicker} onResolved={onResolved} />

          <Field label="開始日" htmlFor="st-start">
            <Input
              id="st-start"
              type="date"
              value={start}
              max={todayISO()}
              min="1970-01-01"
              onChange={(e) => setStart(e.target.value)}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="毎月の積立金額" htmlFor="st-monthly">
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">
                  ¥
                </span>
                <Input
                  id="st-monthly"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1000}
                  value={monthly}
                  onChange={(e) => setMonthly(e.target.value)}
                  className="pl-8"
                />
              </div>
            </Field>
            <Field label="積立する月数" htmlFor="st-months">
              <div className="flex items-center gap-3">
                <Input
                  id="st-months"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={600}
                  step={1}
                  value={months}
                  onChange={(e) => setMonths(e.target.value)}
                />
                <span className="shrink-0 text-sm text-muted">か月</span>
              </div>
            </Field>
          </div>

          <Field label="買付日" htmlFor="st-day">
            <Select id="st-day" value={buyDay} onChange={(e) => setBuyDay(e.target.value)}>
              {BUY_DAYS.map((d) => (
                <option key={d} value={d}>
                  {buyDayLabel(d)}
                </option>
              ))}
            </Select>
          </Field>

          {Number.isFinite(total) && total > 0 ? (
            <div className="rounded-xl border border-line bg-canvas-2 px-4 py-3 text-sm text-ink-soft">
              投資総額はどちらも{' '}
              <span className="num font-semibold text-ink">{formatMoney(total, 'JPY')}</span>{' '}
              になります。
            </div>
          ) : null}

          {formError ? (
            <p className="rounded-xl border border-loss/20 bg-loss-soft px-4 py-3 text-sm text-loss">
              {formError}
            </p>
          ) : null}

          <Button size="lg" full onClick={submit} disabled={status === 'loading'}>
            {status === 'loading' ? '計算中…' : '比べてみる'}
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

function StrategyResult({ result }: { result: StrategyComparison }) {
  const c = result.baseCurrency
  const lumpWins = result.winner === 'lump'
  const diff = Math.abs(result.lump.currentValue - result.recurring.currentValue)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[1.75rem]">
          一括投資 vs 積立投資
        </h1>
        <p className="mt-2 text-sm text-muted">
          {result.name}（{displayCode(result.ticker)}）・{formatDateJa(result.startDate)}から
          {result.months}か月・投資総額 {formatMoney(result.totalInvested, c)}
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
        <p className="text-sm text-muted">この条件では</p>
        <p className="mt-1 text-lg font-bold text-ink sm:text-xl">
          {result.winner === 'tie' ? (
            'どちらもほぼ同じ結果でした'
          ) : (
            <>
              <span className={lumpWins ? 'text-brand' : 'text-recurring'}>
                {lumpWins ? '一括投資' : '積立投資'}
              </span>
              のほうが {formatMoney(diff, c)} 多くなりました
            </>
          )}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          株価が上がり続けた期間は早く全額を入れた「一括」が有利になりやすく、
          途中で大きく下がった期間は安いところも買える「積立」が有利になりやすい、という違いが出ます。
        </p>
      </div>

      {/* 2枚のカードを横並び */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StrategyCard
          side={result.lump}
          currency={c}
          localCurrency={result.currency}
          accent="brand"
          winner={lumpWins}
          detail={
            result.lump.tradeDate
              ? `${formatDateJa(result.lump.tradeDate)}に ${formatPrice(
                  result.lump.purchasePrice ?? 0,
                  result.currency,
                )} でまとめて購入`
              : undefined
          }
        />
        <StrategyCard
          side={result.recurring}
          currency={c}
          localCurrency={result.currency}
          accent="recurring"
          winner={result.winner === 'recurring'}
          detail={`${buyDayLabel(result.buyDay)}に ${formatMoney(
            result.monthlyAmount,
            c,
          )} ずつ ${result.recurring.contributions}回・平均取得単価 ${formatPrice(
            result.recurring.averagePrice ?? 0,
            result.currency,
          )}`}
        />
      </div>

      <SimulationNote />

      <Card>
        <CardTitle hint="点線が積立の元本">資産額の推移くらべ</CardTitle>
        {result.series.length < 2 ? (
          <p className="py-12 text-center text-sm text-muted">表示できるデータがありませんでした。</p>
        ) : (
          <StrategyChart result={result} />
        )}
      </Card>

      <Card padding="md">
        <div className="flex gap-3">
          <span className="mt-0.5 text-brand">
            <InfoIcon className="h-5 w-5" />
          </span>
          <div className="text-sm leading-relaxed text-muted">
            <p className="font-semibold text-ink">この結果は「この期間だったら」の話です</p>
            <p className="mt-1">
              開始日を変えると勝ち負けが入れ替わることがよくあります。いくつかの期間で試してみると、
              タイミングによる差が実感できます。
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

function StrategyCard({
  side,
  currency,
  localCurrency,
  accent,
  winner,
  detail,
}: {
  side: StrategySide
  currency: 'JPY' | 'USD'
  localCurrency: 'JPY' | 'USD'
  accent: 'brand' | 'recurring'
  winner: boolean
  detail?: string
}) {
  const ring = accent === 'brand' ? 'border-brand/30' : 'border-[color:var(--color-recurring)]/30'
  const chip = accent === 'brand' ? 'brand' : 'warn'
  return (
    <div
      className={`rounded-2xl border bg-white p-5 shadow-card sm:p-6 ${
        winner ? ring : 'border-line'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-bold text-ink">{side.label}</h3>
        {winner ? (
          <Badge tone={chip as 'brand' | 'warn'}>
            <CheckIcon className="h-3 w-3" /> こちらが多い
          </Badge>
        ) : null}
      </div>

      <p className="mt-4 text-xs text-muted">現在評価額</p>
      <p className="num text-3xl leading-tight text-ink">{formatMoney(side.currentValue, currency)}</p>

      <dl className="mt-4 space-y-2 border-t border-line-soft pt-4 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted">投資元本</dt>
          <dd className="num text-ink">{formatMoney(side.invested, currency)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted">損益</dt>
          <dd>
            <Change
              value={side.profit}
              text={formatSignedMoney(side.profit, currency)}
              sub={formatPercent(side.returnPct)}
              align="right"
            />
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted">保有株数</dt>
          <dd className="num text-ink">
            {formatShares(Math.round(side.sharesNow * 1000) / 1000)}株
          </dd>
        </div>
      </dl>

      {detail ? (
        <p className="mt-4 text-xs leading-relaxed text-muted">
          {detail}
          {localCurrency !== currency ? '（現地通貨表示）' : ''}
        </p>
      ) : null}
    </div>
  )
}

function StrategyChart({ result }: { result: StrategyComparison }) {
  const c = result.baseCurrency
  const dates = result.series.map((d) => d.date)
  const tickX = makeDateTickFormatter(dates)
  const tickY = makeValueTickFormatter(c)
  const domain = paddedDomain(result.series.flatMap((d) => [d.lump, d.recurring, d.principal]))

  return (
    <>
      <div style={{ width: '100%', height: 340 }}>
        <ResponsiveContainer>
          <LineChart data={result.series} margin={{ top: 12, right: 16, bottom: 4, left: 4 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={tickX}
              tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
              axisLine={{ stroke: CHART_COLORS.grid }}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              domain={domain}
              tickFormatter={tickY}
              tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={58}
            />
            <Tooltip
              cursor={{ stroke: CHART_COLORS.grid, strokeWidth: 2 }}
              content={(props) => {
                const { active, payload, label } = props as {
                  active?: boolean
                  payload?: readonly { dataKey?: unknown; value?: unknown }[]
                  label?: string
                }
                if (!active || !payload?.length) return null
                const pick = (k: string) => {
                  const hit = payload.find((e) => String(e.dataKey) === k)
                  return hit ? Number(hit.value) : null
                }
                const rows: Array<[string, number | null, string]> = [
                  ['一括投資', pick('lump'), CHART_COLORS.line],
                  ['積立投資', pick('recurring'), '#EA580C'],
                  ['積立の元本', pick('principal'), CHART_COLORS.axis],
                ]
                return (
                  <div className="min-w-44 rounded-xl border border-line bg-white px-3 py-2 shadow-card">
                    <p className="mb-1 text-xs text-muted">{formatDateSlash(String(label ?? ''))}</p>
                    {rows.map(([name, value, color]) =>
                      value == null ? null : (
                        <p key={name} className="flex items-center justify-between gap-4 text-sm">
                          <span className="flex items-center gap-1.5 text-ink">
                            <span
                              className="inline-block h-0.5 w-3 rounded"
                              style={{ backgroundColor: color }}
                            />
                            {name}
                          </span>
                          <span className="num text-ink">{formatMoney(value, c)}</span>
                        </p>
                      ),
                    )}
                  </div>
                )
              }}
            />
            <Line
              type="monotone"
              dataKey="lump"
              name="一括投資"
              stroke={CHART_COLORS.line}
              strokeWidth={2.4}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="recurring"
              name="積立投資"
              stroke="#EA580C"
              strokeWidth={2.4}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="principal"
              name="積立の元本"
              stroke={CHART_COLORS.axis}
              strokeWidth={1.4}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 rounded" style={{ backgroundColor: CHART_COLORS.line }} />
          一括投資
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 rounded" style={{ backgroundColor: '#EA580C' }} />
          積立投資
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-0 w-5 border-t border-dashed"
            style={{ borderColor: CHART_COLORS.axis }}
          />
          積立の元本
        </span>
      </div>
    </>
  )
}
