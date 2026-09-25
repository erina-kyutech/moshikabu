/**
 * マイルール（保存した投資条件）と、画面をまたいで持ち回る下書きの保存。
 *
 * 仮想ポートフォリオと同じく、保存の実装だけを差し替えれば別の保存先へ移せる。
 */
import type { BacktestResponse, SavedRule, ScreenerCondition, ScreenResponse } from '../screener'

const RULES_KEY = 'moshikabu.rules.v1'
const DRAFT_KEY = 'moshikabu.screener.draft.v1'
const RESULT_KEY = 'moshikabu.screener.result.v1'
const BACKTEST_KEY = 'moshikabu.backtest.result.v1'

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

function read<T>(key: string, storage: Storage = localStorage): T | null {
  try {
    const raw = storage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    // 壊れたデータでアプリを落とさない
    return null
  }
}

function write(key: string, value: unknown, storage: Storage = localStorage): void {
  try {
    storage.setItem(key, JSON.stringify(value))
  } catch {
    /* 容量超過・プライベートモードでも画面は動かす */
  }
}

export interface RuleRepository {
  list(): SavedRule[]
  get(id: string): SavedRule | null
  save(name: string, conditions: ScreenerCondition[], universe: string): SavedRule
  remove(id: string): void
  subscribe(listener: () => void): () => void
}

class LocalRuleRepository implements RuleRepository {
  private listeners = new Set<() => void>()

  list(): SavedRule[] {
    const rules = read<SavedRule[]>(RULES_KEY) ?? []
    return Array.isArray(rules) ? rules : []
  }

  get(id: string): SavedRule | null {
    return this.list().find((r) => r.id === id) ?? null
  }

  save(name: string, conditions: ScreenerCondition[], universe: string): SavedRule {
    const rule: SavedRule = {
      id: newId(),
      name: name.trim() || '名前のないルール',
      conditions,
      universe,
      createdAt: new Date().toISOString(),
    }
    write(RULES_KEY, [rule, ...this.list()])
    this.emit()
    return rule
  }

  remove(id: string): void {
    write(RULES_KEY, this.list().filter((r) => r.id !== id))
    this.emit()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit() {
    for (const l of this.listeners) l()
  }
}

export const ruleRepository: RuleRepository = new LocalRuleRepository()

// ------------------------------------------------ 画面をまたいで持ち回るもの
export interface ScreenerDraft {
  conditions: ScreenerCondition[]
  universe: string
  ruleName?: string
}

export const draftStore = {
  load: (): ScreenerDraft | null => read<ScreenerDraft>(DRAFT_KEY),
  save: (draft: ScreenerDraft) => write(DRAFT_KEY, draft),
}

/** 検索結果とバックテスト結果は一時的なものなので sessionStorage に置く。 */
export const resultStore = {
  load: (): ScreenResponse | null => read<ScreenResponse>(RESULT_KEY, sessionStorage),
  save: (result: ScreenResponse) => write(RESULT_KEY, result, sessionStorage),
}

export const backtestStore = {
  load: (): BacktestResponse | null => read<BacktestResponse>(BACKTEST_KEY, sessionStorage),
  save: (result: BacktestResponse) => write(BACKTEST_KEY, result, sessionStorage),
}
