import { describe, expect, it } from 'vitest'
import {
  DayTradeError,
  applyBuy,
  applySell,
  createSession,
  maxSharesFor,
  setMemo,
  summarize,
  valuePositions,
} from './dayTrade'
import type { DayTradeSession, OrderInput } from './dayTrade'

const at = (iso: string) => new Date(iso)

const jp = (over: Partial<OrderInput> = {}): OrderInput => ({
  ticker: '150A.T',
  name: 'JSH',
  market: 'JP',
  currency: 'JPY',
  shares: 100,
  price: 600,
  fxRate: 1,
  at: at('2026-09-18T09:12:00+09:00'),
  ...over,
})

const start = (cash = 500_000): DayTradeSession => createSession(cash, at('2026-09-18T09:00:00+09:00'))

describe('仮想買い注文', () => {
  it('現金が減り、ポジションと注文履歴が増える', () => {
    const s = applyBuy(start(), jp())
    expect(s.cash).toBe(500_000 - 60_000)
    expect(s.positions).toHaveLength(1)
    expect(s.positions[0]).toMatchObject({ ticker: '150A.T', shares: 100, avgPrice: 600, costBase: 60_000 })
    expect(s.orders[0]).toMatchObject({ side: 'buy', shares: 100, price: 600, amountBase: 60_000 })
  })

  it('追加購入すると平均取得単価を計算し直す', () => {
    let s = applyBuy(start(), jp({ shares: 100, price: 600 }))
    s = applyBuy(s, jp({ shares: 100, price: 620, at: at('2026-09-18T10:00:00+09:00') }))
    expect(s.positions[0].shares).toBe(200)
    expect(s.positions[0].avgPrice).toBe(610)
    expect(s.positions[0].costBase).toBe(122_000)
    expect(s.cash).toBe(500_000 - 122_000)
  })

  it('仮想資金を超える注文は通らない', () => {
    expect(() => applyBuy(start(100_000), jp({ shares: 250, price: 600 }))).toThrow(DayTradeError)
    expect(() => applyBuy(start(100_000), jp({ shares: 250, price: 600 }))).toThrow('仮想資金が不足しています。')
  })

  it('ちょうど使い切る注文は通る', () => {
    const s = applyBuy(start(60_000), jp())
    expect(s.cash).toBe(0)
  })

  it('株数が0以下なら通らない', () => {
    expect(() => applyBuy(start(), jp({ shares: 0 }))).toThrow(DayTradeError)
  })

  it('米国株は為替で円に換算して現金から引く', () => {
    const s = applyBuy(start(1_000_000), jp({ ticker: 'NVDA', name: 'NVIDIA', market: 'US', currency: 'USD', shares: 10, price: 220, fxRate: 150 }))
    expect(s.cash).toBe(1_000_000 - 330_000) // 10株 × 220ドル × 150円
    expect(s.positions[0]).toMatchObject({ avgPrice: 220, costBase: 330_000 })
  })
})

describe('仮想売り注文', () => {
  it('実現損益を記録し、現金が戻る', () => {
    let s = applyBuy(start(), jp({ shares: 100, price: 600 }))
    s = applySell(s, jp({ shares: 100, price: 618, at: at('2026-09-18T09:47:00+09:00') }))

    expect(s.positions).toHaveLength(0)
    expect(s.cash).toBe(500_000 + 1_800)
    expect(s.realizedBase).toBe(1_800)
    expect(s.orders[0]).toMatchObject({ side: 'sell', realizedBase: 1_800 })
    expect(s.trades[0]).toMatchObject({
      buyPrice: 600,
      sellPrice: 618,
      shares: 100,
      profitBase: 1_800,
      returnPct: 3,
    })
    expect(s.trades[0].holdingMs).toBe(35 * 60 * 1000)
  })

  it('一部だけ売ると、取得原価も株数の割合で減る', () => {
    let s = applyBuy(start(), jp({ shares: 200, price: 600 }))
    s = applySell(s, jp({ shares: 50, price: 700 }))
    expect(s.positions[0].shares).toBe(150)
    expect(s.positions[0].avgPrice).toBe(600)
    expect(s.positions[0].costBase).toBe(90_000)
    expect(s.realizedBase).toBe(5_000)
  })

  it('保有株数を超える売却はできない', () => {
    const s = applyBuy(start(), jp({ shares: 100 }))
    expect(() => applySell(s, jp({ shares: 200 }))).toThrow('保有している株数を超えて売却はできません。')
  })

  it('保有していない銘柄は売れない', () => {
    expect(() => applySell(start(), jp())).toThrow('この銘柄は保有していません。')
  })

  it('米国株の実現損益も円で集計する', () => {
    let s = applyBuy(start(1_000_000), jp({ ticker: 'NVDA', name: 'NVIDIA', market: 'US', currency: 'USD', shares: 10, price: 200, fxRate: 150 }))
    s = applySell(s, jp({ ticker: 'NVDA', name: 'NVIDIA', market: 'US', currency: 'USD', shares: 10, price: 220, fxRate: 150 }))
    expect(s.realizedBase).toBe(30_000) // 10株 × 20ドル × 150円
    expect(s.trades[0].profitLocal).toBe(200)
  })
})

