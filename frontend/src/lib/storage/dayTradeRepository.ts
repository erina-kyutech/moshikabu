import type { DayTradeSession } from './dayTrade'

const STORAGE_KEY = 'moshikabu.daytrade.v1'

/**
 * デイトレ練習の保存先。
 * 仮想ポートフォリオと同じく、実装を差し替えれば Supabase 等へ移せる。
 */
export interface DayTradeRepository {
  load(): Promise<DayTradeSession | null>
  save(session: DayTradeSession): Promise<void>
  clear(): Promise<void>
  subscribe(listener: () => void): () => void
}

export class LocalDayTradeRepository implements DayTradeRepository {
  private listeners = new Set<() => void>()

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) this.emit()
      })
    }
  }

  private emit() {
    for (const l of this.listeners) l()
  }

  async load(): Promise<DayTradeSession | null> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as DayTradeSession
      if (!parsed || typeof parsed.cash !== 'number' || !Array.isArray(parsed.positions)) return null
      return parsed
    } catch {
      // 壊れたデータでアプリを落とさない
      return null
    }
  }

  async save(session: DayTradeSession): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    } catch {
      /* 容量超過やプライベートモードでも画面は動かす */
    }
    this.emit()
  }

  async clear(): Promise<void> {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* noop */
    }
    this.emit()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}

export const dayTradeRepository: DayTradeRepository = new LocalDayTradeRepository()
