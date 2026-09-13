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
| ホーム | `/` | 2つのモードを大きなカードで選択 |
| 過去シミュレーション | `/past` | 銘柄・購入日・株数/金額を入力 → 結果とチャート |
| 今日から仮想投資 | `/invest` | 現在株価で仮想購入 |
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
| GET | `/api/stock/{ticker}` | 銘柄情報＋最新価格 |
| GET | `/api/stock/{ticker}/info` | 銘柄基本情報のみ |
| GET | `/api/stock/{ticker}/history?start=&end=&maxPoints=` | 株価履歴（分割調整後） |
| GET | `/api/stock/{ticker}/actions?start=` | 株式分割・配当 |
| GET | `/api/quotes?tickers=A,B,C` | 複数銘柄の最新価格（ポートフォリオ用） |
| GET | `/api/simulate/past?ticker=&date=&shares=\|amount=` | 過去シミュレーション |
| GET | `/api/fx/usdjpy?start=` | USD/JPY レート（円換算用） |

`ticker` は `5401` / `5401.T` / `AAPL` のいずれの形式でも受け付けます。

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

## 拡張しやすくしてある箇所

| 追加したい機能 | 変更する場所 |
| --- | --- |
| 別の株価API（Alpha Vantage / Twelve Data など） | `backend/app/providers/` に実装を追加し、レジストリに登録して `MARKET_DATA_PROVIDER` を変更 |
| Supabase など DB への保存 | `frontend/src/lib/storage/` に `PortfolioRepository` の実装を追加して `index.ts` で差し替え |
| 配当込みシミュレーション | `simulate_past(include_dividends=True)` を UI から指定 |
| 積立・ドルコスト平均法 | `backend/app/services/simulation.py` に新しい純粋関数を追加 |
| 指数との比較（S&P500 / 日経平均） | 既存の `/api/stock/{ticker}/history` に `^GSPC` `^N225` を渡すだけで取得可能 |
| 手数料・税金・NISA モード | `simulation.py` の計算に係数を追加（表示は `format.ts` を共用） |

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
