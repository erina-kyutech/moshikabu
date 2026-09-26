# MoshiKabu（もし株）

> あのとき買ってたら、今いくら？

実際のお金を **1円も使わず**、現実の株価データを使って株式投資をシミュレーションできる Web アプリです。
証券口座とは一切接続せず、実際の注文・入出金は行いません。

- **MODE 1「あの日買っていたら」** — 過去の任意の日に買っていたら、今いくらになっているかを計算
- **MODE 2「今日から仮想投資」** — 今日の株価で「買ったことにして」登録し、その後の損益を毎日確認

日本株（`5401` → `5401.T`）と米国株（`AAPL` / `NVDA` …）の両方に対応しています。

---

## スクリーン構成

| 画面 | パス | 内容 |
| --- | --- | --- |
| ホーム | `/` | 機能をカードで選択 |
| シミュレーション一覧 | `/simulations` | 過去・比較・積立・一括vs積立の入口 |
| 過去シミュレーション | `/past` | 銘柄・購入日・株数/金額を入力 → 結果とチャート |
| 複数銘柄比較 | `/compare` | 同じ金額を最大10銘柄に入れた場合の比較とランキング |
| 積立投資 | `/recurring` | 毎月の積立（買付日を選択）、元本と評価額の推移 |
| 一括 vs 積立 | `/compare-strategy` | 同額を一括で買った場合と積み立てた場合の比較 |
| 条件で銘柄を探す | `/screener` | 指標・条件・しきい値を自分で組み立てて検索、マイルール保存 |
| 検索結果 | `/screener/results` | 条件を満たした銘柄の一覧（PC は表・スマホはカード） |
| 銘柄詳細（スクリーナー） | `/screener/stock/:ticker` | 概要 / チャート / 財務 / 条件適合 |
| ルールを過去で検証 | `/backtest` | 期間・抽出月・保有期間・初期資金・ベンチマークを設定 |
| バックテスト結果 | `/backtest/result` | サマリー / 資産推移 / 年別成績 / 銘柄別結果 |
| デイトレ練習 | `/daytrade` | 仮想資金・ウォッチリスト・売買・本日の成績 |
| 今日から仮想投資 | `/invest` | チャート（期間・時間足・ローソク足）を見てから現在株価で仮想購入 |
| 仮想ポートフォリオ | `/portfolio` | 総資産・本日の変化・累計損益・資産推移・保有銘柄 |
| 銘柄詳細 | `/portfolio/:id` | 概要 / チャート / 保有詳細、追加購入・売却 |
| 取引履歴 | `/history` | 購入・売却の記録、確定損益 |

---

## 技術構成

```
moshikabu/
├── api/
│   ├── index.py            # Vercel Serverless Function のエントリ（backend の FastAPI を公開）
│   └── requirements.txt    # 関数の依存。ルートに置くと Vercel が FastAPI プロジェクトと誤検出する
├── backend/
│   ├── app/
│   │   ├── main.py         # FastAPI アプリ本体
│   │   ├── symbols.py      # ティッカー正規化（5401 → 5401.T）と市場判定
│   │   ├── cache.py        # TTL キャッシュ（無駄な外部アクセスを削減）
│   │   ├── jp_names.py     # 日本株の日本語社名テーブル
│   │   ├── schemas.py      # API レスポンススキーマ
│   │   ├── providers/      # ★ MarketDataProvider（データ取得先の抽象化）
│   │   │   ├── base.py             # インターフェース定義
│   │   │   ├── yfinance_provider.py# yfinance 実装
│   │   │   └── __init__.py         # レジストリ（環境変数で切替）
│   │   ├── services/
│   │   │   └── simulation.py       # 純粋関数の計算ロジック（分割・休場日・配当）
│   │   └── routers/        # stock / simulate / fx
│   ├── tests/              # pytest（ネットワーク不要）
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── pages/          # 各画面
│       ├── components/     # UI コンポーネント（Button/Card/MetricCard/Charts…）
│       ├── hooks/          # usePositions / useMarketData
│       └── lib/
│           ├── api.ts      # API クライアント
│           ├── portfolio.ts# 評価額・損益の計算（純粋関数）
│           ├── format.ts   # ¥ / $ の表示フォーマット
│           └── storage/    # ★ PortfolioRepository（保存先の抽象化）
│               ├── repository.ts           # インターフェース
│               └── localStorageRepository.ts
└── vercel.json
```

