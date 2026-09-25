import { Link } from 'react-router-dom'
import { MODES, ModeCard } from '../components/ModeCard'
import { CandleIcon, ChartIcon, ClockIcon, CompareIcon, SearchIcon, StackIcon } from '../components/Icons'

const ICONS = {
  clock: <ClockIcon className="h-7 w-7" />,
  chart: <ChartIcon className="h-7 w-7" />,
  compare: <CompareIcon className="h-7 w-7" />,
  stack: <StackIcon className="h-7 w-7" />,
  candle: <CandleIcon className="h-7 w-7" />,
  search: <SearchIcon className="h-7 w-7" />,
}

export default function Home() {
  return (
    <>
      {/* ヒーロー：余白を大きく取り、最初に目に入る問いかけを主役にする */}
      <section className="relative overflow-hidden border-b border-line bg-gradient-to-b from-[#EEF4FF] via-[#F5F8FE] to-canvas">
        <div className="mx-auto max-w-6xl px-4 pt-14 pb-8 text-center sm:px-6 sm:pt-20 sm:pb-10">
          <h1 className="text-[1.75rem] font-bold leading-[1.35] tracking-tight text-ink sm:text-5xl sm:leading-[1.25]">
            あのとき買ってたら、
            <br />
            今いくら？
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[0.9375rem] leading-relaxed text-ink-soft sm:text-base">
            実際のお金を使わずに、現実の株価で
            <br className="hidden sm:block" />
            投資をシミュレーションしてみましょう。
          </p>
        </div>

        {/* 5つの機能。PCは2列（デイトレだけ横長）、スマホは縦1列 */}
        <div className="mx-auto max-w-5xl px-4 pb-14 sm:px-6 sm:pb-20">
          <div className="grid gap-5 sm:gap-6 md:grid-cols-2">
            {MODES.map((mode) => (
              <ModeCard
                key={mode.to}
                to={mode.to}
                tone={mode.tone}
                icon={ICONS[mode.iconKey]}
                title={mode.title}
                description={mode.description}
                cta={mode.cta}
                className={mode.to === '/daytrade' ? 'md:col-span-2' : undefined}
              />
            ))}
          </div>
        </div>
      </section>

      {/* 使い方：3ステップ */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <h2 className="text-center text-lg font-bold text-ink sm:text-xl">使い方はかんたん3ステップ</h2>
        <ol className="mt-8 grid gap-4 sm:gap-5 md:grid-cols-3">
          <Step
            n={1}
            title="銘柄を入力する"
            body="日本株は証券コード（例：5401）、米国株はティッカー（例：AAPL）を入力するだけです。"
          />
          <Step
            n={2}
            title="日付と金額を決める"
            body="「あの日」を選ぶか、今日から仮想で買うか、毎月いくら積み立てるかを決めます。"
          />
          <Step
            n={3}
            title="損益をグラフで確認"
            body="実際の株価にもとづいて、資産がどう増減したかをグラフとカードで確認できます。"
          />
        </ol>

        <div className="mt-12 rounded-2xl border border-line bg-white p-6 text-center shadow-card sm:p-8">
          <p className="text-sm font-semibold text-ink">お金は1円も使いません</p>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted">
            MoshiKabu は証券口座と接続しません。すべて「買ったことにする」だけの仮想取引です。
            記録はお使いのブラウザにのみ保存されます。
          </p>
          <p className="mt-4 text-sm text-muted">
            <Link to="/compare-strategy" className="font-medium text-brand hover:underline">
              一括投資と積立投資を比べる
            </Link>
            {' '}こともできます。
          </p>
        </div>
      </section>
    </>
  )
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="rounded-2xl border border-line bg-white p-6 shadow-card">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-[0.8125rem] font-bold text-brand">
        {n}
      </span>
      <h3 className="mt-4 text-base font-bold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
    </li>
  )
}
