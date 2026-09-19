import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { api } from '../lib/api'
import type { SymbolSearchResult } from '../lib/types'
import { Input } from './ui/Field'
import { SearchIcon } from './Icons'
import { Spinner } from './ui/States'
import { StockAvatar } from './StockAvatar'
import { cn } from './ui/cn'

/**
 * 銘柄の検索欄（候補のドロップダウン付き）。
 *
 * - 「150A」「5401」「AAPL」のようにコードそのものを打った場合は、
 *   完全一致した候補を自動で選ぶ（いつもの入力がそのまま使える）
 * - 「日本製鉄」「JSH」「Apple」のような社名は候補を出し、選んでもらう
 *
 * ユーザーは Yahoo Finance 形式（150A.T）を知らなくてよい。
 */
export function SymbolCombobox({
  value,
  onChange,
  onPick,
  id,
  placeholder = '証券コード・社名（150A / 日本製鉄 / AAPL）',
  ariaLabel,
  autoFocus,
  compact,
}: {
  value: string
  onChange: (text: string) => void
  /** 候補が選ばれた（自動選択を含む）とき。入力が変わって未選択に戻ったら null */
  onPick: (result: SymbolSearchResult | null) => void
  id?: string
  placeholder?: string
  ariaLabel?: string
  autoFocus?: boolean
  compact?: boolean
}) {
  const autoId = useId()
  const inputId = id ?? autoId
  const listId = `${inputId}-list`

  const [results, setResults] = useState<SymbolSearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [searching, setSearching] = useState(false)
  const [noMatch, setNoMatch] = useState(false)

  const pickRef = useRef(onPick)
  pickRef.current = onPick
  /** 候補を選んで入力欄を書き換えたときは、その直後の再検索をしない */
  const skipNext = useRef<string | null>(null)
  const focused = useRef(false)

  useEffect(() => {
    const q = value.trim()
    if (skipNext.current !== null && skipNext.current === value) {
      skipNext.current = null
      return
    }
    skipNext.current = null
    pickRef.current(null)
    setNoMatch(false)

    if (!q) {
      setResults([])
      setOpen(false)
      setSearching(false)
      return
    }

    const controller = new AbortController()
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const res = await api.search(q, 8, controller.signal)
        const list = res.results
        setResults(list)
        setActive(0)
        setSearching(false)
        setNoMatch(list.length === 0)

        // コード・ティッカーの完全一致（5401 / 150A / AAPL）は自動で選ぶ
        const top = list[0]
        if (top && top.exact) {
          setOpen(false)
          pickRef.current(top)
        } else {
          setOpen(focused.current && list.length > 0)
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setResults([])
        setOpen(false)
        setSearching(false)
        setNoMatch(true)
      }
    }, 300)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [value])

  const choose = (r: SymbolSearchResult) => {
    // 入力欄は短いコード（150A / AAPL）にそろえる。選んだ直後は再検索しない
    skipNext.current = r.code
    onChange(r.code)
    setOpen(false)
    setNoMatch(false)
    pickRef.current(r)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) {
      if (e.key === 'ArrowDown' && results.length > 0) {
        setOpen(true)
        e.preventDefault()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      setActive((i) => (i + 1) % results.length)
      e.preventDefault()
    } else if (e.key === 'ArrowUp') {
      setActive((i) => (i - 1 + results.length) % results.length)
      e.preventDefault()
    } else if (e.key === 'Enter') {
      choose(results[active] ?? results[0])
      e.preventDefault()
    } else if (e.key === 'Escape') {
      setOpen(false)
      e.preventDefault()
    }
  }

  return (
    <div className="relative">
      <div className="relative">
        <Input
          id={inputId}
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => {
            focused.current = true
            if (results.length > 0 && !results[0]?.exact) setOpen(true)
          }}
          onBlur={() => {
            focused.current = false
            // 候補のクリックを先に受けられるよう、少し遅らせて閉じる
            setTimeout(() => setOpen(false), 150)
          }}
          placeholder={placeholder}
          aria-label={ariaLabel}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open ? `${listId}-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          className={cn('pr-10', compact && 'h-11')}
        />
        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-faint">
          {searching ? <Spinner /> : <SearchIcon className={compact ? 'h-4 w-4' : undefined} />}
        </span>
      </div>

      {open && results.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="銘柄の候補"
          className="absolute inset-x-0 top-full z-40 mt-1.5 max-h-80 overflow-y-auto rounded-xl border border-line bg-white py-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.12)]"
        >
          {results.map((r, i) => (
            <li
              key={r.ticker}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault()
                choose(r)
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                'flex cursor-pointer items-center gap-3 px-3 py-2.5',
                i === active ? 'bg-canvas-2' : 'bg-white',
              )}
            >
              <StockAvatar ticker={r.ticker} name={r.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{r.name}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
                  <span className="num font-medium text-ink-soft">{r.code}</span>
                  <span className="text-line">|</span>
                  <span>{r.exchange}</span>
                  {r.quoteType === 'ETF' || r.quoteType === 'REIT' || r.quoteType === 'INDEX' ? (
                    <span className="rounded border border-line px-1 text-[0.625rem] leading-4">
                      {r.quoteType === 'INDEX' ? '指数' : r.quoteType}
                    </span>
                  ) : null}
                </p>
              </div>
              {/* 赤・緑は損益の意味で使っているので、市場の区別は中立色にする */}
              <span className="shrink-0 rounded-md border border-line bg-canvas-2 px-1.5 py-0.5 text-[0.6875rem] font-medium text-ink-soft">
                {r.market === 'JP' ? '日本株' : '米国株'}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {noMatch && !searching && value.trim() ? (
        <p className="mt-2 text-sm text-loss">銘柄が見つかりませんでした</p>
      ) : null}
    </div>
  )
}