| レイヤ | 採用技術 |
| --- | --- |
| フロントエンド | React 19 + TypeScript + Vite |
| UI | Tailwind CSS v4 |
| グラフ | Recharts |
| ルーティング | React Router |
| バックエンド | Python + FastAPI |
| 株価データ | yfinance（Yahoo Finance） |
| 保存 | localStorage（Supabase 等へ差し替え可能な設計） |
| ホスティング | Vercel（静的フロント + Python Serverless Function） |

---

## ローカルでの起動

### 1. バックエンド（FastAPI）

```bash
cd backend
py -m venv .venv
./.venv/Scripts/python.exe -m pip install -r requirements.txt   # macOS/Linux は .venv/bin/python
./.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

`http://127.0.0.1:8000/docs` で Swagger UI が開きます。

### 2. フロントエンド（Vite）

```bash
cd frontend
npm install
npm run dev
```

`http://localhost:5173` を開きます。`/api` へのリクエストは Vite の proxy 経由で
`http://127.0.0.1:8000` に転送されます（`vite.config.ts`）。

---

## テスト

```bash
# バックエンド（計算ロジック・ティッカー正規化）
cd backend && ./.venv/Scripts/python.exe -m pytest tests -q

# フロントエンド（評価額・損益・表示フォーマット）
cd frontend && npm test
```

いずれもネットワークに依存しないため、オフラインでも実行できます。

---

## API

すべて `/api` 以下。詳細は `/docs`（FastAPI の自動生成ドキュメント）。

| メソッド | パス | 説明 |
| --- | --- | --- |
| GET | `/api/health` | 稼働確認と使用中のプロバイダ名 |
| GET | `/api/search?q=` | 社名・証券コード・ティッカーで銘柄候補を検索 |
| GET | `/api/stock/{ticker}` | 銘柄情報＋最新価格 |
| GET | `/api/stock/{ticker}/info` | 銘柄基本情報のみ |
| GET | `/api/stock/{ticker}/history?start=&end=&maxPoints=` | 株価履歴（分割調整後） |
| GET | `/api/stock/{ticker}/candles?range=&interval=` | チャート用の OHLCV（分足〜月足） |
| GET | `/api/stock/{ticker}/actions?start=` | 株式分割・配当 |
| GET | `/api/quotes?tickers=A,B,C` | 複数銘柄の最新価格（ポートフォリオ用） |
| GET | `/api/simulate/past?ticker=&date=&shares=\|amount=` | 過去シミュレーション |
| GET | `/api/fx/usdjpy?start=` | USD/JPY レート（円換算用） |
| GET | `/api/simulate/compare?tickers=&date=&amount=` | 複数銘柄に同額を投資した場合の比較 |
| GET | `/api/simulate/recurring?ticker=&start=&months=&amount=&day=` | 毎月積立のシミュレーション |
| GET | `/api/simulate/strategy?...` | 一括投資と積立投資の比較 |
| GET | `/api/screener/catalog` | 指標カタログ・演算子・母集団・ベンチマーク・テンプレート・データの制約 |
| POST | `/api/screener/search` | 条件（AND）で銘柄を抽出。一致 / 不一致 / 判定不能を分けて返す |
| GET | `/api/stock/{ticker}/fundamentals` | 現時点の財務指標（取得できない項目は `null`） |
| POST | `/api/backtest/run` | 条件を過去に適用して検証。年別成績・売買明細・資産推移を返す |

`ticker` は `5401` / `150A` / `5401.T` / `AAPL` のいずれの形式でも受け付けます。

---

## 銘柄の検索

検索欄には、次のどれを入れても候補が出ます。Yahoo Finance 形式（`150A.T`）を覚える必要はありません。

| 入力 | 候補 |
| --- | --- |
| `5401` / `7203` | 日本製鉄・トヨタ自動車（東証プライム） |
| `150A` / `１５０ａ` | JSH（東証グロース）※ 2024年以降の英字入りコード |
| `日本製鉄` / `株式会社JSH` / `とよた` | 日本語の社名（法人格・全角・ひらがなは吸収） |
| `AAPL` / `Apple` / `NVIDIA` | 米国株（NASDAQ / NYSE） |

### 日本株と米国株の見分け方

「数字4桁なら日本株」という判定は使いません（2024年1月以降、`130A` `150A` のような英字入りコードがあるため）。

1. `.T` が付いていれば日本株
2. **先頭が数字**で日本のコードの形（1・3桁目が数字、2・4桁目が数字か英字。優先株などの5桁コードも可）
   - JPX の上場銘柄一覧に載っていれば日本株で確定し、`{コード}.T` で取得
   - 載っていなければ（一覧の更新後に上場した銘柄など）`{コード}.T` → `{コード}` の順に取得を試す
3. **先頭が英字**のもの（`AAPL` `BRK-B` `^N225` など）は米国などのティッカーとしてそのまま扱い、`.T` は付けない

