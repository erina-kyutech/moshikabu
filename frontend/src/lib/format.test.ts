import { describe, expect, it } from 'vitest'
import {
  displayCode,
  formatDateJa,
  formatHoldingPeriod,
  formatMoney,
  formatPercent,
  formatPrice,
  formatShares,
  formatSignedMoney,
} from './format'

describe('金額表示', () => {
  it('日本株は円・整数', () => {
    expect(formatMoney(320000, 'JPY')).toBe('¥320,000')
    expect(formatMoney(-5320, 'JPY')).toBe('-¥5,320')
  })

  it('米国株はドル・小数2桁', () => {
    expect(formatMoney(2540.324, 'USD')).toBe('$2,540.32')
    expect(formatMoney(1700, 'USD')).toBe('$1,700.00')
  })

  it('損益は必ず符号を付ける', () => {
    expect(formatSignedMoney(80000, 'JPY')).toBe('+¥80,000')
    expect(formatSignedMoney(-4300, 'JPY')).toBe('-¥4,300')
    expect(formatSignedMoney(0, 'JPY')).toBe('±¥0')
  })

  it('株価は低位株だけ小数を残す', () => {
    expect(formatPrice(3100, 'JPY')).toBe('¥3,100')
    expect(formatPrice(68.4, 'JPY')).toBe('¥68.4')
    expect(formatPrice(176.453, 'USD')).toBe('$176.45')
  })

  it('欠損値でも落ちない', () => {
    expect(formatMoney(null, 'JPY')).toBe('—')
    expect(formatPrice(undefined, 'USD')).toBe('—')
    expect(formatPercent(null)).toBe('—')
  })
})

describe('その他の表示', () => {
  it('パーセントは符号付き2桁', () => {
    expect(formatPercent(34.7826)).toBe('+34.78%')
    expect(formatPercent(-1.8)).toBe('-1.80%')
    expect(formatPercent(3.27, false)).toBe('3.27%')
  })

  it('株数は整数ならカンマ区切り', () => {
    expect(formatShares(1000)).toBe('1,000')
    expect(formatShares(2.5)).toBe('2.5')
  })

  it('日付を日本語表記にする', () => {
    expect(formatDateJa('2023-01-10')).toBe('2023年1月10日')
  })

  it('保有期間を人が読める形にする', () => {
    expect(formatHoldingPeriod('2024-01-01', '2024-01-15')).toBe('14日')
    expect(formatHoldingPeriod('2024-01-01', '2024-05-01')).toBe('4か月')
    expect(formatHoldingPeriod('2023-01-01', '2024-03-01')).toBe('1年2か月')
  })
})

describe('銘柄コードの表示', () => {
  it('Yahoo Finance 用の .T は画面に出さない', () => {
    expect(displayCode('150A.T')).toBe('150A')
    expect(displayCode('5401.T')).toBe('5401')
    expect(displayCode('AAPL')).toBe('AAPL')
    expect(displayCode('^N225')).toBe('^N225')
  })
})
