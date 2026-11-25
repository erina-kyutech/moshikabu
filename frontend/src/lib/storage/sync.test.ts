import { describe, expect, it } from 'vitest'
import { mergeById } from './sync'

/**
 * 合体でレコードが消えないことを確かめる。
 * ここが壊れると、端末とサーバーで内容が違ったときに記録を失う。
 */
describe('mergeById', () => {
  const a = { id: 'a', v: 'local' }
  const b = { id: 'b', v: 'local' }
  const c = { id: 'c', v: 'remote' }

  it('両方にしか無いものを両方とも残す', () => {
    const merged = mergeById([a, b], [c])
    expect(merged.map((x) => x.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('同じidはブラウザ内の内容を優先する', () => {
    const merged = mergeById([{ id: 'a', v: 'local' }], [{ id: 'a', v: 'remote' }])
    expect(merged).toEqual([{ id: 'a', v: 'local' }])
  })

  it('ブラウザ内が空でも、サーバーの内容がそのまま残る', () => {
    expect(mergeById([], [a, c])).toEqual([a, c])
  })

  it('サーバーが空でも、ブラウザ内の内容が消えない', () => {
    expect(mergeById([a, b], [])).toEqual([a, b])
  })

  it('重複を作らない', () => {
    const merged = mergeById([a, b], [a, b, c])
    expect(merged).toHaveLength(3)
  })
})
