import { Link } from 'react-router-dom'
import { ArrowRightIcon, ChartIcon, ClockIcon } from '../components/Icons'

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

        {/* 2つのモード：ホームで最初に選ぶのはこの2枚だけ */}
        <div className="mx-auto max-w-6xl px-4 pb-14 sm:px-6 sm:pb-20">
          <div className="grid gap-5 sm:gap-6 md:grid-cols-2">
            <ModeCard
              to="/past"
              tone="brand"
              icon={<ClockIcon className="h-7 w-7" />}
              title={
                <>
                  もし、あの日
                  <br />
                  買っていたら？
                </>
              }
              description={
                <>
                  過去の株価から
                  <br />
                  今の資産額をシミュレーション
                </>
              }
              cta="シミュレーションする"
            />
            <ModeCard
              to="/invest"
              tone="gain"
              icon={<ChartIcon className="h-7 w-7" />}
              title={
                <>
                  今日から
                  <br />
                  仮想投資
                </>
              }
              description={
                <>
                  現実の株価で
                  <br />
                  お金を使わず投資体験
                </>
              }
              cta="仮想投資を始める"
            />
          </div>
        </div>
      </section>

      {/* 使い方：3ステップ */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <h2 className="text-center text-lg font-bold text-ink sm:text-xl">使い方はかんたん3ステップ</h2>
        <ol className="mt-8 grid gap-4 sm:gap-5 md:grid-cols-3">
          <Step n={1} title="銘柄を入力する" body="日本株は証券コード（例：5401）、米国株はティッカー（例：AAPL）を入力するだけです。" />
          <Step n={2} title="日付と株数を決める" body="「あの日」を選ぶか、今日の株価でそのまま仮想購入します。株数でも金額でも指定できます。" />
          <Step n={3} title="損益をグラフで確認" body="実際の株価にもとづいて、資産がどう増減したかをグラフとカードで確認できます。" />
        </ol>

        <div className="mt-12 rounded-2xl border border-line bg-white p-6 text-center shadow-card sm:p-8">
          <p className="text-sm font-semibold text-ink">お金は1円も使いません</p>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted">
            MoshiKabu は証券口座と接続しません。すべて「買ったことにする」だけの仮想取引です。
            記録はお使いのブラウザにのみ保存されます。
          </p>
        </div>
      </section>
    </>
  )
}

function ModeCard({
  to,
  tone,
  icon,
  title,
  description,
  cta,
}: {
  to: string
  tone: 'brand' | 'gain'
  icon: React.ReactNode
  title: React.ReactNode
  description: React.ReactNode
  cta: string
}) {
  const styles =
    tone === 'brand'
      ? {
          icon: 'bg-brand-soft text-brand',
          button: 'bg-brand hover:bg-brand-600 shadow-[0_2px_10px_rgba(37,99,235,0.25)]',
          ring: 'hover:border-brand/30',
        }
      : {
          icon: 'bg-gain-soft text-gain',
          button: 'bg-gain hover:bg-[#128a3f] shadow-[0_2px_10px_rgba(22,163,74,0.25)]',
          ring: 'hover:border-gain/30',
        }

  return (
    <Link
      to={to}
      className={`group flex flex-col rounded-2xl border border-line bg-white p-7 text-center shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover focus-ring sm:p-9 ${styles.ring}`}
    >
      <span className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${styles.icon}`}>
        {icon}
      </span>
      <h2 className="mt-5 text-xl font-bold leading-snug text-ink sm:text-[1.375rem]">{title}</h2>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-muted sm:text-[0.9375rem]">{description}</p>
      <span
        className={`mt-7 inline-flex h-13 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold text-white transition ${styles.button}`}
      >
        {cta}
        <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
      </span>
    </Link>
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
