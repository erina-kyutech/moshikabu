/** 画面下部の免責表示（全ページ共通）。 */
export function Disclaimer() {
  return (
    <footer className="mt-16 border-t border-line bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-xs leading-relaxed text-faint">
          本サービスは投資シミュレーションを目的としたものであり、投資助言ではありません。表示される情報の正確性を保証するものではありません。
        </p>
        <p className="mt-2 text-xs leading-relaxed text-faint">
          実際の証券口座とは接続しておらず、実際のお金による取引は一切行われません。株価データは Yahoo Finance
          を利用しており、遅延・欠損が生じる場合があります。
        </p>
      </div>
    </footer>
  )
}

/** シミュレーション結果に添える注記。 */
export function SimulationNote({ className = '' }: { className?: string }) {
  return (
    <p className={`text-xs leading-relaxed text-muted ${className}`}>
      ※ 現在のシミュレーションは配当金・税金・売買手数料を含みません。
    </p>
  )
}