米国の上場銘柄のティッカーは英字で始まるので、2 と 3 が衝突することはありません。

### 情報源

- **日本語の社名・市場区分**: JPX の「東証上場銘柄一覧」から作った `backend/app/data/jpx_listed.json`（Yahoo Finance の検索は日本語の社名を引けないため）
- **英語名・米国株・新規上場**: Yahoo Finance の検索（`MarketDataProvider.search`）。先物・OTC・海外の重複上場・私設取引所（`5401@F.T` など）は除外

新規上場を辞書に反映するには、次を実行して JSON をコミットします。

```bash
cd backend
./.venv/Scripts/python.exe -m pip install -r requirements-dev.txt
./.venv/Scripts/python.exe scripts/update_jpx_master.py
```

---

## 計算のしかた（重要な仕様）

### 株式分割

株価 API が返す過去の終値は **分割調整後** です。そのため次のように扱います。

```
当時実際に支払った株価 = 分割調整後の終値 × 購入日より後の分割倍率
現在保有している株数   = 購入株数 × 購入日より後の分割倍率
評価額(t)              = 現在保有株数 × 分割調整後の終値(t)
```

これにより、たとえば「2023-01-10 に日本製鉄を100株」買った場合、
購入株価は ¥2,368（当時の実勢価格）、2025-09-29 の 1:5 分割を経て
現在の保有株数は 500株 として計算されます。分割を無視した誤った損益は表示されません。

### 休場日

指定日が土日・祝日などで市場が開いていない場合はエラーにせず、
**次の取引日の終値**で購入したものとして計算し、その旨と実際の購入日を画面に表示します。

### 配当・税金・手数料

MVP では **株価変動のみ**（配当・税金・売買手数料を含まない）で計算し、結果画面に明記します。
バックエンドは `includeDividends=true` で配当込み計算に切り替えられる実装になっており、
UI にチェックボックスを追加するだけで拡張できます。

### 購入価格の凍結

MODE 2 で仮想購入した価格は `localStorage` に保存され、
後日株価データを取り直しても **決して書き換えません**。
評価額は「保存した購入価格」と「その都度取得する最新株価」の比較で算出するため、
サーバー側で毎日 cron を動かす必要がありません。

### 通貨

日本株は `¥`（整数）、米国株は `$`（小数2桁）で表示します。
ポートフォリオの総額のみ、USD/JPY の実勢レートで円換算して合算します。

---

## チャートとデイトレ練習

### 期間と時間足

分足には取得できる期間の制限があるため、`backend/app/services/candles.py` で
「どの期間でどの足が選べるか」を一元管理しています。

| 期間 | 選べる時間足 | 既定 |
| --- | --- | --- |
| 1日 / 5日 | 1分・5分・15分・30分・1時間 | 5分 / 15分 |
| 1か月 | 5分・15分・30分・1時間・日 | 1時間 |
| 3か月 / 6か月 | 1時間・日・週 | 日 |
| 1年 | 1時間・日・週・月 | 日 |
| 5年 / 全期間 | 日・週・月 | 週 / 月 |

選べない組み合わせを指定してもエラーにはせず、その期間で使える足に切り替えて
`notice`（例:「1年の表示では5分足を利用できません。日足に切り替えました。」）を返します。
画面側でも選べない足のボタンは押せないようにしています。

本数が多いときは、隣り合うローソクを
「始値=最初 / 高値=最大 / 安値=最小 / 終値=最後 / 出来高=合計」でまとめて間引きます
（単純に間引くと高値・安値が消えてしまうため）。

時刻は市場のローカルタイム（日本株は日本時間、米国株は現地時間）で、
表示用のラベルもサーバー側で作っています。

### 更新頻度

再取得の間隔はサーバーが `refreshSeconds` として返し（分足60秒・日足以上300秒）、
画面はそれに従って定期取得します。タブが裏にあるあいだは取得しません。
実際の取得回数はバックエンドの TTL キャッシュでさらに抑えています。

### デイトレ練習

- 仮想資金は円で管理し、米国株は注文時の USD/JPY で円に換算します
- 追加購入すると平均取得単価を計算し直します（100株@600 ＋ 100株@620 → 200株@610）
- 仮想資金を超える買い注文、保有株数を超える売り注文は通りません
- 売却すると実現損益と「買って売るまで」の記録が残り、チャートに BUY / SELL の地点が出ます
- 各注文にメモを残せます（あとから書き換え可能）
- 注文の種類は成行のみですが、`OrderKind`（market / limit / stop）を持たせてあるので
  指値・逆指値を足しやすくしてあります

