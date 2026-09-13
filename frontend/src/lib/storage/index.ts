import { LocalStorageRepository } from './localStorageRepository'
import type { PortfolioRepository } from './repository'

export type { PortfolioRepository } from './repository'
export type { NewPositionInput, Position, PositionStatus, SellInput } from './types'

/**
 * アプリ全体で共有するリポジトリ。
 * Supabase へ移行する場合はここを差し替えるだけでよい。
 *   export const portfolioRepository: PortfolioRepository = new SupabaseRepository(client)
 */
export const portfolioRepository: PortfolioRepository = new LocalStorageRepository()
