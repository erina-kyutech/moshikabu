import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const SITE = 'https://moshikabu-black.vercel.app'
const SITE_NAME = 'もし株（MoshiKabu）'

interface PageSeo {
  title: string
  description: string
}

/**
 * 画面ごとのタイトルと説明文。
 *
 * 検索結果に出るのはここの文言なので、画面ごとに中身を変える。
 * 各ページに散らさず1か所にまとめているのは、
 * 条件分岐で早く return するページだと入れ忘れ・入れ違いが起きるため。
 */
const PAGES: Record<string, PageSeo> = {
  '/': {
    title: 'あのとき買ってたら、今いくら？',
    description:
      'もし株は、実際のお金を使わずに現実の株価で投資を練習できる無料の投資シミュレーターです。日本株・米国株に対応。過去シミュレーション、仮想ポートフォリオ、デイトレ練習、条件スクリーナー、バックテストが使えます。',
  },
  '/simulations': {
    title: 'シミュレーション一覧',
    description:
      '過去シミュレーション、複数銘柄の比較、積立投資、一括投資と積立の比較。目的に合わせて選べます。',
  },
  '/past': {
    title: '過去シミュレーション',
    description:
      'あの日あの株を買っていたら、今いくらになっていたかを計算します。株式分割も調整済み。銘柄・購入日・金額を入れるだけで、損益とチャートを表示します。',
  },
  '/invest': {
    title: '今日から仮想投資',
    description:
      '今日の株価で買ったことにして、仮想ポートフォリオに登録できます。実際のお金は使いません。その後の損益を毎日確認できます。',
  },
  '/portfolio': {
    title: '仮想ポートフォリオ',
    description:
      '仮想で買った銘柄の総資産・損益・資産推移をまとめて確認できます。最新の株価で毎回計算し直します。',
  },
  '/daytrade': {
    title: 'デイトレ練習',
    description:
      '仮想資金で、実際の値動きを見ながら売買の練習ができます。分足チャート、ウォッチリスト、約定履歴、当日の成績つき。実際のお金は使いません。',
  },
  '/screener': {
    title: '条件で銘柄を探す',
    description:
      'PBR・ROE・売上高成長率などの条件を自分で組み合わせて銘柄を絞り込めます。条件はマイルールとして保存でき、過去データで検証もできます。',
  },
  '/screener/results': {
    title: '検索結果',
    description: '設定した条件をすべて満たした銘柄の一覧です。',
  },
  '/backtest': {
    title: 'ルールを過去で検証（バックテスト）',
    description:
      '自分で作った投資ルールが過去にどうなっていたかを検証します。銘柄の抽出には、その時点で公表済みだった決算だけを使います。',
  },
  '/backtest/result': {
    title: 'バックテスト結果',
    description: '検証したルールの成績、年別の結果、売買の明細を確認できます。',
  },
  '/compare': {
    title: '複数銘柄を比較',
    description:
      '同じ金額を複数の銘柄に投資していた場合の結果を並べて比較できます。最大10銘柄までランキング表示。',
  },
  '/recurring': {
    title: '積立投資シミュレーション',
    description: '毎月決まった額を積み立てていた場合の資産推移を計算します。買付日も選べます。',
  },
  '/compare-strategy': {
    title: '一括投資と積立投資の比較',
    description:
      '同じ金額を一度に買った場合と、毎月に分けて積み立てた場合の結果を比較します。',
  },
  '/history': {
    title: '取引履歴',
    description: '仮想の購入・売却の記録と、確定した損益を一覧で確認できます。',
  },
  '/data': {
    title: '記録の保存と復元',
    description:
      '仮想投資の記録は端末に保存し、控えをサーバーにも置いています。記録IDで別の端末からでも取り戻せます。',
  },
}

function setMeta(selector: string, attr: 'content' | 'href', value: string): void {
  document.head.querySelector(selector)?.setAttribute(attr, value)
}

/** いまのパスに対応するタイトル・説明文・正規URLを設定する。 */
export function RouteSeo() {
  const { pathname } = useLocation()

  useEffect(() => {
    // /screener/stock/7203.T のような可変パスは、前方一致でいちばん長いものを使う
    const key =
      PAGES[pathname] !== undefined
        ? pathname
        : Object.keys(PAGES)
            .filter((p) => p !== '/' && pathname.startsWith(p))
            .sort((a, b) => b.length - a.length)[0]
    const page = PAGES[key] ?? PAGES['/']

    const fullTitle = `${page.title} | ${SITE_NAME}`
    // 記録ID（?book=...）付きのURLが別ページ扱いにならないよう、クエリは落とす
    const url = `${SITE}${pathname}`

    document.title = fullTitle
    setMeta('meta[name="description"]', 'content', page.description)
    setMeta('link[rel="canonical"]', 'href', url)
    setMeta('meta[property="og:title"]', 'content', fullTitle)
    setMeta('meta[property="og:description"]', 'content', page.description)
    setMeta('meta[property="og:url"]', 'content', url)
    setMeta('meta[name="twitter:title"]', 'content', fullTitle)
    setMeta('meta[name="twitter:description"]', 'content', page.description)
  }, [pathname])

  return null
}
