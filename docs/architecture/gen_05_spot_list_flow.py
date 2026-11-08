"""レベル5: 行きたいところリストの処理の流れ"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from svglib import *  # noqa
from svglib import _approx_width

W, H = 1400, 1000
b = []
X0 = 60

lx = 820
for label, style in [
    ("クライアント", "client"), ("TanStack Query", "lib"),
    ("Route Handler", "api"), ("DB", "db"), ("Server Action", "server"),
]:
    fill, stroke, _ = PALETTE[style]
    b.append(f'<rect x="{lx}" y="38" width="14" height="14" rx="3" fill="{fill}" stroke="{stroke}"/>')
    b.append(text(lx + 20, 50, label, size=10.5, fill=MUTED))
    lx += _approx_width(label, 10.5) + 46

# --- 1. スポットを保存 ------------------------------------------------------
b.append(heading(X0, 110, "1", "行きたいスポットを保存する", "旅行に紐づかない、ユーザー所有のリスト"))
row, _ = steps(X0, 128, [
    ("SpotSearch / 独自登録", ["Places で検索", "または緯度経度・住所を手入力"], "client"),
    ("createSpot.mutateAsync", ["POST /api/spot-lists/", "[spotListId]/spots"], "lib"),
    ("Route Handler", ["auth() → getSpotListRole", "editor 以上か判定", "zod で検証"], "api"),
    ("saved_spots に INSERT", ["name / address / lat / lng", "google_place_id / notes"], "db"),
    ("invalidate()", ["GET /api/spot-lists/[id]", "loadSpotListDetail で再取得"], "lib"),
], h=104)
b.append(row)

# --- 2. メモを編集 ----------------------------------------------------------
b.append(heading(X0, 300, "2", "スポットのメモを編集する", "部分更新のPATCH"))
row, _ = steps(X0, 318, [
    ("SpotListItem", ["メモ欄に入力して保存", "saveNotes → onUpdateNotes"], "client"),
    ("updateSpotNotes", ["PATCH /api/spots/[spotId]", "{ notes } だけを送る"], "lib"),
    ("Route Handler", ["name も notes も optional", "送られたキーだけ set", "updatedAt は常に更新"], "api"),
    ("saved_spots を UPDATE", ["notes を書き換え", "空文字は null にする"], "db"),
    ("invalidate()", ["リストを再取得して", "メモを表示し直す"], "lib"),
], h=104)
b.append(row)

# --- 3. 旅行に追加 ----------------------------------------------------------
b.append(heading(X0, 490, "3", "保存したスポットを旅行の行程に追加する",
                 "リストと旅行、両方の権限を確認してからコピー"))
row, _ = steps(X0, 508, [
    ("AddToTripDialog", ["GET /api/trips で", "参加中の旅行を取得", "旅行と日付を選ぶ"], "client"),
    ("POST .../add-to-trip", ["spotId・tripId・dayId", "滞在時間/移動手段も送れる"], "lib"),
    ("Route Handler", ["getTripRole と", "getSpotListRole を両方確認", "日が旅行のものか検証"], "api"),
    ("spots へコピー", ["saved_spots の内容で", "旅行スコープの行を作る", "(参照ではなく複製)"], "db"),
    ("itinerary_items に INSERT", ["その日の末尾に order 採番", "→ 行程と地図に反映"], "db"),
], h=104)
b.append(row)

# --- 4. 共有 ----------------------------------------------------------------
b.append(heading(X0, 680, "4", "リストを他の人と共有する", "旅行の招待と同じ仕組み"))
row, _ = steps(X0, 698, [
    ("MembersDialog", ["招待リンクを作成", "role は editor / viewer"], "client"),
    ("POST .../invites", ["token を発行", "spot_list_invites に保存", "有効期限つき"], "api"),
    ("/invites/[token]", ["公開ルート", "未ログインなら sign-in へ"], "server"),
    ("acceptSpotListInvite", ["Server Action", "期限と status を確認"], "server"),
    ("spot_list_members に追加", ["onConflictDoNothing", "status を accepted に"], "db"),
], h=104)
b.append(row)

b.append(note(X0, 880, "リストのスポット (saved_spots) と旅行のスポット (spots) は別テーブル。3 のコピー後は互いに影響しない。"))
b.append(note(X0, 902, "そのため、リスト側のメモは /api/spots/[spotId]、旅行側のメモは /api/trips/[tripId]/spots/[spotId] と別のハンドラが受ける。"))
b.append(note(X0, 924, "どちらのPATCHも部分更新。クライアントは変更したキーだけを送り、ハンドラは送られたキーだけを UPDATE する。"))
b.append(note(X0, 946, "リストの権限は spot_list_members、旅行の権限は trip_members。owner だけがメンバーの権限変更と削除をできる。"))

write(os.path.join(os.path.dirname(os.path.abspath(__file__)), "05-spot-list-flow.svg"),
      svg(W, H, "\n".join(b), "レベル5: 行きたいところリストの処理の流れ",
          "src/components/spots/spot-list-workspace.tsx を起点に、保存・編集・旅行への追加・共有"))