状態は `frontend/src/lib/storage/dayTrade.ts` の純粋関数（`applyBuy` / `applySell` / `summarize`）で
更新し、保存だけを `dayTradeRepository` に閉じ込めています。

---

## 条件スクリーナーとバックテスト

自分で条件を組み立てて銘柄を絞り込み、そのルールを過去のデータで検証できます。

### 指標と条件

`backend/app/metrics.py` に指標を1か所でまとめています（20指標）。
`指標 + 演算子（以下 / 以上 / 未満 / 超 / 等しい）+ しきい値` を1行とし、すべてを AND で判定します。

| カテゴリ | 指標 |
| --- | --- |
| バリュエーション | PBR・PER・配当利回り |
| 成長性 | 売上高成長率・営業利益成長率・EPS成長率 |
| 収益性 | ROE・ROA・営業利益率 |
| 財務 | 自己資本比率・有利子負債比率 |
| 企業規模 | 時価総額・売上高 |
| 株価 | 株価・1か月/3か月/6か月/1年騰落率 |
| テクニカル | 出来高増加率・52週高値からの乖離率 |

指標を追加するときは `metrics.py` に `MetricDef` を足し、`yfinance_fundamentals.py` に計算を書くだけで、
スクリーナー・銘柄詳細・バックテストの3画面すべてに反映されます。

### 過去時点の財務データ（ルックアヘッド・バイアス対策）

**過去の銘柄抽出に、現在の財務数値は一切使いません。** 財務データは「決算対象期間」と「公表日」の
両方を持ち、バックテストでは `公表日 <= シミュレーション日` を満たす最新の決算だけを使います。

- 公表日は `Ticker.earnings_dates`（実績値が入っている行）から取得し、`publicationSource: "reported"` として扱います
- 取得できない場合は `決算期末 + 90日`（日本株）/ `+ 60日`（米国株）を推定として使い、`"estimated"` と明示します
- 推定を使った銘柄・期は結果画面の注記に出るため、どの数値が推定由来かが分かります

実装は `HistoricalFundamentalProvider.get_as_of(ticker, on)` の1メソッドに閉じています。
別のデータソース（EDINET・有料API など）に差し替える場合も、ここだけを実装すれば他は変更不要です。

### 0件だったときの見せ方

条件をすべて満たす銘柄が無かったときは、**条件を1つずつだけで数え直した通過数**を返します
（`conditionStats`）。どの条件が効いて0件になったのかが分かり、結果画面から対象銘柄を広げて
その場で再検索できます。

```
PBR 1倍以下          2 / 31銘柄
売上高成長率 10%以上  20 / 31銘柄
営業利益成長率 10%以上 10 / 26銘柄   ← 分母が違うのは、5銘柄でこの指標を取得できなかったため
```

### データが無いときの扱い

**架空の値は作りません。** 判定に必要な指標が取得できない銘柄は「一致」でも「不一致」でもなく
**判定対象外（excluded）** として理由つきで数え、画面に「データ不足で判定できず N件」と表示します。

```
一致 2件 / 不一致 26件 / データ不足で判定できず 3件
・データなし（売上高成長率）：3件
```

### 取得できる期間の制約（実測）

yfinance から取れる年次財務諸表は **直近4〜5期分だけ** です。成長率の指標は前期との比較が必要なため、
実際に検証できる抽出日は **おおむね 2024年以降** に限られます。それより前の日付を指定した銘柄は
「その時点で公表済みの決算が無い」として対象外になり、架空のデータで埋めることはしません。

- 例：`5401.T` を 2023-04-01 時点で評価 → 対象外
- 例：`5401.T` を 2024-04-01 時点で評価 → FY2023-03（公表日 2023-05-09、`reported`）を使用

また、母集団は **現在上場している銘柄** から作っているため、上場廃止企業が含まれない
**生存者バイアス**があります。この2点は結果画面にも常時表示しています。

### 対象にする銘柄（母集団）

`backend/app/services/universe.py` で定義。1銘柄あたり約0.65秒かかるため、既定は小さめの母集団です。

| ID | 内容 | 銘柄数 |
| --- | --- | --- |
| `jp-core30` | 日本の代表的な大型株（既定） | 31 |
| `jp-large` | 日本の大型株 | 99 |
| `us-large` | 米国の大型株 | 40 |
| `all` | 日米の大型株 | 139 |
| `jp-mid` | 日本の中型株まで（時間がかかります） | 492 |

### バックテストの手順

