import type { PortfolioRepository } from './repository'
import type { NewPositionInput, Position, SellInput } from './types'

const STORAGE_KEY = 'moshikabu.positions.v1'
const SCHEMA_VERSION = 1

const isoDate = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

function readAll(): Position[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((p): p is Position => !!p && typeof p.id === 'string' && typeof p.ticker === 'string')
  } catch {
    // 壊れたデータでアプリを落とさない
    return []
  }
}

function writeAll(positions: Position[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(positions))
  } catch {
    /* 容量超過・プライベートモード等。保存できなくても画面は動かす */
  }
}

/** ブラウザの localStorage に保存する実装。 */
export class LocalStorageRepository implements PortfolioRepository {
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

  async list(): Promise<Position[]> {
    return readAll().sort((a, b) => (a.buyAt < b.buyAt ? 1 : -1))
  }

  async get(id: string): Promise<Position | null> {
    return readAll().find((p) => p.id === id) ?? null
  }

  async add(input: NewPositionInput): Promise<Position> {
    const at = input.at ?? new Date()
    const position: Position = {
      id: newId(),
      ticker: input.ticker,
      name: input.name,
      market: input.market,
      currency: input.currency,
      buyDate: isoDate(at),
      buyAt: at.toISOString(),
      buyPrice: input.buyPrice,
      shares: input.shares,
      invested: input.buyPrice * input.shares,
      status: 'open',
      schemaVersion: SCHEMA_VERSION,
    }
    writeAll([position, ...readAll()])
    this.emit()
    return position
  }

  async sell(id: string, input: SellInput): Promise<Position> {
    const all = readAll()
    const idx = all.findIndex((p) => p.id === id)
    if (idx < 0) throw new Error('対象の仮想保有が見つかりませんでした。')
    const at = input.at ?? new Date()
    const sold: Position = {
      ...all[idx],
      status: 'closed',
      sellDate: isoDate(at),
      sellAt: at.toISOString(),
      sellPrice: input.price,
      proceeds: input.price * all[idx].shares,
    }
    all[idx] = sold
    writeAll(all)
    this.emit()
    return sold
  }

  async remove(id: string): Promise<void> {
    writeAll(readAll().filter((p) => p.id !== id))
    this.emit()
  }

  async clear(): Promise<void> {
    writeAll([])
    this.emit()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}
