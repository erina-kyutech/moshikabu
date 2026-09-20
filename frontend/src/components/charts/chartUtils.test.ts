import { describe, expect, it } from 'vitest'
import { candleGeometry, makeValueTickFormatter, paddedDomain, seriesColor } from './chartUtils'

describe('ローソク足の描画位置', () => {
  // 高値100・安値0 を 0〜200px に割り当てる（価格1 = 2px、上が高値）
  const box = { y: 0, height: 200 }

  it('陽線は始値が下・終値が上になる', () => {
    const g = candleGeometry(box.y, box.height, { o: 20, h: 100, l: 0, c: 80 })
    expect(g.up).toBe(true)
    expect(g.yOpen).toBe(160) // (100-20)/100*200
    expect(g.yClose).toBe(40) // (100-80)/100*200
    expect(g.bodyTop).toBe(40)
    expect(g.bodyHeight).toBe(120)
  })

  it('陰線は始値が上・終値が下になる', () => {
    const g = candleGeometry(box.y, box.height, { o: 80, h: 100, l: 0, c: 20 })
    expect(g.up).toBe(false)
    expect(g.bodyTop).toBe(40)
    expect(g.bodyHeight).toBe(120)
  })

  it('始値と終値が同じでも1pxの線として描く', () => {
    const g = candleGeometry(box.y, box.height, { o: 50, h: 100, l: 0, c: 50 })
    expect(g.bodyHeight).toBe(1)
    expect(g.up).toBe(true)
  })

  it('高値と安値が同じ（値動きなし）でも落ちない', () => {
    const g = candleGeometry(box.y, box.height, { o: 50, h: 50, l: 50, c: 50 })
    expect(g.bodyTop).toBe(100)
    expect(g.bodyHeight).toBe(1)
  })

  it('チャートの途中（yがずれた位置）でも正しく収まる', () => {
    const g = candleGeometry(60, 100, { o: 10, h: 20, l: 10, c: 20 })
    expect(g.yClose).toBe(60) // 高値=終値 なので上端
    expect(g.yOpen).toBe(160) // 安値=始値 なので下端
    expect(g.bodyTop).toBe(60)
    expect(g.bodyHeight).toBe(100)
  })
})

describe('軸と色', () => {
  it('円は万・億でまとめる', () => {
    const f = makeValueTickFormatter('JPY')
    expect(f(1_500_000)).toBe('150万')
    expect(f(250_000_000)).toBe('2.5億')
    expect(f(800)).toBe('800')
  })

  it('ドルは k / M でまとめる', () => {
    const f = makeValueTickFormatter('USD')
    expect(f(2_500)).toBe('2.5k')
    expect(f(3_000_000)).toBe('3.0M')
  })

  it('値の範囲に少し余白を持たせる', () => {
    const [min, max] = paddedDomain([100, 200])
    expect(min).toBeLessThan(100)
    expect(max).toBeGreaterThan(200)
    expect(paddedDomain([])).toEqual([0, 1])
  })

  it('系列の色は巡回する', () => {
    expect(seriesColor(0)).toBe(seriesColor(10))
    expect(seriesColor(0)).not.toBe(seriesColor(1))
  })
})
