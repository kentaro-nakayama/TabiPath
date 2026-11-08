"""レベル2: 画面・クライアント・APIルート・テーブルの対応"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from svglib import *  # noqa

W, H = 1400, 1150
b = []

PX, PW = 32, 236      # 画面
CX, CW = 316, 300     # クライアントコンポーネント
AX, AW = 660, 396     # Route Handlers
DX, DW = 1100, 268    # テーブル / 外部

# --- 列見出し ---------------------------------------------------------------
for x, w, label in (
    (PX, PW, "画面 (App Router / RSC)"),
    (CX, CW, "クライアントコンポーネント"),
    (AX, AW, "Route Handlers (/api)"),
    (DX, DW, "保存先"),
):
    b.append(text(x + w / 2, 96, label, size=12.5, weight="700", anchor="middle", fill=MUTED))

b.append(f'<path d="M {PX} 106 L {DX + DW} 106" stroke="#30363d" stroke-width="1.5"/>')


def band(y, h, page, page_lines, comp, comp_lines, apis, store, store_lines,
         comp_style="client", api_style="api", store_style="db"):
    out = [
        box(PX, y, PW, h, page, page_lines, style="server"),
        box(CX, y, CW, h, comp, comp_lines, style=comp_style),
        box(AX, y, AW, h, apis[0], apis[1], style=api_style, mono_lines=True),
        box(DX, y, DW, h, store, store_lines, style=store_style),
        arrow(PX + PW, y + h / 2, CX, y + h / 2),
        arrow(CX + CW, y + h / 2, AX, y + h / 2),
        arrow(AX + AW, y + h / 2, DX, y + h / 2),
    ]
    return "".join(out)


# --- 旅行一覧 ---------------------------------------------------------------
b.append(band(
    126, 106,
    "/trips", ["一覧をDBから取得", "sortTripsByUpcoming で並べ替え"],
    "TripCard / CreateTripDialog", ["カード表示・新規作成ダイアログ"],
    ("旅行の一覧と作成", ["GET  /api/trips", "POST /api/trips"]),
    "trips / trip_members", ["作成時に owner として", "メンバー行も同時に作る"],
))

# --- 旅行詳細 ---------------------------------------------------------------
b.append(band(
    262, 212,
    "/trips/[tripId]", ["getTripRole で権限確認", "loadTripDetail で", "行程・スポットをまとめて取得", "→ initial として渡す"],
    "TripWorkspace", ["DayColumn / SortableItineraryItem", "TripMap / SpotSearch", "CustomSpotDialog", "ScheduleConfirmDialog", "MembersDialog"],
    ("行程の編集", [
        "GET    /api/trips/[tripId]",
        "PATCH  /api/trips/[tripId]",
        "POST   .../spots",
        "PATCH  .../spots/[spotId]",
        "POST   .../itinerary",
        "PATCH  .../itinerary/[itemId]",
        "PATCH  .../itinerary/reorder",
        "GET    .../members · POST .../invites",
    ]),
    "spots / itinerary_days", ["itinerary_items", "trip_members / invites"],
))

# --- スポットリスト一覧 -----------------------------------------------------
b.append(band(
    504, 106,
    "/spots", ["自分が参加しているリストと", "保存件数を取得"],
    "SpotListCard / CreateSpotListDialog", ["カード表示・新規作成ダイアログ"],
    ("リストの一覧と作成", ["GET  /api/spot-lists", "POST /api/spot-lists"]),
    "spot_lists", ["spot_list_members"],
))

# --- スポットリスト詳細 -----------------------------------------------------
b.append(band(
    640, 176,
    "/spots/[spotListId]", ["getSpotListRole で権限確認", "loadSpotListDetail で", "保存スポットを取得"],
    "SpotListWorkspace", ["SpotListItem (メモ編集)", "AddToTripDialog", "SpotSearch / 独自スポット登録", "MembersDialog"],
    ("行きたいところの編集", [
        "POST   /api/spot-lists/[id]/spots",
        "PATCH  /api/spots/[spotId]",
        "DELETE /api/spots/[spotId]",
        "POST   /api/spots/[spotId]/add-to-trip",
        "GET    .../members · POST .../invites",
    ]),
    "saved_spots", ["add-to-trip のときだけ", "spots / itinerary_items にコピー"],
))

# --- 招待 -------------------------------------------------------------------
b.append(band(
    846, 96,
    "/invites/[token]", ["トークンから招待を検索", "(公開ルート)"],
    "招待受諾フォーム", ["Server Action を submit"],
    ("Server Action (APIルートではない)", ["acceptInvite / acceptSpotListInvite"]),
    "trip_members", ["spot_list_members", "invites.status を accepted に"],
    comp_style="client", api_style="server",
))

# --- プロフィール/ヒント ----------------------------------------------------
b.append(band(
    972, 104,
    "app/layout.tsx", ["全ページ共通のゲート", "(レイアウトに常駐)"],
    "表示名・ヒントのゲート", ["DisplayNameGate / AvatarPromptGate", "HintBubble", "未設定なら自動でダイアログ表示"],
    ("プロフィール", ["PATCH /api/me", "POST  /api/me/hints"]),
    "Clerk publicMetadata", ["displayName / avatarPromptSeen", "seenHints"],
    store_style="external",
))

# --- 注記 -------------------------------------------------------------------
b.append(note(PX, 1106,
    "画面(RSC)は lib/trip-detail.ts などから直接DBを読み、以降の更新は右の Route Handlers 経由。"))
b.append(note(PX, 1126,
    "どのハンドラも auth() → getTripRole / getSpotListRole で権限確認 → zod で入力検証 の順に通す。"))

write(os.path.join(os.path.dirname(os.path.abspath(__file__)), "02-routes.svg"),
      svg(W, H, "\n".join(b), "レベル2: 画面とAPIの対応",
          "どの画面がどのコンポーネントを使い、どのAPIを叩き、どのテーブルに届くか"))
