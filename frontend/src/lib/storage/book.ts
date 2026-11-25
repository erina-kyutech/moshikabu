/**
 * 記録ID（ブックID）の管理。
 *
 * ブラウザの保存領域は消えることがある。
 * とくに iOS Safari は「7日間サイトを開かないと保存データを削除する」ため、
 * 記録をサーバーにも置き、このIDで取り戻せるようにする。
 *
 * IDはURL（?book=...）にも載せる。
 * ブックマークやホーム画面に追加しておけば、端末の保存領域が消えても
 * そのリンクから同じ記録に戻れるため。
 */
const BOOK_KEY = 'moshikabu.book.v1'
const URL_PARAM = 'book'

export interface BookRef {
  id: string
  /** 最後にサーバーと同期できた時刻（ISO） */
  syncedAt?: string
}

function read(): BookRef | null {
  try {
    const raw = localStorage.getItem(BOOK_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as BookRef
    return parsed && typeof parsed.id === 'string' ? parsed : null
  } catch {
    return null
  }
}

function write(ref: BookRef | null): void {
  try {
    if (ref) localStorage.setItem(BOOK_KEY, JSON.stringify(ref))
    else localStorage.removeItem(BOOK_KEY)
  } catch {
    /* プライベートモード等でも画面は動かす */
  }
}

/** URL に ?book=... が付いていれば、それを優先して取り込む */
function fromUrl(): string | null {
  try {
    const value = new URL(window.location.href).searchParams.get(URL_PARAM)
    return value && value.trim() ? value.trim() : null
  } catch {
    return null
  }
}

/** いまの記録IDを返す（URL > 保存済み の順） */
export function currentBookId(): string | null {
  const fromLink = fromUrl()
  if (fromLink) {
    const saved = read()
    if (!saved || saved.id !== fromLink) write({ id: fromLink })
    return fromLink
  }
  return read()?.id ?? null
}

export function bookRef(): BookRef | null {
  const id = currentBookId()
  return id ? { ...(read() ?? { id }), id } : null
}

export function setBookId(id: string): void {
  write({ id })
  putIdInUrl(id)
}

export function markSynced(at: string = new Date().toISOString()): void {
  const ref = read()
  if (ref) write({ ...ref, syncedAt: at })
}

export function forgetBook(): void {
  write(null)
  removeIdFromUrl()
}

/** 現在のURLに記録IDを載せる（履歴は増やさない） */
export function putIdInUrl(id: string): void {
  try {
    const url = new URL(window.location.href)
    if (url.searchParams.get(URL_PARAM) === id) return
    url.searchParams.set(URL_PARAM, id)
    window.history.replaceState({}, '', url.toString())
  } catch {
    /* 失敗しても動作に影響しない */
  }
}

function removeIdFromUrl(): void {
  try {
    const url = new URL(window.location.href)
    url.searchParams.delete(URL_PARAM)
    window.history.replaceState({}, '', url.toString())
  } catch {
    /* noop */
  }
}

/** ブックマーク用のリンク（記録IDつき） */
export function bookLink(id: string): string {
  try {
    const url = new URL(window.location.origin)
    url.searchParams.set(URL_PARAM, id)
    return url.toString()
  } catch {
    return `${window.location.origin}/?${URL_PARAM}=${id}`
  }
}
