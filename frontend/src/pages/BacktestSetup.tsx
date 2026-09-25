import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScreenerLayout } from '../components/screener/ScreenerLayout'
import { Card, CardTitle } from '../components/ui/Card'
import { Button, ButtonLink } from '../components/ui/Button'
import { Field, Input, Select } from '../components/ui/Field'
import { ErrorBlock, LoadingBlock } from '../components/ui/States'
import { InfoIcon } from '../components/Icons'
import { api, ApiError } from '../lib/api'
import type { SavedRule, ScreenerCatalog, ScreenerCondition } from '../lib/screener'
import { backtestStore, draftStore, ruleRepository } from '../lib/storage/rules'
import { formatCondition, formatMoney, todayISO } from '../lib/format'

const MONTHS = [1, 4, 7, 10]

export default function BacktestSetup() {
  const navigate = useNavigate()
  const [catalog, setCatalog] = useState<ScreenerCatalog | null>(null)
  const [rules, setRules] = useState<SavedRule[]>([])
  const [ruleId, setRuleId] = useState('draft')
  const [conditions, setConditions] = useState<ScreenerCondition[]>([])
  const [ruleName, setRuleName] = useState('現在の条件')
  const [universe, setUniverse] = useState('jp-core30')

  const [startDate, setStartDate] = useState('2024-04-01')
  const [endDate, setEndDate] = useState(todayISO())
  const [screeningMonth, setScreeningMonth] = useState(4)
  const [holdingPeriod, setHoldingPeriod] = useState(12)
  const [initialCapital, setInitialCapital] = useState('10000000')
  const [benchmark, setBenchmark] = useState('TOPIX')

  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.screenerCatalog().then(setCatalog).catch(() => undefined)
    setRules(ruleRepository.list())
    const draft = draftStore.load()
    if (draft) {
      setConditions(draft.conditions)
      setUniverse(draft.universe || 'jp-core30')
    }
  }, [])

  const metricById = useMemo(
    () => new Map((catalog?.metrics ?? []).map((m) => [m.id, m])),
    [catalog],
  )

  /** 過去時点を再現できない指標が混ざっていたら、検証前に知らせる */
  const unusable = useMemo(
    () => conditions.filter((c) => metricById.get(c.metric)?.historical === false),
    [conditions, metricById],
  )

  const selectRule = (id: string) => {
    setRuleId(id)
    if (id === 'draft') {
      const draft = draftStore.load()
      setConditions(draft?.conditions ?? [])
      setUniverse(draft?.universe ?? 'jp-core30')
      setRuleName('現在の条件')
      return
    }
    const rule = rules.find((r) => r.id === id)
    if (rule) {
      setConditions(rule.conditions)
      setUniverse(rule.universe || 'jp-core30')
      setRuleName(rule.name)
    }
  }

  const run = async () => {
    setError('')
    if (conditions.length === 0) {
      setError('検証する条件がありません。まず条件を作ってください。')
      return
    }
    if (unusable.length > 0) {
      setError(
        `「${unusable
          .map((c) => metricById.get(c.metric)?.label ?? c.metric)
          .join('・')}」は過去時点の値を再現できないため、検証には使えません。条件から外してください。`,
      )
      return
    }
    const capital = Number(initialCapital)
    if (!Number.isFinite(capital) || capital <= 0) {
      setError('初期資金は1以上の数値で入力してください。')
      return
    }
    if (startDate >= endDate) {
      setError('検証終了日は開始日より後にしてください。')
      return
    }

    setRunning(true)
    try {
      const result = await api.runBacktest({
        conditions,
        startDate,
        endDate,
        screeningMonth,
        holdingPeriod,
        initialCapital: capital,
        benchmark,
        universe,
        ruleName,
      })
      backtestStore.save(result)
      navigate('/backtest/result')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'バックテストを実行できませんでした。')
    } finally {
      setRunning(false)
    }
  }

  if (!catalog) {
    return (
      <ScreenerLayout title="ルールを過去で検証">
        <LoadingBlock message="読み込み中…" />
      </ScreenerLayout>
    )
  }

  const universeDef = catalog.universes.find((u) => u.id === universe)

  return (
    <ScreenerLayout
      title="ルールを過去で検証"
      description="作成した投資ルールを過去のデータで検証します。銘柄の抽出には、その時点で公表済みだった決算だけを使います。"
      action={
        <ButtonLink to="/screener" variant="secondary">
          条件を編集する
        </ButtonLink>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card padding="lg">
          <CardTitle>バックテストの設定</CardTitle>

          <div className="space-y-6">
            <Field label="使用するルール" htmlFor="rule">
              <Select id="rule" value={ruleId} onChange={(e) => selectRule(e.target.value)}>
                <option value="draft">現在の条件（スクリーナーで作成中）</option>
                {rules.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="rounded-xl border border-brand/15 bg-brand-soft p-4">
              <p className="text-sm font-bold text-brand">{ruleName}</p>
              {conditions.length === 0 ? (
                <p className="mt-1 text-xs text-brand/80">条件がありません。</p>
              ) : (
                <p className="mt-1 text-xs leading-relaxed text-brand/90">
                  {conditions
                    .map((c) =>
                      formatCondition(metricById.get(c.metric), c.operator, c.value, catalog.operators),
                    )
                    .join(' ／ ')}
                </p>
              )}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="検証開始日" htmlFor="start">
                <Input
                  id="start"
                  type="date"
                  value={startDate}
                  max={todayISO()}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </Field>
              <Field label="検証終了日" htmlFor="end">
                <Input
                  id="end"
                  type="date"
                  value={endDate}
                  max={todayISO()}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </Field>
            </div>

            <Field
              label="銘柄を抽出する月"
              htmlFor="month"
              hint="毎年この月の1日時点で、条件を満たしていた銘柄を抽出します。"
            >
              <Select
                id="month"
                value={screeningMonth}
                onChange={(e) => setScreeningMonth(Number(e.target.value))}
              >
                {MONTHS.map((m) => (
                  <option key={m} value={m}>
                    毎年{m}月1日
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="保有期間">
              <div className="flex flex-wrap gap-2">
                {catalog.holdingPeriods.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setHoldingPeriod(m)}
                    aria-pressed={holdingPeriod === m}
                    className={`focus-ring rounded-xl border px-4 py-2 text-sm font-medium transition ${
                      holdingPeriod === m
                        ? 'border-brand bg-brand-soft text-brand'
                        : 'border-line bg-white text-muted hover:text-ink'
                    }`}
                  >
                    {m === 12 ? '1年' : `${m}か月`}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="初期資金" htmlFor="capital">
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">
                  ¥
                </span>
                <Input
                  id="capital"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={100000}
                  value={initialCapital}
                  onChange={(e) => setInitialCapital(e.target.value)}
                  className="pl-8"
                />
              </div>
            </Field>

            <Field label="投資方法" hint="該当した銘柄へ均等に投資します（端株あり）。">
              <Input value="該当銘柄へ均等投資" readOnly disabled />
            </Field>

            <Field label="対象にする銘柄" htmlFor="bt-universe" hint={universeDef?.description}>
              <Select id="bt-universe" value={universe} onChange={(e) => setUniverse(e.target.value)}>
                {catalog.universes.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="ベンチマーク" htmlFor="benchmark">
              <Select id="benchmark" value={benchmark} onChange={(e) => setBenchmark(e.target.value)}>
                {catalog.benchmarks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </Select>
            </Field>

            {error ? (
              <p className="rounded-xl border border-loss/20 bg-loss-soft px-4 py-3 text-sm text-loss">
                {error}
              </p>
            ) : null}

            <Button size="lg" full onClick={run} disabled={running}>
              {running ? '検証中…（1分ほどかかることがあります）' : '▶ バックテスト開始'}
            </Button>
          </div>
        </Card>

        <div className="space-y-6">
          <Card padding="md">
            <CardTitle>検証のしかた</CardTitle>
            <ol className="space-y-2 text-xs leading-relaxed text-muted">
              <li>1. 毎年決めた月に、その時点で公表済みだった決算で銘柄を絞り込みます</li>
              <li>2. そのとき持っている資金を、該当した銘柄へ均等に投資します</li>
              <li>3. 保有期間が過ぎたら全部売って現金に戻します</li>
              <li>4. 次の抽出日まで現金のまま持ち、また 1 に戻ります</li>
            </ol>
            <p className="mt-3 border-t border-line-soft pt-3 text-xs leading-relaxed text-muted">
              株価は分割調整後の値を使い、米国株はその日の為替で円に換算します。
            </p>
          </Card>

          <Card padding="md">
            <div className="flex gap-3">
              <span className="mt-0.5 text-brand">
                <InfoIcon className="h-5 w-5" />
              </span>
              <div className="text-xs leading-relaxed text-muted">
                <p className="font-semibold text-ink">データの制約</p>
                <ul className="mt-1.5 space-y-1.5">
                  {catalog.dataNotes.map((n) => (
                    <li key={n}>・{n}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          {unusable.length > 0 ? (
            <ErrorBlock
              title="検証に使えない条件があります"
              message={`${unusable
                .map((c) => metricById.get(c.metric)?.label ?? c.metric)
                .join('・')} は過去時点の値を再現できません。条件から外してください。`}
            />
          ) : null}

          <p className="text-xs leading-relaxed text-faint">
            初期資金 {formatMoney(Number(initialCapital) || 0, 'JPY')} で、
            {startDate} 〜 {endDate} の期間を検証します。
          </p>
        </div>
      </div>
    </ScreenerLayout>
  )
}
