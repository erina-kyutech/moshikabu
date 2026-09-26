import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ScreenerLayout } from '../components/screener/ScreenerLayout'
import { Card } from '../components/ui/Card'
import { Button, ButtonLink } from '../components/ui/Button'
import { Segmented } from '../components/ui/Segmented'
import { EmptyState } from '../components/ui/States'
import { Change } from '../components/Change'
import { StockAvatar } from '../components/StockAvatar'
import { CheckIcon, InfoIcon, SearchIcon } from '../components/Icons'
import { api, ApiError } from '../lib/api'
import type {
  ConditionStat,
  MetricDef,
  ScreenerCondition,
  ScreenResponse,
  ScreenRow,
} from '../lib/screener'
import { draftStore, resultStore } from '../lib/storage/rules'
import { formatMetric, formatPercent, formatPrice, formatSignedMoney } from '../lib/format'
import { cn } from '../components/ui/cn'

type MarketFilter = 'all' | 'JP' | 'US'

/** 表に出す指標（条件に使われたものを先に、残りは代表的なものを並べる） */
const BASE_COLUMNS = ['pbr', 'per', 'revenueGrowth', 'operatingIncomeGrowth', 'roe', 'marketCap']

export default function ScreenerResults() {
  const navigate = useNavigate()
  const [result, setResult] = useState<ScreenResponse | null>(null)
  const [metrics, setMetrics] = useState<Map<string, MetricDef>>(new Map())
  const [market, setMarket] = useState<MarketFilter>('all')
  const [sortBy, setSortBy] = useState('marketCap')
  const [desc, setDesc] = useState(true)

  useEffect(() => {
    setResult(resultStore.load())
    api
      .screenerCatalog()
      .then((c) => setMetrics(new Map(c.metrics.map((m) => [m.id, m]))))
      .catch(() => undefined)
  }, [])

  /** 検索に使った条件。0件のときは rows が空なので conditionStats から取る */
  const usedConditions = useMemo<ScreenerCondition[]>(() => {
    if (!result) return []
    const stats = result.conditionStats ?? []
    if (stats.length > 0) {
      return stats.map((st) => ({
        metric: st.metric,
        operator: st.operator as ScreenerCondition['operator'],
        value: st.threshold,
      }))
    }
    return (result.rows[0]?.checks ?? []).map((c) => ({
      metric: c.metric,
      operator: c.operator as ScreenerCondition['operator'],
      value: c.threshold,
    }))
  }, [result])

  const conditionMetrics = useMemo(() => usedConditions.map((c) => c.metric), [usedConditions])
  const columns = useMemo(() => {
    const seen = new Set<string>()
    return [...conditionMetrics, ...BASE_COLUMNS].filter((m) => !seen.has(m) && seen.add(m))
  }, [conditionMetrics])

  const rows = useMemo(() => {
    if (!result) return []
    const filtered = result.rows.filter((r) => market === 'all' || r.market === market)
    return [...filtered].sort((a, b) => {
      const av = sortBy === 'price' ? (a.price ?? 0) : (a.values[sortBy] ?? Number.NEGATIVE_INFINITY)
      const bv = sortBy === 'price' ? (b.price ?? 0) : (b.values[sortBy] ?? Number.NEGATIVE_INFINITY)
      return desc ? bv - av : av - bv
    })
  }, [result, market, sortBy, desc])

  if (!result) {
    return (
      <ScreenerLayout title="検索結果">
        <EmptyState
          icon={<SearchIcon className="h-6 w-6" />}
          title="まだ検索していません"
          description="条件を設定して検索すると、ここに一致した銘柄が表示されます。"
          action={
            <ButtonLink to="/screener" variant="primary" size="lg">
              条件を設定する
            </ButtonLink>
          }
        />
      </ScreenerLayout>
    )
  }

  const jpCount = result.rows.filter((r) => r.market === 'JP').length
  const usCount = result.rows.length - jpCount

  return (
    <ScreenerLayout
      title="検索結果"
      description={`設定した条件をすべて満たす銘柄が ${result.matchedCount} 件見つかりました。`}
      action={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate('/screener')}>
            条件を編集する
          </Button>
          <Button onClick={() => navigate('/backtest')}>このルールを過去で検証</Button>
        </div>
      }
    >
      {/* 条件のおさらい */}
      <Card padding="md" className="mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-ink-soft">設定した条件</span>
          {usedConditions.map((c) => {
            const m = metrics.get(c.metric)
            return (
              <span
                key={c.metric}
                className="inline-flex items-center gap-1 rounded-lg border border-line bg-canvas-2 px-2.5 py-1 text-xs text-ink"
              >
                {m?.label ?? c.metric} {c.value}
                {m?.unit} {c.operator === '<=' ? '以下' : c.operator === '>=' ? '以上' : c.operator}
              </span>
            )
          })}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          {result.universeLabel}の{result.scanned}銘柄を調べ、一致 {result.matchedCount}件 / 不一致{' '}
          {result.rejectedCount}件
          {result.excludedCount > 0 ? ` / データ不足で判定できず ${result.excludedCount}件` : ''}
        </p>
        {result.excludedCount > 0 ? (
          <ul className="mt-1.5 space-y-0.5 text-xs text-faint">
            {Object.entries(result.excludedReasons).map(([reason, count]) => (
              <li key={reason}>・{reason}：{count}件</li>
            ))}
          </ul>
        ) : null}
      </Card>

      {result.rows.length === 0 ? (
        <NoMatches
          result={result}
          metrics={metrics}
          conditions={usedConditions}
          onResult={setResult}
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Segmented
              ariaLabel="市場で絞り込む"
              value={market}
              onChange={setMarket}
              options={[
                { value: 'all', label: `すべて (${result.rows.length})` },
                { value: 'JP', label: `日本株 (${jpCount})` },
                { value: 'US', label: `米国株 (${usCount})` },
              ]}
            />
            <div className="flex items-center gap-2">
              <label htmlFor="sort" className="text-xs text-muted">
                並び替え
              </label>
              <select
                id="sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="focus-ring h-9 rounded-lg border border-line bg-white px-2 text-sm text-ink"
              >
                {columns.map((id) => (
                  <option key={id} value={id}>
                    {metrics.get(id)?.label ?? id}
                  </option>
                ))}
                <option value="price">株価</option>
              </select>
              <button
                type="button"
                onClick={() => setDesc((v) => !v)}
                className="focus-ring h-9 rounded-lg border border-line bg-white px-2.5 text-sm text-muted hover:text-ink"
              >
                {desc ? '降順 ↓' : '昇順 ↑'}
              </button>
            </div>
          </div>

          {/* PC: 表 */}
          <Card padding="none" className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[58rem] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="px-6 py-3 font-medium">銘柄</th>
                    <th className="px-3 py-3 text-right font-medium">現在株価</th>
                    {columns.map((id) => (
                      <th key={id} className="px-3 py-3 text-right font-medium">
                        {metrics.get(id)?.label ?? id}
                      </th>
                    ))}
                    <th className="px-6 py-3 text-right font-medium">アクション</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.ticker} className="border-t border-line-soft">
                      <td className="px-6 py-4">
                        <Link
                          to={`/screener/stock/${encodeURIComponent(row.ticker)}`}
                          className="focus-ring flex items-center gap-3 rounded-lg"
                        >
                          <StockAvatar ticker={row.ticker} name={row.name} size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-ink">{row.name}</span>
                            <span className="block text-xs text-muted">
                              {row.code} ・ {row.exchange ?? (row.market === 'JP' ? '日本株' : '米国株')}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-4 text-right">
                        <span className="num block text-ink">
                          {row.price != null ? formatPrice(row.price, row.currency) : '—'}
                        </span>
                        {row.change != null ? (
                          <Change
                            value={row.change}
                            text={formatSignedMoney(row.change, row.currency)}
                            sub={formatPercent(row.changePercent)}
                            size="sm"
                            align="right"
                          />
                        ) : null}
                      </td>
                      {columns.map((id) => (
                        <MetricCell key={id} row={row} metricId={id} metric={metrics.get(id)} />
                      ))}
                      <td className="px-6 py-4 text-right">
                        <ButtonLink
                          to={`/screener/stock/${encodeURIComponent(row.ticker)}`}
                          variant="secondary"
                          className="h-9 px-3 text-xs"
                        >
                          詳細
                        </ButtonLink>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* スマホ: カード */}
          <ul className="space-y-3 md:hidden">
            {rows.map((row) => (
              <li key={row.ticker}>
                <Card padding="md">
                  <Link
                    to={`/screener/stock/${encodeURIComponent(row.ticker)}`}
                    className="focus-ring flex items-center gap-3 rounded-lg"
                  >
                    <StockAvatar ticker={row.ticker} name={row.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">{row.name}</span>
                      <span className="block text-xs text-muted">
                        {row.code} ・ {row.exchange ?? ''}
                      </span>
                    </span>
                    <span className="num text-right text-ink">
                      {row.price != null ? formatPrice(row.price, row.currency) : '—'}
                    </span>
                  </Link>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-line-soft pt-3 text-sm">
                    {columns.map((id) => {
                      const passed = row.checks.find((c) => c.metric === id)?.passed
                      return (
                        <div key={id} className="flex items-center justify-between gap-2">
                          <dt className="text-xs text-muted">{metrics.get(id)?.label ?? id}</dt>
                          <dd
                            className={cn(
                              'num inline-flex items-center gap-1 text-sm',
                              passed ? 'text-gain' : 'text-ink',
                            )}
                          >
                            {passed ? <CheckIcon className="h-3 w-3" /> : null}
                            {formatMetric(row.values[id], metrics.get(id))}
                          </dd>
                        </div>
                      )
                    })}
                  </dl>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      <Card padding="md" className="mt-6">
        <div className="flex gap-3">
          <span className="mt-0.5 text-brand">
            <InfoIcon className="h-5 w-5" />
          </span>
          <ul className="space-y-1 text-xs leading-relaxed text-muted">
            {result.notes.map((n) => (
              <li key={n}>・{n}</li>
            ))}
          </ul>
        </div>
      </Card>
    </ScreenerLayout>
  )
}

/**
 * 0件だったときに「なぜ0件なのか」を示す。
 * 条件を1つずつ外して数えた通過数を出し、どれが効いているのかを分かるようにする。
 */
function NoMatches({
  result,
  metrics,
  conditions,
  onResult,
}: {
  result: ScreenResponse
  metrics: Map<string, MetricDef>
  conditions: ScreenerCondition[]
  onResult: (next: ScreenResponse) => void
}) {
  const [widening, setWidening] = useState('')
  const [error, setError] = useState('')
  const stats = result.conditionStats ?? []
  const tightest = stats.length > 0 ? [...stats].sort((a, b) => a.passed - b.passed)[0] : null

  /** 同じ条件のまま、対象にする銘柄だけを広げてその場で検索し直す */
  const widen = async (universe: string) => {
    setError('')
    setWidening(universe)
    try {
      const next = await api.screenerSearch({ conditions, universe })
      resultStore.save(next)
      draftStore.save({ conditions, universe })
      onResult(next)
      window.scrollTo({ top: 0 })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '検索できませんでした。')
    } finally {
      setWidening('')
    }
  }

  return (
    <Card padding="lg">
      <div className="mx-auto max-w-xl text-center">
        <h2 className="text-lg font-bold text-ink">条件に一致する銘柄はありませんでした</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {result.universeLabel}の{result.scanned}銘柄を調べました。
          {tightest
            ? `「${metrics.get(tightest.metric)?.label ?? tightest.metric}」の条件が最も厳しく、${tightest.passed}銘柄しか満たしていません。`
            : '条件をゆるめるか、対象にする銘柄を広げてお試しください。'}
        </p>
      </div>

      {stats.length > 0 ? (
        <div className="mx-auto mt-6 max-w-xl">
          <p className="mb-2 text-xs font-medium text-ink-soft">
            条件を1つずつだけで見たときに、満たしていた銘柄数
          </p>
          <ul className="space-y-2">
            {stats.map((st) => (
              <StatBar key={st.metric} stat={st} metric={metrics.get(st.metric)} />
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-faint">
            ※ すべてを同時に満たす銘柄が無かった、ということです。
            数字の少ない条件をゆるめると見つかりやすくなります。
          </p>
        </div>
      ) : null}

      <div className="mx-auto mt-6 flex max-w-xl flex-wrap justify-center gap-2">
        <ButtonLink to="/screener" variant="primary">
          条件を編集する
        </ButtonLink>
        {result.universe !== 'jp-large' ? (
          <Button variant="secondary" disabled={!!widening} onClick={() => widen('jp-large')}>
            {widening === 'jp-large' ? '検索中…' : '対象を日本株99銘柄に広げて再検索'}
          </Button>
        ) : null}
        {result.universe !== 'jp-mid' ? (
          <Button variant="secondary" disabled={!!widening} onClick={() => widen('jp-mid')}>
            {widening === 'jp-mid' ? '検索中…（1分ほどかかります）' : '中型株492銘柄まで広げて再検索'}
          </Button>
        ) : null}
      </div>

      {error ? (
        <p className="mx-auto mt-4 max-w-xl rounded-xl border border-loss/20 bg-loss-soft px-4 py-3 text-center text-sm text-loss">
          {error}
        </p>
      ) : null}
    </Card>
  )
}

function StatBar({ stat, metric }: { stat: ConditionStat; metric?: MetricDef }) {
  const ratio = stat.evaluated > 0 ? stat.passed / stat.evaluated : 0
  const opLabel =
    stat.operator === '<=' ? '以下' : stat.operator === '>=' ? '以上' : stat.operator
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate text-ink">
          {metric?.label ?? stat.metric} {stat.threshold}
          {metric?.unit} {opLabel}
        </span>
        <span className="num shrink-0 text-ink-soft">
          {stat.passed} / {stat.evaluated}銘柄
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line-soft">
        <div
          className={cn('h-full rounded-full', stat.passed === 0 ? 'bg-loss' : 'bg-brand')}
          style={{ width: `${Math.max(ratio * 100, stat.passed > 0 ? 3 : 0)}%` }}
        />
      </div>
    </li>
  )
}

function MetricCell({
  row,
  metricId,
  metric,
}: {
  row: ScreenRow
  metricId: string
  metric?: MetricDef
}) {
  const check = row.checks.find((c) => c.metric === metricId)
  return (
    <td className="px-3 py-4 text-right">
      <span
        className={cn(
          'num inline-flex items-center justify-end gap-1',
          check?.passed ? 'text-gain' : 'text-ink',
        )}
      >
        {check?.passed ? <CheckIcon className="h-3.5 w-3.5" aria-label="条件を満たしています" /> : null}
        {formatMetric(row.values[metricId], metric)}
      </span>
    </td>
  )
}
