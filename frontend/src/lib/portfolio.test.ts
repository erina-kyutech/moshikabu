import { describe, expect, it } from 'vitest'
import { buildPortfolioSeries, splitFactorSince, summarize, valuePosition } from './portfolio'
import type { Position } from './storage'
import type { Actions, PricePoint, Quote } from './types'
import { todayISO } from './format'

const position = (over: Partial<Position> = {}): Position => ({
  id: 'p1',
  ticker: '5401.T',
  name: '日本製鉄',
  market: 'JP',
  currency: 'JPY',
  buyDate: '2024-01-10',
  buyAt: '2024-01-10T09:00:00.000Z',
  buyPrice: 3200,
  shares: 100,
  invested: 320_000,
  status: 'open',
  schemaVersion: 1,
  ...over,
})

const quote = (price: number, previousClose?: number, over: Partial<Quote> = {}): Quote => ({
  ticker: '5401.T',
  market: 'JP',
  currency: 'JPY',
  price,
  previousClose: previousClose ?? null,
  change: null,
  changePercent: null,
  asOf: new Date().toISOString(),
  ...over,
})

const actions = (splits: Array<{ date: string; ratio: number }>): Actions => ({
  ticker: '5401.T',
  splits,
  dividends: [],
})

const fx = { usdJpy: 150 }

describe('splitFactorSince', () => {
  it('購入日より後の分割だけを掛け合わせる', () => {
    const a = actions([
      { date: '2023-06-01', ratio: 2 },
      { date: '2024-06-01', ratio: 5 },
      { date: '2025-06-01', ratio: 2 },
    ])
    expect(splitFactorSince(a, '2024-01-10')).toBe(10)
  })

  it('購入日当日の分割は終値に反映済みとして無視する', () => {
    expect(splitFactorSince(actions([{ date: '2024-01-10', ratio: 2 }]), '2024-01-10')).toBe(1)
  })

  it('売却日より後の分割は無視する', () => {
    const a = actions([{ date: '2025-01-01', ratio: 2 }])
    expect(splitFactorSince(a, '2024-01-10', '2024-12-01')).toBe(1)
  })
})

describe('valuePosition', () => {
  it('保存した購入価格と最新株価から損益を計算する', () => {
    const v = valuePosition(position(), quote(3450, 3400), undefined, fx)
    expect(v.sharesNow).toBe(100)
    expect(v.currentValue).toBe(345_000)
    expect(v.profit).toBe(25_000)
    expect(v.returnPct).toBeCloseTo(7.8125, 4)
    expect(v.dayChange).toBe(100 * 50) // 前日終値 3400 からの変化
  })

  it('購入後の分割で保有株数が増える', () => {
    const v = valuePosition(position(), quote(700), actions([{ date: '2024-10-01', ratio: 5 }]), fx)
    expect(v.splitFactor).toBe(5)
    expect(v.sharesNow).toBe(500)
    expect(v.currentValue).toBe(350_000)
    expect(v.profit).toBe(30_000)
  })

  it('米国株は円換算した値も返す', () => {
    const p = position({ ticker: 'AAPL', market: 'US', currency: 'USD', buyPrice: 170, shares: 10, invested: 1700 })
    const v = valuePosition(p, quote(176.45, 175, { ticker: 'AAPL', currency: 'USD', market: 'US' }), undefined, fx)
    expect(v.currentValue).toBeCloseTo(1764.5, 4)
    expect(v.profit).toBeCloseTo(64.5, 4)
    expect(v.currentValueBase).toBeCloseTo(1764.5 * 150, 2)
  })

  it('株価が取れない銘柄は損益を null にして落とさない', () => {
    const v = valuePosition(position(), undefined, undefined, fx)
    expect(v.isStale).toBe(true)
    expect(v.currentValue).toBeNull()
    expect(v.profit).toBeNull()
  })

  it('売却済みは売却価格で損益が確定する', () => {
    const p = position({ status: 'closed', sellDate: '2024-05-01', sellPrice: 3000, proceeds: 300_000 })
    const v = valuePosition(p, quote(9999), undefined, fx)
    expect(v.currentPrice).toBe(3000)
    expect(v.profit).toBe(-20_000)
    expect(v.dayChange).toBe(0)
  })

  it('当日購入した銘柄の「本日の変化」は購入価格基準になる', () => {
    const p = position({ buyDate: todayISO(), buyPrice: 3000, invested: 300_000 })
    const v = valuePosition(p, quote(3100, 2900), undefined, fx)
    expect(v.dayChange).toBe(10_000)
    expect(v.dayChangePercent).toBeCloseTo(3.3333, 3)
  })
})

describe('summarize', () => {
  it('複数銘柄を円換算で合計する', () => {
    const jp = valuePosition(position(), quote(3450, 3400), undefined, fx)
    const us = valuePosition(
      position({ id: 'p2', ticker: 'AAPL', market: 'US', currency: 'USD', buyPrice: 170, shares: 10, invested: 1700 }),
      quote(180, 178, { ticker: 'AAPL', currency: 'USD', market: 'US' }),
      undefined,
      fx,
    )
    const s = summarize([jp, us])
    expect(s.positionCount).toBe(2)
    expect(s.totalInvestedBase).toBeCloseTo(320_000 + 1700 * 150, 2)
    expect(s.totalValueBase).toBeCloseTo(345_000 + 1800 * 150, 2)
    expect(s.totalProfitBase).toBeCloseTo(25_000 + 100 * 150, 2)
  })

  it('売却済みは合計に含めない', () => {
    const closed = valuePosition(
      position({ status: 'closed', sellDate: '2024-05-01', sellPrice: 3000, proceeds: 300_000 }),
      undefined,
      undefined,
      fx,
    )
    expect(summarize([closed]).positionCount).toBe(0)
  })
})

describe('buildPortfolioSeries', () => {
  const points = (rows: Array<[string, number]>): PricePoint[] =>
    rows.map(([date, close]) => ({ date, close }))

  it('分割をまたいでも評価額の系列が連続する', () => {
    const p = position()
    const series = buildPortfolioSeries(
      [p],
      { '5401.T': points([['2024-01-10', 640], ['2024-09-30', 700], ['2024-10-02', 660]]) },
      { '5401.T': actions([{ date: '2024-10-01', ratio: 5 }]) },
      fx,
      undefined,
      {},
    )
    // 5倍分割後の 500株 × 分割調整後株価
    expect(series[0]).toMatchObject({ date: '2024-01-10', value: 320_000 })
    expect(series[1].value).toBe(350_000)
    expect(series[2].value).toBe(330_000)
  })

  it('購入当日で日足がまだ無くても2点以上の系列になる', () => {
    const today = todayISO()
    const p = position({ buyDate: today, buyPrice: 3200, shares: 100, invested: 320_000 })
    const series = buildPortfolioSeries([p], { '5401.T': [] }, {}, fx, undefined, {
      '5401.T': quote(3300),
    })
    expect(series.length).toBeGreaterThanOrEqual(1)
    expect(series[series.length - 1].value).toBe(330_000)
  })

  it('売却後は売却代金で横ばいになる', () => {
    const p = position({ status: 'closed', sellDate: '2024-03-01', sellPrice: 3000, proceeds: 300_000 })
    const series = buildPortfolioSeries(
      [p],
      { '5401.T': points([['2024-01-10', 3200], ['2024-03-01', 3000], ['2024-04-01', 5000]]) },
      {},
      fx,
      undefined,
      {},
    )
    expect(series.find((s) => s.date === '2024-04-01')?.value).toBe(300_000)
  })
})