describe('評価と集計', () => {
  it('含み損益・実現損益・総資産を出す', () => {
    let s = applyBuy(start(500_000), jp({ shares: 100, price: 600 }))
    s = applyBuy(s, jp({ ticker: '5401.T', name: '日本製鉄', shares: 100, price: 700 }))
    s = applySell(s, jp({ ticker: '5401.T', name: '日本製鉄', shares: 100, price: 732 }))

    const values = valuePositions(s, (t) => (t === '150A.T' ? 612 : null), 150)
    const sum = summarize(s, values)

    expect(values[0]).toMatchObject({ price: 612, value: 61_200, profitBase: 1_200 })
    expect(Math.round(values[0].returnPct!)).toBe(2)
    expect(sum.realizedBase).toBe(3_200)
    expect(sum.unrealizedBase).toBe(1_200)
    expect(sum.dayProfit).toBe(4_400)
    expect(sum.cash + sum.stockValueBase).toBe(sum.totalAssets)
    expect(sum.totalAssets).toBe(500_000 + 4_400)
  })

  it('勝率などの成績を出す', () => {
    let s = start(1_000_000)
    for (const [buy, sell] of [[600, 618], [600, 590], [600, 640], [600, 580]]) {
      s = applyBuy(s, jp({ price: buy }))
      s = applySell(s, jp({ price: sell }))
    }
    const sum = summarize(s, [])
    expect(sum.tradeCount).toBe(4)
    expect(sum.wins).toBe(2)
    expect(sum.losses).toBe(2)
    expect(sum.winRate).toBe(50)
    expect(sum.grossProfit).toBe(1_800 + 4_000)
    expect(sum.grossLoss).toBe(-1_000 - 2_000)
    expect(sum.realizedBase).toBe(2_800)
  })

  it('株価が取れない銘柄があっても落ちない', () => {
    const s = applyBuy(start(), jp())
    const values = valuePositions(s, () => null, 150)
    expect(values[0].profitBase).toBeNull()
    // 取得できない分は取得原価で据え置く
    expect(summarize(s, values).stockValueBase).toBe(60_000)
  })
})

describe('その他', () => {
  it('メモを後から書き換えられる', () => {
    const s = applyBuy(start(), jp({ memo: '出来高が増えたので買った' }))
    expect(s.orders[0].memo).toBe('出来高が増えたので買った')
    const updated = setMemo(s, s.orders[0].id, '焦って買ってしまった')
    expect(updated.orders[0].memo).toBe('焦って買ってしまった')
    expect(setMemo(updated, updated.orders[0].id, '  ').orders[0].memo).toBeUndefined()
  })

  it('買える最大株数を出す', () => {
    expect(maxSharesFor(100_000, 600, 1)).toBe(166)
    expect(maxSharesFor(100_000, 220, 150)).toBe(3)
    expect(maxSharesFor(100_000, 0, 1)).toBe(0)
  })

  it('開始時は現金だけを持つ', () => {
    const s = start(300_000)
    expect(s.cash).toBe(300_000)
    expect(s.positions).toHaveLength(0)
    expect(s.watchlist.length).toBeGreaterThan(0)
    expect(() => createSession(0)).toThrow(DayTradeError)
  })
})
