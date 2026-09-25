import { Link } from 'react-router-dom'
import { PageContainer, PageHeader } from '../components/PageHeader'
import { MODES, ModeCard } from '../components/ModeCard'
import { Card } from '../components/ui/Card'
import { CandleIcon, ChartIcon, ClockIcon, CompareIcon, SearchIcon, StackIcon } from '../components/Icons'

const ICONS = {
  clock: <ClockIcon className="h-6 w-6" />,
  chart: <ChartIcon className="h-6 w-6" />,
  compare: <CompareIcon className="h-6 w-6" />,
  stack: <StackIcon className="h-6 w-6" />,
  candle: <CandleIcon className="h-6 w-6" />,
  search: <SearchIcon className="h-6 w-6" />,
}

/** スマートフォンの下部ナビから、すべてのシミュレーション機能へ入るための一覧。 */
export default function Simulations() {
  return (
    <PageContainer>
      <PageHeader
        title="シミュレーション"
        description="試したい内容を選んでください。どれも実際のお金は使いません。"
      />

      <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
        {MODES.map((mode) => (
          <ModeCard
            key={mode.to}
            to={mode.to}
            tone={mode.tone}
            icon={ICONS[mode.iconKey]}
            title={mode.title}
            description={mode.description}
            cta={mode.cta}
            compact
          />
        ))}
      </div>

      <Card className="mt-6" padding="lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-base font-bold text-ink">一括投資 vs 積立投資</p>
            <p className="mt-1 text-sm text-muted">
              同じ総額を「まとめて」と「毎月コツコツ」で投資した場合を並べて比べます。
            </p>
          </div>
          <Link
            to="/compare-strategy"
            className="focus-ring inline-flex h-11 shrink-0 items-center rounded-xl border border-line bg-white px-5 text-sm font-semibold text-ink transition hover:bg-canvas-2"
          >
            比べてみる
          </Link>
        </div>
      </Card>
    </PageContainer>
  )
}
