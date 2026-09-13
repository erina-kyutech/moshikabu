import type { ReactNode } from 'react'
import { Card } from './Card'
import { Button } from './Button'

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin text-brand`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function LoadingBlock({ message = '株価データを取得中…' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <Spinner className="h-6 w-6" />
      <p className="text-sm text-muted">{message}</p>
    </div>
  )
}

export function ErrorBlock({
  message,
  onRetry,
  title = 'データを取得できませんでした',
}: {
  message: string
  onRetry?: () => void
  title?: string
}) {
  return (
    <Card className="text-center" padding="lg">
      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-loss-soft text-loss">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5M12 16.5v.01" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="mb-1 text-base font-bold text-ink">{title}</h3>
      <p className="mx-auto max-w-md text-sm text-muted">{message}</p>
      {onRetry ? (
        <div className="mt-5">
          <Button variant="secondary" onClick={onRetry}>
            もう一度試す
          </Button>
        </div>
      ) : null}
    </Card>
  )
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string
  description: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <Card className="text-center" padding="lg">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand">
        {icon ?? (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M3 17l5-5 4 3 8-8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <h3 className="mb-1.5 text-base font-bold text-ink">{title}</h3>
      <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted">{description}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </Card>
  )
}

export function SkeletonLine({ className = 'h-4 w-24' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-line-soft ${className}`} />
}
