import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ScreenerLayout } from '../components/screener/ScreenerLayout'
import { Card, CardTitle } from '../components/ui/Card'
import { ButtonLink } from '../components/ui/Button'
import { UnderlineTabs } from '../components/ui/Segmented'
import { ErrorBlock, LoadingBlock } from '../components/ui/States'
import { QuoteStats } from '../components/QuoteStats'
import { ChartPanel } from '../components/ChartPanel'
import { MetricCard } from '../components/MetricCard'
import { ArrowLeftIcon, CheckIcon, CloseIcon, InfoIcon } from '../components/Icons'
import { api, ApiError } from '../lib/api'
import { useQuote } from '../hooks/useQuotes'
import type { FundamentalsResponse, MetricDef, ScreenerCatalog, ScreenRow } from '../lib/screener'
import { draftStore, resultStore } from '../lib/storage/rules'
import { formatMetric } from '../lib/format'
import { cn } from '../components/ui/cn'

type Tab = 'overview' | 'chart' | 'financials' | 'conditions'

export default function ScreenerStock() {
  const { ticker = '' } = useParams<{ ticker: string }>()
  const [tab, setTab] = useState<Tab>('overview')
  const [catalog, setCatalog] = useState<ScreenerCatalog | null>(null)
  const [data, setData] = useState<FundamentalsResponse | null>(null)
  const [error, setError] = useState('')
  const { quote } = useQuote(ticker || null, { live: false })

  useEffect(() => {
    api.screenerCatalog().then(setCatalog).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!ticker) return
    setError('')
    setData(null)
    api
      .fundamentals(ticker)
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : '財務データを取得できませんでした。'))
  }, [ticker])

  const metricById = useMemo(
    () => new Map((catalog?.metrics ?? []).map((m) => [m.id, m])),
    [catalog],
  )

  /** 検索結果に残っている、この銘柄の条件判定 */
  const screened: ScreenRow | null = useMemo(() => {
    const result = resultStore.load()
    return result?.rows.find((r) => r.ticker === ticker) ?? null
  }, [ticker])

  const conditions = screened?.checks ?? draftStore.load()?.conditions.map((c) => ({
    metric: c.metric,
    operator: c.operator,
    threshold: c.value,
    actual: data?.values[c.metric] ?? null,
    passed: false,
  })) ?? []

  // 検索結果に無い銘柄は、いまの数値で条件を判定し直す
  const checks = useMemo(
    () =>
      conditions.map((c) => {
        const actual = data?.values[c.metric] ?? c.actual ?? null
        const passed =
          actual == null
            ? false
            : c.operator === '<='
              ? actual <= c.threshold
              : c.operator === '>='
                ? actual >= c.threshold
                : c.operator === '<'
                  ? actual < c.threshold
                  : c.operator === '>'
                    ? actual > c.threshold
                    : Math.abs(actual - c.threshold) < 1e-9
        return { ...c, actual, passed }
      }),
    [conditions, data],
  )
  const passedCount = checks.filter((c) => c.passed).length

  if (error) {
    return (
      <ScreenerLayout title="銘柄詳細">
        <ErrorBlock message={error} />
      </ScreenerLayout>
    )
  }

  if (!data) {
    return (
      <ScreenerLayout title="銘柄詳細">
        <LoadingBlock message="財務データを読み込み中…" />
      </ScreenerLayout>
    )
  }

  return (
    <ScreenerLayout
      title={data.name}
      description={`${data.code} ・ ${data.exchange ?? (data.market === 'JP' ? '日本株' : '米国株')}`}
      action={
        <ButtonLink to="/screener/results" variant="secondary">
          <ArrowLeftIcon className="h-4 w-4" />
          検索結果に戻る
        </ButtonLink>
      }
    >
      {quote ? (
        <Card padding="md" className="mb-5">
          <QuoteStats quote={quote} exchange={data.exchange} />
        </Card>
      ) : null}

      <UnderlineTabs
        ariaLabel="銘柄詳細のタブ"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'overview', label: '概要' },
          { value: 'chart', label: 'チャート' },
          { value: 'financials', label: '財務' },
          { value: 'conditions', label: '条件適合' },
        ]}
      />

      {tab === 'overview' ? (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {['pbr', 'per', 'roe', 'marketCap'].map((id) => (
              <MetricCard
                key={id}
                label={metricById.get(id)?.label ?? id}
                value={formatMetric(data.values[id], metricById.get(id))}
              />
            ))}
          </div>
          <Card>
            <CardTitle hint={`${passedCount}/${checks.length} 条件を満たしています`}>
              設定した条件との状況
            </CardTitle>
            {checks.length === 0 ? (
              <p className="text-sm text-muted">
                条件が設定されていません。
                <Link to="/screener" className="ml-1 text-brand hover:underline">
                  条件から銘柄を探す
                </Link>
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {checks.map((c) => (
                  <ConditionItem key={c.metric} check={c} metric={metricById.get(c.metric)} />
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : null}

      {tab === 'chart' ? (
        <Card className="mt-6" padding="md">
          <ChartPanel
            ticker={data.ticker}
            currency={data.currency}
            defaultRange="1y"
            defaultType="line"
            height={340}
            live={false}
          />
        </Card>
      ) : null}

      {tab === 'financials' ? (
        <Card className="mt-6">
          <CardTitle hint={`${data.asOf} 時点`}>財務指標</CardTitle>
          {catalog ? (
            <div className="space-y-6">
              {Object.entries(catalog.categories).map(([key, label]) => {
                const items = catalog.metrics.filter((m) => m.category === key)
                if (items.length === 0) return null
                return (
                  <div key={key}>
                    <h3 className="mb-2 text-sm font-bold text-ink">{label}</h3>
                    <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                      {items.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-baseline justify-between gap-3 border-b border-line-soft pb-2"
                        >
                          <dt className="text-sm text-muted">{m.label}</dt>
                          <dd
                            className={cn(
                              'num text-sm',
                              data.values[m.id] == null ? 'text-faint' : 'text-ink',
                            )}
                          >
                            {data.values[m.id] == null ? 'データなし' : formatMetric(data.values[m.id], m)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )
              })}
            </div>
          ) : (
            <LoadingBlock />
          )}
        </Card>
      ) : null}

      {tab === 'conditions' ? (
        <Card className="mt-6">
          <CardTitle hint={`${passedCount}/${checks.length} 条件を満たしています`}>条件適合</CardTitle>
          {checks.length === 0 ? (
            <p className="text-sm text-muted">条件が設定されていません。</p>
          ) : (
            <ul className="space-y-2.5">
              {checks.map((c) => (
                <ConditionItem key={c.metric} check={c} metric={metricById.get(c.metric)} detailed />
              ))}
            </ul>
          )}
          <p className="mt-5 text-xs leading-relaxed text-muted">
            ※ 条件に一致しているかを示すものであり、値上がりを示すものではありません。
          </p>
        </Card>
      ) : null}

      <Card padding="md" className="mt-6">
        <div className="flex gap-3">
          <span className="mt-0.5 text-brand">
            <InfoIcon className="h-5 w-5" />
          </span>
          <p className="text-xs leading-relaxed text-muted">
            取得できなかった指標は「データなし」と表示しています。値を推定して埋めることはしていません。
          </p>
        </div>
      </Card>
    </ScreenerLayout>
  )
}

function ConditionItem({
  check,
  metric,
  detailed,
}: {
  check: { metric: string; operator: string; threshold: number; actual?: number | null; passed: boolean }
  metric?: MetricDef
  detailed?: boolean
}) {
  const opLabel =
    check.operator === '<=' ? '以下' : check.operator === '>=' ? '以上' : check.operator
  return (
    <li
      className={cn(
        'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm',
        check.passed ? 'border-gain/20 bg-gain-soft' : 'border-line bg-canvas-2',
      )}
    >
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
          check.passed ? 'bg-gain text-white' : 'bg-line text-muted',
        )}
      >
        {check.passed ? <CheckIcon className="h-3 w-3" /> : <CloseIcon className="h-3 w-3" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block font-medium', check.passed ? 'text-gain' : 'text-ink')}>
          {metric?.label ?? check.metric} {check.threshold}
          {metric?.unit} {opLabel}
        </span>
        {detailed ? (
          <span className="mt-0.5 block text-xs text-muted">
            条件：{opLabel === '以下' ? '≤' : opLabel === '以上' ? '≥' : check.operator} {check.threshold}
            {metric?.unit} ／ 実績：
            {check.actual == null ? 'データなし' : formatMetric(check.actual, metric)}
          </span>
        ) : null}
      </span>
      {!detailed ? (
        <span className="num shrink-0 text-sm text-ink">
          {check.actual == null ? 'データなし' : formatMetric(check.actual, metric)}
        </span>
      ) : null}
    </li>
  )
}
