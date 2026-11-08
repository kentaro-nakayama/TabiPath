"""レベル4: 旅行行程画面で関数がどこから呼ばれて何をするか"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from svglib import *  # noqa
from svglib import _approx_width

W, H = 1400, 980
b = []
X0 = 60

# --- 凡例 -------------------------------------------------------------------
lx = 820
for i, (label, style) in enumerate([
    ("クライアント", "client"), ("TanStack Query", "lib"),
    ("Route Handler", "api"), ("DB", "db"), ("Google Maps", "external"),
]):
    fill, stroke, _ = PALETTE[style]
    b.append(f'<rect x="{lx}" y="38" width="14" height="14" rx="3" fill="{fill}" stroke="{stroke}"/>')
    b.append(text(lx + 20, 50, label, size=10.5, fill=MUTED))
    lx += _approx_width(label, 10.5) + 46

# --- 1. スポットを検索して行程に追加 ---------------------------------------
b.append(heading(X0, 110, "1", "スポットを検索して行程に追加する",
                 "SpotSearch → TripWorkspace → API → 再取得"))
row1, end1 = steps(X0, 128, [
    ("SpotSearch", ["入力のたびに", "useAutocompleteSuggestions", "→ Places Autocomplete"], "client"),
    ("handlePlaceSelect", ["日程が選ばれているか確認", "setPendingPlace で", "確認ダイアログを開く"], "client"),
    ("handleConfirmPlace", ["メモと移動手段を確定", "createSpot.mutateAsync", "を呼ぶ"], "client"),
    ("POST /api/trips/[id]/spots", ["auth() → getTripRole", "editor 以上か判定", "zod で座標と名前を検証"], "api"),
    ("spots に INSERT", ["旅行スコープの", "スポット行を作る", "→ 作成した行を返す"], "db"),
])
b.append(row1)

b.append(elbow([(end1, 180), (1352, 180), (1352, 244), (40, 244), (40, 308), (X0, 308)]))
row2, end2 = steps(X0, 256, [
    ("setPendingSchedule", ["ScheduleConfirmDialog", "を開く"], "client"),
    ("useSuggestedStartTime", ["前のスポットからの", "fetchTravelDuration", "→ Distance Matrix"], "external"),
    ("handleConfirmSchedule", ["開始時刻・滞在時間を確定", "addItem.mutateAsync"], "client"),
    ("POST .../itinerary", ["その日の末尾の order+1", "を採番して登録"], "api"),
    ("itinerary_items に INSERT", ["order / start_time", "duration_minutes", "travel_mode を保存"], "db"),
], h=104)
b.append(row2)

b.append(elbow([(end2, 308), (1352, 308), (1352, 372), (40, 372), (40, 436), (X0, 436)]))
row3, _ = steps(X0, 384, [
    ("invalidate()", ["queryKey ['trip', tripId]", "を無効化"], "lib"),
    ("GET /api/trips/[id]", ["loadTripDetail で", "日程・行程・スポットを", "まとめて取得"], "api"),
    ("DayColumn", ["その日の行程を描画", "withDepartureNormalized で", "1件目を出発地点扱い"], "client"),
    ("TripMap", ["order どおりにピン", "Polyline でルート線", "FitBoundsToPins"], "client"),
    ("TravelConnector", ["区間ごとに", "fetchTravelDuration", "所要時間を表示"], "external"),
], h=104)
b.append(row3)

# --- 2. 並び替え ------------------------------------------------------------
b.append(heading(X0, 530, "2", "行程を並び替える", "楽観更新 — 先に画面、あとからサーバー"))
row4, _ = steps(X0, 548, [
    ("DayColumn (dnd-kit)", ["ドラッグ完了で", "onReorder に新しい並びを渡す"], "client"),
    ("reorder.mutate", ["onMutate で reorderDayItems", "→ キャッシュを即差し替え", "previous を退避"], "lib"),
    ("PATCH .../itinerary/reorder", ["(day, order) の一意制約を避け", "一度負数へ退避→連番を振り直す", "db.batch() で1往復"], "api"),
    ("itinerary_items を UPDATE", ["order を 0,1,2… に"], "db"),
    ("失敗したら巻き戻し", ["previous をキャッシュに戻す", "成功時は invalidate で再取得"], "client"),
], h=104)
b.append(row4)

# --- 3. メモ・移動手段 ------------------------------------------------------
b.append(heading(X0, 700, "3", "メモと移動手段を編集する", "部分更新のPATCH"))
row5, _ = steps(X0, 718, [
    ("SortableItineraryItem", ["メモ欄で保存を押す", "/ 移動手段を選ぶ"], "client"),
    ("updateSpotNotes", ["PATCH /api/trips/[id]/", "spots/[spotId]", "{ notes } だけを送る"], "lib"),
    ("updateTravelMode", ["PATCH .../itinerary/[itemId]", "{ travelMode } だけを送る", "こちらも楽観更新"], "lib"),
    ("送られたキーだけ UPDATE", ["zod はすべて optional", "空ボディは400で弾く"], "api"),
    ("spots.notes /", ["itinerary_items.travel_mode", "を更新 → invalidate"], "db"),
], h=104)
b.append(row5)

b.append(note(X0, 890, "どの Route Handler も auth() → getTripRole で editor 以上か確認 → zod 検証 → Drizzle で更新、の順。viewer は読み取りのみ。"))
b.append(note(X0, 912, "所要時間 (Distance Matrix) と検索 (Places) はブラウザから直接呼ぶため、サーバーにもDBにも残らない。"))
b.append(note(X0, 934, "サーバー側の初期データは page.tsx が渡す initial。以降は TanStack Query のキャッシュが画面の正になる。"))

write(os.path.join(os.path.dirname(os.path.abspath(__file__)), "04-trip-flow.svg"),
      svg(W, H, "\n".join(b),
          "レベル4: 旅行行程画面の処理の流れ",
          "src/components/trip/trip-workspace.tsx を起点に、関数 → API → DB → 再描画まで"))
