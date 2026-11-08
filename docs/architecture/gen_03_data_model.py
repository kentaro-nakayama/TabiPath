"""レベル3: データモデル (src/db/schema.ts)"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from svglib import *  # noqa

W, H = 1400, 1000
b = []
pos = {}


def put(key, x, y, w, name, cols, style="db"):
    svg_, h = table(x, y, w, name, cols, style=style)
    b.append(svg_)
    pos[key] = (x, y, w, h)


b.append(group(40, 110, 700, 790, "旅行まわり", color="#3fb950"))
b.append(group(790, 110, 570, 600, "行きたいところリストまわり", color="#39c5cf"))

put("trips", 70, 160, 270, "trips", [
    ("id", "uuid PK"), ("name", ""), ("description", ""),
    ("start_date", "date?"), ("end_date", "date?"),
    ("owner_id", "Clerk user id"),
    ("created_at / updated_at", ""),
])
put("trip_members", 70, 400, 270, "trip_members", [
    ("id", "uuid PK"), ("trip_id", "FK → trips"), ("user_id", "Clerk user id"),
    ("role", "owner/editor/viewer"), ("joined_at", ""),
], style="lib")
put("invites", 70, 610, 270, "invites", [
    ("id", "uuid PK"), ("trip_id", "FK → trips"), ("role", ""),
    ("invited_by_user_id", "Clerk user id"), ("token", "unique"),
    ("status", "pending/accepted/expired"), ("expires_at", ""),
], style="api")
put("itinerary_days", 400, 160, 280, "itinerary_days", [
    ("id", "uuid PK"), ("trip_id", "FK → trips"), ("date", "date?"),
    ("day_index", "unique(trip_id, day_index)"),
])
put("itinerary_items", 400, 360, 280, "itinerary_items", [
    ("id", "uuid PK"), ("itinerary_day_id", "FK → itinerary_days"),
    ("spot_id", "FK → spots"), ("order", "unique(day_id, order)"),
    ("start_time", "time?"), ("duration_minutes", "int?"),
    ("travel_mode", "walking/driving/transit/bicycling"),
])
put("spots", 400, 640, 280, "spots", [
    ("id", "uuid PK"), ("trip_id", "FK → trips"), ("name", ""),
    ("address / lat / lng", ""), ("google_place_id", "独自登録なら null"),
    ("notes", "メモ"), ("created_by_user_id", "Clerk user id"),
])

put("spot_lists", 820, 160, 250, "spot_lists", [
    ("id", "uuid PK"), ("user_id", "作成者"), ("name", ""), ("description", ""),
], style="lib")
put("spot_list_members", 820, 330, 250, "spot_list_members", [
    ("id", "uuid PK"), ("spot_list_id", "FK"), ("user_id", "Clerk"), ("role", ""),
], style="lib")
put("spot_list_invites", 820, 500, 250, "spot_list_invites", [
    ("id", "uuid PK"), ("spot_list_id", "FK"), ("token", "unique"),
    ("status", ""), ("expires_at", ""),
], style="api")
put("saved_spots", 1110, 160, 230, "saved_spots", [
    ("id", "uuid PK"), ("spot_list_id", "FK"), ("name", ""),
    ("address / lat / lng", ""), ("google_place_id", ""), ("notes", "メモ"),
])


def bottom(k):
    x, y, w, h = pos[k]
    return x + w / 2, y + h


def top(k):
    x, y, w, h = pos[k]
    return x + w / 2, y


def right(k, ry=None):
    x, y, w, h = pos[k]
    return x + w, (ry if ry is not None else y + h / 2)


def left(k, ry=None):
    x, y, w, h = pos[k]
    return x, (ry if ry is not None else y + h / 2)


# 旅行まわりのリレーション
b.append(arrow(*bottom("trips"), *top("trip_members"), "1 : N", label_dy=-4))
b.append(elbow([(70, 230), (56, 230), (56, 672), (70, 672)],
               "1 : N", label_at=(56, 560), label_dy=0))
b.append(arrow(*right("trips", 230), *left("itinerary_days", 230), "1 : N", label_dy=-7))
b.append(elbow([(340, 270), (370, 270), (370, 700), (400, 700)], "1 : N",
               label_at=(370, 560), label_dy=0))
b.append(arrow(*bottom("itinerary_days"), *top("itinerary_items"), "1 : N", label_dy=-4))
b.append(elbow([(right("spots")[0], 700), (710, 700), (710, 470), (680, 470)], "1 : N",
               label_at=(712, 590), label_dy=0, label_anchor="start"))

# リストまわりのリレーション
b.append(arrow(*bottom("spot_lists"), *top("spot_list_members"), "1 : N", label_dy=-4))
b.append(elbow([(840, 290), (800, 290), (800, 500)], "1 : N", label_at=(800, 420), label_dy=0))
b.append(arrow(*right("spot_lists", 210), *left("saved_spots", 210), "1 : N", label_dy=-7))

# コピー関係
b.append(elbow([(1225, 296), (1225, 330), (1120, 330), (1120, 800), (540, 800), (540, 778)],
               "add-to-trip 時に内容を spots へコピー (参照ではない)", dashed=True,
               label_at=(860, 800), label_dy=-8))

b.append(box(820, 630, 520, 66, "Clerk 側に持つ情報 (DBには無い)", [
    "user_id の実体は Clerk のID。表示名/アバター/ヒント既読は publicMetadata。",
], style="external"))

b.append(note(40, 930, "FK はすべて ON DELETE CASCADE。旅行を消すと日程・行程・スポット・招待・メンバーがまとめて消える。"))
b.append(note(40, 952, "itinerary_items.order が訪問順の正であり、地図のピン番号とルート線もこの順に従う。start_time は任意の付加情報。"))
b.append(note(40, 974, "行きたいところリスト (saved_spots) と旅行のスポット (spots) は別テーブル。リストから行程へ追加した時点で複製される。"))

write(os.path.join(os.path.dirname(os.path.abspath(__file__)), "03-data-model.svg"),
      svg(W, H, "\n".join(b), "レベル3: データモデル",
          "src/db/schema.ts — テーブルと関係"))
