"""レベル1: システム構成図"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from svglib import *  # noqa

W, H = 1180, 660
b = []

# --- 利用者の端末 -----------------------------------------------------------
b.append(group(32, 96, 300, 300, "利用者の端末"))
b.append(box(62, 128, 250, 122, "ブラウザ (React クライアント)", [
    "TanStack Query でAPIを取得/更新",
    "@vis.gl/react-google-maps で地図描画",
    "Clerk JS でセッション保持",
], style="client"))
b.append(box(62, 288, 250, 72, "サインイン / サインアップ", [
    "Clerk のホスト型UIを埋め込み",
], style="client"))

# --- Vercel -----------------------------------------------------------------
b.append(group(392, 96, 420, 440, "Vercel (Next.js App Router / Node.js ランタイム)", color="#a371f7"))
b.append(box(412, 128, 380, 58, "src/proxy.ts — Clerk ミドルウェア", [
    "公開ルート以外は auth.protect() で保護",
], style="server"))
b.append(box(412, 212, 182, 92, "Server Components", [
    "page.tsx (RSC)",
    "初期表示データを",
    "DBから直接取得",
], style="server"))
b.append(box(610, 212, 182, 92, "Route Handlers", [
    "/api/**/route.ts",
    "zod で入力検証",
    "JSONを返す",
], style="api"))
b.append(box(412, 330, 182, 74, "Server Actions", [
    "招待の受諾処理",
    "invites/[token]",
], style="server"))
b.append(box(610, 330, 182, 74, "lib/access.ts", [
    "権限判定",
    "owner / editor / viewer",
], style="lib"))
b.append(box(412, 430, 380, 76, "データアクセス層", [
    "lib/trip-detail.ts · lib/spot-list-detail.ts · lib/itinerary-days.ts",
    "src/db (Drizzle ORM + @neondatabase/serverless)",
], style="lib"))

# --- 外部サービス -----------------------------------------------------------
b.append(box(872, 128, 276, 96, "Clerk", [
    "認証・セッション検証",
    "ユーザー情報 (clerkClient)",
    "publicMetadata に表示名等",
], style="external"))
b.append(box(872, 268, 276, 96, "Neon Postgres", [
    "旅行・スポット・行程・招待",
    "Drizzle のスキーマで管理",
    "HTTP接続 (neon-http)",
], style="db"))
b.append(box(872, 408, 276, 98, "Google Maps Platform", [
    "Maps JavaScript API",
    "Places / Geocoding",
    "Distance Matrix (所要時間)",
], style="external"))

# --- 矢印 -------------------------------------------------------------------
b.append(arrow(312, 160, 408, 160, "HTTP / fetch"))
b.append(elbow([(312, 318), (352, 318), (352, 84), (1010, 84), (1010, 124)],
               "Clerk ホスト型UI", dashed=True, label_at=(680, 84), label_dy=-7))
b.append(arrow(792, 152, 868, 152, "セッション検証", label_dy=-7))
b.append(elbow([(792, 252), (832, 252), (832, 200), (868, 200)],
               "ユーザー情報", label_at=(832, 226), label_dy=0))
b.append(elbow([(792, 462), (838, 462), (838, 316), (868, 316)],
               "SQL ⇄ 結果行", label_at=(838, 390), label_dy=0))
b.append(elbow([(62, 200), (42, 200), (42, 566), (1010, 566), (1010, 510)],
               "地図・検索・所要時間をブラウザから直接取得 (NEXT_PUBLIC_ キー)",
               dashed=True, label_at=(520, 566), label_dy=-7))
b.append(arrow(502, 190, 502, 208))
b.append(arrow(700, 190, 700, 208))
b.append(arrow(502, 308, 502, 326))
b.append(arrow(700, 308, 700, 326))
b.append(arrow(502, 406, 502, 426))
b.append(arrow(700, 406, 700, 426))

b.append(note(32, 606, "初期表示は Server Components が DB から直接読み、以降の更新は TanStack Query → Route Handlers → DB を通る。"))
b.append(note(32, 628, "DBに入るのは旅行データのみ。ユーザーの表示名・アバター・ヒント既読は Clerk の publicMetadata 側に持つ。"))

write(os.path.join(os.path.dirname(os.path.abspath(__file__)), "01-system.svg"),
      svg(W, H, "\n".join(b), "レベル1: システム構成",
          "TabiPath — どこで何が動き、どのサービスと通信するか"))
