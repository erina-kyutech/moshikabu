import { useState } from 'react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Field, Input } from '../ui/Field'
import { formatMoney } from '../../lib/format'
import { cn } from '../ui/cn'

const PRESETS = [100_000, 500_000, 1_000_000]

/** デイトレ練習の開始画面。仮想資金を決める。 */
export function CashSetup({ onStart }: { onStart: (cash: number) => void }) {
  const [selected, setSelected] = useState<number | 'custom'>(500_000)
  const [custom, setCustom] = useState('300000')
  const [error, setError] = useState('')

  const amount = selected === 'custom' ? Number(custom) : selected

  const start = () => {
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('仮想資金は1円以上で入力してください。')
      return
    }
    onStart(Math.floor(amount))
  }

  return (
    <Card padding="lg">
      <h2 className="text-lg font-bold text-ink">仮想資金を決めてスタート</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        実際のお金は使いません。決めた金額の範囲で売買の練習ができます。
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {PRESETS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setSelected(v)}
            aria-pressed={selected === v}
            className={cn(
              'focus-ring rounded-xl border p-4 text-center transition',
              selected === v
                ? 'border-brand bg-brand-soft text-brand'
                : 'border-line bg-white text-ink hover:bg-canvas-2',
            )}
          >
            <span className="num text-lg font-semibold">{formatMoney(v, 'JPY')}</span>
          </button>
        ))}
      </div>

      <div className="mt-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
          <input
            type="radio"
            name="cash-mode"
            checked={selected === 'custom'}
            onChange={() => setSelected('custom')}
            className="h-4 w-4 accent-[#2563eb] focus-ring"
          />
          金額を自分で決める
        </label>
        {selected === 'custom' ? (
          <div className="mt-3">
            <Field label="仮想資金" htmlFor="custom-cash">
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">
                  ¥
                </span>
                <Input
                  id="custom-cash"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={10000}
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  className="pl-8"
                />
              </div>
            </Field>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-loss/20 bg-loss-soft px-4 py-3 text-sm text-loss">
          {error}
        </p>
      ) : null}

      <Button size="lg" full className="mt-6" onClick={start}>
        練習を始める
      </Button>
    </Card>
  )
}
