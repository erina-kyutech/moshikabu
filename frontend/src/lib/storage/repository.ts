import type { NewPositionInput, Position, SellInput } from './types'

/**
 * 仮想ポートフォリオの永続化インターフェース。
 *
 * 現在は localStorage 実装のみだが、Supabase 等へ移行する際は
 * このインターフェースを満たす実装を追加して差し替えるだけでよい。
 * すべて Promise を返すため、非同期バックエンドへの移行でUIの変更は不要。
 */
export interface PortfolioRepository {
  list(): Promise<Position[]>
  get(id: string): Promise<Position | null>
  add(input: NewPositionInput): Promise<Position>
  sell(id: string, input: SellInput): Promise<Position>
  remove(id: string): Promise<void>
  clear(): Promise<void>
  /** 変更通知（同一タブ・別タブ両方）。解除関数を返す。 */
  subscribe(listener: () => void): () => void
}
