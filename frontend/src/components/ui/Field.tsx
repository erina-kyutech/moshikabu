import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { cn } from './cn'

const control =
  'h-12 w-full rounded-xl border border-line bg-white px-3.5 text-[0.9375rem] text-ink ' +
  'placeholder:text-faint focus:border-brand focus-ring transition'

export function Label({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-ink-soft">
      {children}
    </label>
  )
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: ReactNode
  error?: ReactNode
  children: ReactNode
}) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="mt-2 text-sm text-loss">{error}</p>
      ) : hint ? (
        <p className="mt-2 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  )
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, className)} {...rest} />
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(control, 'appearance-none pr-9', className)} {...rest}>
      {children}
    </select>
  )
}

/** ラジオを大きめのタップ領域で表示する（購入方法の選択など）。 */
export function RadioGroup<T extends string>({
  name,
  value,
  onChange,
  options,
}: {
  name: string
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: string }>
}) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2">
      {options.map((o) => (
        <label key={o.value} className="flex cursor-pointer items-center gap-2 py-1 text-[0.9375rem] text-ink">
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="h-4 w-4 accent-[#2563eb] focus-ring"
          />
          {o.label}
        </label>
      ))}
    </div>
  )
}