1. 毎年決めた月の1日時点で、**その時点で公表済みだった決算**を使って銘柄を抽出
2. そのとき持っている資金を、該当した銘柄へ均等に投資（端株あり）
3. 保有期間（1・3・6・12か月）が過ぎたら全部売って現金に戻す
4. 次の抽出日まで現金で持ち、1に戻る（複利で回します）

株価は分割調整後、米国株は**その日の**為替で円換算します。ベンチマークは
TOPIX（連動ETF `1306.T` で代用）・日経平均・S&P500・NASDAQ100 から選べます。

### 責務の分け方

| 層 | 場所 | 役割 |
| --- | --- | --- |
| 株価取得 | `providers/yfinance_provider.py` | 価格・履歴・OHLCV |
| 財務取得（現在） | `providers/yfinance_fundamentals.py` | `FundamentalProvider.get_current()` |
| 財務取得（過去時点） | 同上 | `HistoricalFundamentalProvider.get_as_of()` |
| 条件判定 | `services/screening.py` | 一致 / 不一致 / 判定対象外の振り分け |
| バックテスト | `services/backtest.py` | 純粋関数。価格は `BacktestData` プロトコル経由 |
| 価格・為替の供給 | `services/backtest_data.py` | 事前一括取得とキャッシュ、円換算 |
| 母集団 | `services/universe.py` | 対象銘柄リスト |

`backtest.py` は外部通信を一切せず、価格取得を `BacktestData` プロトコルに委ねているため、
計算ロジックだけをテストできます（`tests/test_screening.py`）。
UI 側に計算は置かず、`frontend/src/lib/screener.ts` は型定義のみです。

### 表現についての決まり

「おすすめ」「買うべき」「上がる銘柄」といった断定的な表現は使いません。
画面上は「条件に一致した銘柄」という表現で統一し、結果画面には
**過去の結果であり、将来の成績を保証するものではありません**と常時表示しています。

### マイルール

作った条件は「マイルール」として名前をつけて保存できます（`localStorage`。
キーは `moshikabu.rules.v1`）。保存したルールはバックテスト画面から選んでそのまま検証できます。

---

## 拡張しやすくしてある箇所

| 追加したい機能 | 変更する場所 |
| --- | --- |
| 別の株価API（Alpha Vantage / Twelve Data など） | `backend/app/providers/` に実装を追加し、レジストリに登録して `MARKET_DATA_PROVIDER` を変更 |
| Supabase など DB への保存 | `frontend/src/lib/storage/` に `PortfolioRepository` の実装を追加して `index.ts` で差し替え |
| 配当込みシミュレーション | `simulate_past(include_dividends=True)` を UI から指定 |
| 積立・ドルコスト平均法 | `backend/app/services/simulation.py` に新しい純粋関数を追加 |
| 指数との比較（S&P500 / 日経平均） | 既存の `/api/stock/{ticker}/history` に `^GSPC` `^N225` を渡すだけで取得可能 |
| 手数料・税金・NISA モード | `simulation.py` の計算に係数を追加（表示は `format.ts` を共用） |
| 指値・逆指値・OCO | `dayTrade.ts` の `OrderKind` に追加し、約定判定を `applyBuy` / `applySell` の前段に置く |
| 移動平均・VWAP・RSI などの指標 | `MarketChart` に系列を足す（OHLCV は `/candles` で取得済み） |
| 週間・月間・銘柄別の成績 | `summarize()` の集計軸を増やす |
| スクリーニング指標の追加 | `backend/app/metrics.py` に `MetricDef` を足し、`yfinance_fundamentals.py` に計算を書く |
| 過去の財務データの拡充（EDINET など） | `HistoricalFundamentalProvider.get_as_of()` を実装したクラスに差し替える |
| 対象銘柄の追加 | `backend/app/services/universe.py` に `UniverseDef` を追加 |
| OR 条件・グループ化 | `services/screening.py` の `check()` を残したまま、条件ツリーの評価関数を追加 |
| リバランス・損切りルール | `services/backtest.py` の `run()` は純粋関数なので、売却判定だけを差し替え可能 |

---

## 環境変数

`.env.example` を参照してください。

| 変数 | 用途 |
| --- | --- |
| `MARKET_DATA_PROVIDER` | 株価データの取得先（既定 `yfinance`） |
| `CORS_ORIGINS` | CORS を許可するオリジン（カンマ区切り） |
| `VITE_API_BASE` | フロントから見た API のベース URL（同一オリジンなら空） |

---

## 免責

本サービスは投資シミュレーションを目的としたものであり、投資助言ではありません。
表示される情報の正確性を保証するものではありません。
実際の証券口座とは接続しておらず、実際のお金による取引は一切行われません。
株価データは Yahoo Finance を利用しており、遅延・欠損が生じる場合があります。
