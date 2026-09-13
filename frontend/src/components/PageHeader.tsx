import type { ReactNode } from 'react'

/** 各ページ共通の見出し（タイトル＋説明）。 */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[1.75rem]">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  )
}

/** ページ本体の横幅・余白を統一するコンテナ。 */
export function PageContainer({ children, narrow }: { children: ReactNode; narrow?: boolean }) {
  return (
    <div className={`mx-auto px-4 py-8 sm:px-6 sm:py-10 ${narrow ? 'max-w-3xl' : 'max-w-6xl'}`}>
      {children}
    </div>
  )
}
