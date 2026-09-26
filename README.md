# TabiPath(旅ぱす)

🌐 **[https://tabipath.app](https://tabipath.app)** で公開中

旅行の日程を管理するWebアプリ。行きたいスポットをGoogleマップなどから検索して保存したり、独自の目的地を設定できる。旅行の行程画面では中央にGoogleマップを表示し、行程で決めた順番にピンを立てる。一緒に行くメンバーを招待して共同編集できる。

## 主要機能

- **スポット検索・保存**: Google Places APIでスポットを検索し、旅行に保存する
- **独自目的地の登録**: Google検索にヒットしない場所も、緯度経度や住所を手入力で登録できる
- **行程（イティネラリー）管理**: 日ごとに訪問するスポットを並び替えて順序を決める
- **地図表示**: 行程画面の中央にGoogleマップを表示し、決めた順番どおりにピンを配置する
- **メンバー招待・共同編集**: 旅行に他のユーザーを招待し、複数人で行程を編集できる（非同期編集）

## 画面紹介

### 旅行一覧・スポット一覧

作成した旅行と、保存したスポットリストをそれぞれ一覧できる。旅行ごとの日程やメンバー数、スポットリストごとの保存件数がひと目で分かる。

<img src="docs/screenshots/trips-list.jpg" width="480" alt="旅行一覧画面">　<img src="docs/screenshots/spots-list.jpg" width="480" alt="スポット一覧画面">

### スポット検索・保存

Google Places APIによる検索で、住所や施設名からスポットを検索し、スポットリストに保存できる。

<img src="docs/screenshots/spot-search.jpg" width="600" alt="スポット検索画面">

### 独自目的地の登録

Google検索にヒットしない場所でも、住所を入力（または地図クリック）して緯度経度を指定し、移動手段とあわせて登録できる。

<img src="docs/screenshots/custom-spot.jpg" width="600" alt="独自目的地登録ダイアログ">

### 行程（イティネラリー）管理・地図表示

日ごとにスポットをドラッグ＆ドロップで並び替えて訪問順を決定。中央のGoogleマップには決めた順番どおりにピンとルート線が表示され、区間ごとの移動手段・所要時間も確認できる。

<img src="docs/screenshots/itinerary-map.jpg" width="900" alt="行程管理・地図表示画面">

### メンバー招待・共同編集

招待リンクを発行してメンバーを招待し、複数人で旅行の行程を編集できる（非同期編集）。

<img src="docs/screenshots/member-invite.jpg" width="480" alt="メンバー招待ダイアログ">

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フレームワーク | Next.js (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| 地図 | Google Maps Platform（Maps JavaScript API + Places API + Geocoding API）、`@vis.gl/react-google-maps` |
| DB | Neon Postgres（Vercel Marketplace経由で自動プロビジョニング）+ Drizzle ORM |
| 認証 | Clerk（Vercel Marketplace） |
| データ取得/キャッシュ | TanStack Query |
| ホスティング | Vercel（デプロイ先: [tabipath.app](https://tabipath.app)） |

## セットアップ

### 前提条件

- Node.js
- [Vercel CLI](https://vercel.com/docs/cli)（`vercel link` でプロジェクトをリンク済みであること）

### 手順

1. 依存パッケージをインストール

   ```bash
   npm install
   ```

2. 環境変数を同期

   Neon（DB）・Clerk（認証）はVercel Marketplace経由でプロビジョニングされるため、`vercel env pull` で同期する。

   ```bash
   vercel env pull .env.local
   ```

   Google Maps Platformの各APIキー（`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` など）はMarketplace対象外のため、[Google Cloud Console](https://console.cloud.google.com/google/maps-apis/credentials)で個別に発行し、`.env.local` に設定する。詳細は `.env.example` を参照。

3. 開発サーバーを起動

   ```bash
   npm run dev
   ```

   [http://localhost:3000](http://localhost:3000) を開く。

## 主なコマンド

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバーを起動 |
| `npm run build` | 本番ビルド |
| `npm run start` | 本番サーバーを起動 |
| `npm run lint` | ESLintを実行 |
| `npx drizzle-kit generate` | スキーマからマイグレーションファイルを生成 |
| `npx drizzle-kit migrate` | マイグレーションを適用 |

## ディレクトリ構成（抜粋）

```
src/
├── app/          # ルーティング（App Router）・APIルート
├── components/   # UIコンポーネント
├── db/           # Drizzleスキーマ・DBクライアント
├── lib/          # 共通ロジック・カスタムフック
└── types/        # 型定義
```

## ドキュメント

- [CLAUDE.md](./CLAUDE.md): プロジェクト仕様書（データ構造・技術選定の経緯など）
