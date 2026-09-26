import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScreenerLayout } from '../components/screener/ScreenerLayout'
import { Card, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Field, Input, Select } from '../components/ui/Field'
import { Badge } from '../components/ui/Badge'
import { ErrorBlock, LoadingBlock } from '../components/ui/States'
import { CloseIcon, InfoIcon, SearchIcon, TrashIcon } from '../components/Icons'
import { api, ApiError } from '../lib/api'
import type { ScreenerCatalog, ScreenerCondition, SavedRule } from '../lib/screener'
import { draftStore, resultStore, ruleRepository } from '../lib/storage/rules'
import { formatCondition } from '../lib/format'

/** 初期表示の条件。既定の母集団（31銘柄）でも結果が出る、ゆるめの組み合わせにしている */
const DEFAULT_CONDITIONS: ScreenerCondition[] = [
  { metric: 'pbr', operator: '<=', value: 1.5 },
  { metric: 'roe', operator: '>=', value: 8 },
]

export default function Screener() {
  const navigate = useNavigate()
  const [catalog, setCatalog] = useState<ScreenerCatalog | null>(null)
  const [catalogError, setCatalogError] = useState('')
  const [conditions, setConditions] = useState<ScreenerCondition[]>(DEFAULT_CONDITIONS)
  const [universe, setUniverse] = useState('jp-core30')
  const [rules, setRules] = useState<SavedRule[]>([])
  const [ruleName, setRuleName] = useState('')
  const [saving, setSaving] = useState(false)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .screenerCatalog()
      .then(setCatalog)
      .catch((e) =>
        setCatalogError(e instanceof ApiError ? e.message : '指標の一覧を取得できませんでした。'),
      )
    const draft = draftStore.load()
    if (draft?.conditions?.length) {
      setConditions(draft.conditions)
      setUniverse(draft.universe || 'jp-core30')
    }
    setRules(ruleRepository.list())
    return ruleRepository.subscribe(() => setRules(ruleRepository.list()))
  }, [])

  useEffect(() => {
    draftStore.save({ conditions, universe })
  }, [conditions, universe])

  const metricById = useMemo(
    () => new Map((catalog?.metrics ?? []).map((m) => [m.id, m])),
    [catalog],
  )
  const universeDef = catalog?.universes.find((u) => u.id === universe)

  const setCondition = (index: number, patch: Partial<ScreenerCondition>) =>
    setConditions((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)))

  const addCondition = () => {
    const used = new Set(conditions.map((c) => c.metric))
    const next = catalog?.metrics.find((m) => !used.has(m.id)) ?? catalog?.metrics[0]
    if (next) setConditions((prev) => [...prev, { metric: next.id, operator: '>=', value: 0 }])
  }

  const search = async () => {
    setError('')
    if (conditions.length === 0) {
      setError('条件を1つ以上追加してください。')
      return
    }
    setSearching(true)
    try {
      const result = await api.screenerSearch({ conditions, universe })
      resultStore.save(result)
      navigate('/screener/results')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '検索できませんでした。')
    } finally {
      setSearching(false)
    }
  }

  const saveRule = () => {
    const name = ruleName.trim()
    if (!name) {
      setError('マイルールの名前を入力してください。')
      return
    }
    ruleRepository.save(name, conditions, universe)
    setRuleName('')
    setSaving(false)
    setError('')
  }

  const applyConditions = (next: ScreenerCondition[], nextUniverse?: string) => {
    setConditions(next)
    if (nextUniverse) setUniverse(nextUniverse)
    window.scrollTo({ top: 0 })
  }

  if (catalogError) {
    return (
      <ScreenerLayout title="条件から銘柄を探す">
        <ErrorBlock message={catalogError} onRetry={() => window.location.reload()} />
      </ScreenerLayout>
    )
  }

  if (!catalog) {
    return (
      <ScreenerLayout title="条件から銘柄を探す">
        <LoadingBlock message="指標の一覧を読み込み中…" />
      </ScreenerLayout>
    )
  }

  return (
    <ScreenerLayout
      title="条件から銘柄を探す"
      description="財務指標や成長率などの条件を組み合わせて、自分の投資ルールに合う銘柄を探せます。条件に一致する銘柄を表示するもので、値上がりを予測するものではありません。"
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        {/* 条件入力 */}
        <Card padding="lg">
          <CardTitle hint="すべての条件を満たす銘柄を探します（AND）">検索条件</CardTitle>

          <ul className="space-y-3">
            {conditions.map((condition, index) => {
              const metric = metricById.get(condition.metric)
              return (
                <li
                  key={index}
                  className="flex flex-col gap-2 rounded-xl border border-line bg-canvas-2 p-3 sm:grid sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-3"
                >
                  <Select
                    aria-label={`条件${index + 1}の指標`}
                    value={condition.metric}
                    onChange={(e) => setCondition(index, { metric: e.target.value })}
                  >
                    {Object.entries(catalog.categories).map(([key, label]) => (
                      <optgroup key={key} label={label}>
                        {catalog.metrics
                          .filter((m) => m.category === key)
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.label}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </Select>

                  {/* スマホ: 2行目にまとめる ／ PC: グリッドの2〜4列目に戻す */}
                  <div className="flex items-center gap-2 sm:contents">
                  <div className="w-[6.25rem] shrink-0 sm:w-auto">
                    <Select
                      aria-label={`条件${index + 1}の比較`}
                      value={condition.operator}
                      onChange={(e) =>
                        setCondition(index, {
                          operator: e.target.value as ScreenerCondition['operator'],
                        })
                      }
                    >
                      {Object.entries(catalog.operators).map(([op, label]) => (
                        <option key={op} value={op}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Input
                      aria-label={`条件${index + 1}の数値`}
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={condition.value}
                      onChange={(e) => setCondition(index, { value: Number(e.target.value) })}
                    />
                    <span className="shrink-0 text-sm text-muted sm:w-10">{metric?.unit}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setConditions((prev) => prev.filter((_, i) => i !== index))}
                    aria-label={`条件${index + 1}を削除`}
                    className="focus-ring shrink-0 rounded-lg p-2 text-faint transition hover:bg-white hover:text-loss"
                  >
                    <CloseIcon className="h-4 w-4" />
                  </button>
                  </div>
                </li>
              )
            })}
          </ul>

          {conditions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
              条件がありません。「条件を追加」から作ってください。
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={addCondition} className="h-10 px-3 text-sm">
              ＋ 条件を追加
            </Button>
            <span className="text-xs text-muted">条件はすべて満たす（AND）で検索します</span>
          </div>

          <div className="mt-6 border-t border-line-soft pt-6">
            <Field
              label="対象にする銘柄"
              htmlFor="universe"
              hint={
                universeDef?.slow
                  ? `${universeDef.description}。初回の検索は1分ほどかかることがあります。`
                  : universeDef?.description
              }
            >
              <Select id="universe" value={universe} onChange={(e) => setUniverse(e.target.value)}>
                {catalog.universes.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {error ? (
            <p className="mt-5 rounded-xl border border-loss/20 bg-loss-soft px-4 py-3 text-sm text-loss">
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" full onClick={search} disabled={searching}>
              <SearchIcon className="h-4 w-4" />
              {searching ? '検索中…' : 'この条件で銘柄を探す'}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              full
              onClick={() => navigate('/backtest')}
              disabled={conditions.length === 0}
            >
              このルールを過去で検証
            </Button>
          </div>
        </Card>

        {/* テンプレートとマイルール */}
        <div className="space-y-6">
          <Card padding="md">
            <CardTitle hint="条件の例です">条件テンプレート</CardTitle>
            <ul className="space-y-2.5">
              {catalog.templates.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => applyConditions(t.conditions)}
                    className="focus-ring w-full rounded-xl border border-line bg-white p-3 text-left transition hover:border-brand/30 hover:bg-canvas-2"
                  >
                    <p className="text-sm font-semibold text-ink">{t.name}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      {t.conditions
                        .map((c) =>
                          formatCondition(metricById.get(c.metric), c.operator, c.value, catalog.operators),
                        )
                        .join(' / ')}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-faint">
              テンプレートはおすすめ銘柄ではなく、検索条件の組み合わせ例です。
            </p>
          </Card>

          <Card padding="md">
            <CardTitle hint={`${rules.length}件`}>マイルール</CardTitle>
            {rules.length === 0 ? (
              <p className="text-sm text-muted">
                いまの条件に名前を付けて保存すると、あとから呼び出せます。
              </p>
            ) : (
              <ul className="space-y-2">
                {rules.map((rule) => (
                  <li
                    key={rule.id}
                    className="flex items-center gap-2 rounded-xl border border-line bg-white p-2.5"
                  >
                    <button
                      type="button"
                      onClick={() => applyConditions(rule.conditions, rule.universe)}
                      className="focus-ring min-w-0 flex-1 rounded-lg text-left"
                    >
                      <p className="truncate text-sm font-semibold text-ink">{rule.name}</p>
                      <p className="truncate text-xs text-muted">{rule.conditions.length}条件</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => ruleRepository.remove(rule.id)}
                      aria-label={`${rule.name} を削除`}
                      className="focus-ring rounded-lg p-1.5 text-faint transition hover:text-loss"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {saving ? (
              <div className="mt-3 space-y-2">
                <Input
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="成長割安株"
                  aria-label="マイルールの名前"
                  className="h-11"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button full onClick={saveRule} className="h-10 text-sm">
                    保存
                  </Button>
                  <Button variant="secondary" full onClick={() => setSaving(false)} className="h-10 text-sm">
                    やめる
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="secondary"
                full
                className="mt-3 h-10 text-sm"
                onClick={() => setSaving(true)}
                disabled={conditions.length === 0}
              >
                マイルールとして保存
              </Button>
            )}
          </Card>

          <Card padding="md">
            <div className="flex gap-3">
              <span className="mt-0.5 text-brand">
                <InfoIcon className="h-5 w-5" />
              </span>
              <div className="text-xs leading-relaxed text-muted">
                <p className="font-semibold text-ink">データについて</p>
                <ul className="mt-1.5 space-y-1.5">
                  {catalog.dataNotes.map((note) => (
                    <li key={note}>・{note}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          <div className="flex flex-wrap gap-1.5">
            {catalog.metrics
              .filter((m) => !m.historical)
              .map((m) => (
                <Badge key={m.id} tone="warn">
                  {m.label} は検証に使えません
                </Badge>
              ))}
          </div>
        </div>
      </div>
    </ScreenerLayout>
  )
}
