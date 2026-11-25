/**
 * 記録のサーバー同期。
 *
 * 方針:
 *   - 画面が読み書きするのは今まで通りブラウザ内の保存（速い・オフラインでも動く）
 *   - サーバーは「消えたときに取り戻すための控え」として、変更のたびに丸ごと送る
 *   - 同期に失敗しても、ブラウザ内の記録には一切手を触れない
 *
 * 起動時は、ブラウザとサーバーの内容を**idで突き合わせて合体**する。
 * どちらか片方を丸ごと採用すると、端末が違ったときに記録が消えてしまうため。
 */
import { api } from '../api'
import type { SavedRule } from '../screener'
import { bookLink, currentBookId, markSynced, setBookId } from './book'
import { dayTradeRepository } from './dayTradeRepository'
import { portfolioRepository } from './index'
import { ruleRepository } from './rules'
import type { Position } from './types'

export type SyncState = 'idle' | 'syncing' | 'synced' | 'offline' | 'disabled'

export interface SyncStatus {
  state: SyncState
  bookId: string | null
  link: string | null
  syncedAt: string | null
  message: string
}

let status: SyncStatus = {
  state: 'idle',
  bookId: null,
  link: null,
  syncedAt: null,
  message: '',
}
const listeners = new Set<(s: SyncStatus) => void>()
let pushTimer: ReturnType<typeof setTimeout> | null = null
let started = false

function update(patch: Partial<SyncStatus>): void {
  status = { ...status, ...patch }
  for (const l of listeners) l(status)
}

export function syncStatus(): SyncStatus {
  return status
}

export function subscribeSync(listener: (s: SyncStatus) => void): () => void {
  listeners.add(listener)
  listener(status)
  return () => listeners.delete(listener)
}

/** ブラウザ内の記録をまとめて取り出す */
async function collectLocal() {
  const [positions, session] = await Promise.all([
    portfolioRepository.list(),
    dayTradeRepository.load(),
  ])
  return { positions, rules: ruleRepository.list(), dayTrade: session }
}

/** id で突き合わせて合体する（同じidはブラウザ内の内容を優先） */
export function mergeById<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const byId = new Map<string, T>()
  for (const item of remote) byId.set(item.id, item)
  for (const item of local) byId.set(item.id, item)
  return [...byId.values()]
}

/** サーバーの内容をブラウザ側へ取り込む */
async function adopt(positions: Position[], rules: SavedRule[], dayTrade: unknown): Promise<void> {
  await portfolioRepository.replaceAll(positions)
  ruleRepository.replaceAll(rules)
  if (dayTrade) await dayTradeRepository.save(dayTrade as never)
}

/** いまのブラウザ内の記録をサーバーへ送る */
async function push(bookId: string): Promise<void> {
  const local = await collectLocal()
  const saved = await api.putBook(bookId, {
    positions: local.positions,
    rules: local.rules,
    dayTrade: local.dayTrade,
  })
  markSynced(saved.updatedAt)
  update({ state: 'synced', syncedAt: saved.updatedAt, message: '' })
}

/** 連続した変更をまとめて1回だけ送る */
function schedulePush(): void {
  const bookId = currentBookId()
  if (!bookId) return
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    pushTimer = null
    update({ state: 'syncing' })
    push(bookId).catch(() => {
      update({
        state: 'offline',
        message: '記録の控えを保存できませんでした。この端末には保存されています。',
      })
    })
  }, 800)
}

/**
 * 同期を開始する。
 * アプリ起動時に1度だけ呼ぶ。
 */
export async function startSync(): Promise<void> {
  if (started) return
  started = true

  // 変更があればサーバーへ送る
  portfolioRepository.subscribe(schedulePush)
  ruleRepository.subscribe(schedulePush)
  dayTradeRepository.subscribe(schedulePush)

  let bookId = currentBookId()
  update({ state: 'syncing', bookId, link: bookId ? bookLink(bookId) : null })

  try {
    if (!bookId) {
      // 記録がすでにある場合も含め、新しいIDを発行して控えを作る
      const created = await api.createBook()
      bookId = created.id
      setBookId(bookId)
      update({ state: 'syncing', bookId, link: bookLink(bookId) })
      await push(bookId)
      return
    }

    update({ state: 'syncing', bookId, link: bookLink(bookId) })

    const [remote, local] = await Promise.all([api.getBook(bookId), collectLocal()])
    const positions = mergeById(local.positions, remote.positions as Position[])
    const rules = mergeById(local.rules, remote.rules as SavedRule[])
    const dayTrade = local.dayTrade ?? remote.dayTrade

    const changed =
      positions.length !== local.positions.length ||
      rules.length !== local.rules.length ||
      (!local.dayTrade && !!remote.dayTrade)
    if (changed) await adopt(positions, rules, dayTrade)

    await push(bookId)
  } catch (e) {
    // サーバーに繋がらなくても、ブラウザ内の記録はそのまま使える
    update({
      state: 'offline',
      bookId,
      link: bookId ? bookLink(bookId) : null,
      message: '記録の控えに接続できませんでした。この端末には保存されています。',
    })
  }
}

/**
 * 別の記録IDに切り替えて取り込む（別端末からの復元）。
 * ブラウザ内の記録は消さず、取り込んだ内容と合体させる。
 */
export async function restoreBook(id: string): Promise<{ positions: number; rules: number }> {
  const trimmed = id.trim()
  if (!trimmed) throw new Error('記録IDを入力してください。')

  const remote = await api.getBook(trimmed)
  const local = await collectLocal()
  const positions = mergeById(local.positions, remote.positions as Position[])
  const rules = mergeById(local.rules, remote.rules as SavedRule[])
  await adopt(positions, rules, local.dayTrade ?? remote.dayTrade)

  setBookId(trimmed)
  update({ state: 'syncing', bookId: trimmed, link: bookLink(trimmed) })
  await push(trimmed)
  return { positions: positions.length, rules: rules.length }
}
