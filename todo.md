# 今後実装したい機能一覧

## ここに書いてある命令については，一個一個が終了した時点でテストして，問題なければ適切なコメントをつけてプッシュまで実行してください

## 特に指定がない限り，実装しやすい順番で実装してください．

## 全体的な実装

## 解決済み（原因特定）
- 移動時間を計算する機能について，電車と自転車での所要時間が取得できない件 → **2026-10-26に原因特定。コード側の不具合ではなく、Google Maps Platform側の提供範囲の問題。下記参照。**

  ### 結論（2026-10-26調査・確定）
  本番環境（tabipath.app）のページ上で、アプリと同一のAPIキー・同一の呼び出し（`routes`ライブラリの`DistanceMatrixService`）を使い、地域×モードの実測を行った。

  **電車（TRANSIT）：日本国内は全滅、海外は正常。Googleの仕様であり修正不可能。**

  | 区間 | WALKING | DRIVING | TRANSIT |
  |---|---|---|---|
  | 京都 京都駅→清水寺 | OK 51分 | OK 13分 | **ZERO_RESULTS** |
  | 東京 東京駅→渋谷駅 | OK 1時間47分 | OK 20分 | **ZERO_RESULTS** |
  | 大阪 大阪駅→難波駅 | OK 1時間2分 | OK 15分 | **ZERO_RESULTS** |
  | 福岡 福岡空港→博多駅 | OK 1時間5分 | OK 17分 | **ZERO_RESULTS** |
  | NY GrandCentral→TimesSq | - | - | **OK 10分** |
  | London Westminster→Oxford | - | - | **OK 18分** |
  | Paris Chatelet→Opera | - | - | **OK 11分** |

  - 同一キーで海外は成功するため、**APIキー・プロジェクト・クォータ・コードのいずれも原因ではない**。
  - Routes APIの提供範囲は「Japan partnersを除く全Google交通機関パートナー」と明記されており、**日本の交通機関データはDirections/Routes APIには提供されていない**（消費者向けGoogleマップアプリでは使えるがAPIでは使えない）。
  - **2026-09-25の「福岡では成功していた」という推測は誤りだった。** 福岡もZERO_RESULTS。地域差ではなく日本全域で不可。
  - **したがってGoogleサポートへの問い合わせ（前回の「次のアクション」）は不要。** 仕様上の制限であり、サポートで解除できるものではない。

  **自転車（BICYCLING）：日本国内は都市によって提供有無が分かれる（部分提供）。**

  | 都市 | 結果 |
  |---|---|
  | 東京 / 大阪 / 名古屋 / 横浜 / 神戸 / 札幌 / 福岡 | **OK**（7〜36分） |
  | 京都 / 広島 / 奈良 / 大津 | **ZERO_RESULTS** |

  - 京都は4区間（京都駅→清水寺、→二条城、→金閣寺、清水寺→八坂神社、京都駅→四条烏丸）すべて失敗。地点の問題ではなく都市単位で提供されていない。
  - Google公式のカバレッジ表では日本の Biking Directions は「—（未提供）」扱い。主要都市で動くのは事実上のベストエフォートと考えるのが妥当。
  - 2026-09-25に「自転車は解決済み」と判断したのは、たまたま提供エリア（渋谷・新宿）でテストしたため。コミット`96153d9`が直したのは「取得失敗時にダイアログが『計算中...』のまま固まる」UIバグであり、データ提供の有無とは別問題。

  ### UI側の対応（2026-10-26 実装済み）
  根本原因は直せないが、取得失敗時の文言が1種類しかなく「一時的な失敗」と「この地域にデータがない」を
  利用者が区別できなかった点を修正した。
  - `fetchTravelDurationMinutes`（`number | null`を返す）を`fetchTravelDuration`に置き換え、
    `ok` / `unavailable`（`ZERO_RESULTS`）/ `error` を返す`TravelDurationResult`型を導入。
  - `unavailable`のときは「この地域では{移動手段}の所要時間を取得できません」と表示し、
    再試行すれば直るかのような誤解を避ける。`error`は従来どおり「所要時間を取得できませんでした」。
  - 文言は`travelDurationIssueLabel`に集約。移動手段アイコンと並ぶ狭いコネクタ行は`truncate`で
    切れるため、そこだけ短い「この地域では取得できません」を使う（`variant: "short"`）。
  - `travel-connector.tsx`が`DistanceMatrixService`を直接叩いていた重複実装も共通関数に寄せた。
  関連コード：`src/lib/travel-mode.ts`，`src/lib/hooks/use-suggested-start-time.ts`，
  `src/components/trip/travel-connector.tsx`，`src/components/trip/schedule-confirm-dialog.tsx`，
  `src/components/trip/sortable-itinerary-item.tsx`

## 未解決の問題

  ### 調査状況（2026-09-25追記・一部結論が誤り。上記2026-10-26の結論を参照）
  - **自転車**：改めて渋谷駅⇔新宿駅などで再テストし、問題なく取得できることを再確認。前回の修正（コミット`96153d9`）で解決済みと判断してよい。
  - **電車（TRANSIT）**：「たまに成功する」という報告を受け、あえて至近距離（同じ渋谷駅構内の2点、徒歩80m相当）から都心の主要路線（渋谷駅⇔新宿駅、山手線・埼京線で約7分、平日19時台＝運行時間内）まで複数パターンを再テスト。
    - 東京駅⇔渋谷駅（住所ジオコーディング）→ `ZERO_RESULTS`
    - 渋谷駅構内の2点（徒歩80m）→ `ZERO_RESULTS`
    - 渋谷駅⇔新宿駅（Google検索で追加した正確な地点同士、運行時間内）→ `ZERO_RESULTS`
    - → 距離・地点の精度（住所ジオコーディング vs Google検索由来の正確な座標）・リクエスト時刻のいずれも原因ではなく、東京都内のTRANSITルートは現状すべて失敗することを確認。
  - **「取得できる場合がある」の手がかり**：以前のスクリーンショットで福岡（福岡空港⇔ドン・キホーテ博多駅南店など）ではTRANSIT・自転車とも所要時間が表示されていた実績があるため、東京は失敗するが福岡は成功する、という地域差の可能性が高い。GoogleのTransitデータはGTFS提供元（鉄道・バス事業者）ごとにGoogleとのデータ提供契約が別々であり、このGoogle Cloudプロジェクト（このAPIキー）が持つTransitデータのアクセス権が、事業者・地域によって異なる（西鉄・福岡市地下鉄など福岡の事業者は提供されているが、JR東日本・東京メトロなど東京の事業者は提供されていない可能性）と推測される。
  - **結論**：コード側の不具合ではなく、Google Cloud側のTransitデータ提供範囲（地域・事業者単位）に起因する可能性が高いという従来の結論を補強。加えて「東京は失敗、福岡は成功」という具体的な地域差の手がかりが新たに得られた。次の問い合わせ時にはこの地域差についても言及するとよい。

  ### 調査状況（2026-09-24時点）
  - **自転車**：Google Distance Matrix APIで複数ルートをテストしたが問題なく取得できた。コード側の不具合として，取得失敗時に`ScheduleConfirmDialog`が「計算中...」のまま固まってしまう問題を発見・修正済み（コミット`96153d9`）。自転車が失敗して見えたのはこのバグが原因だった可能性が高い。
  - **電車（TRANSIT）**：コード側は正常。原因はGoogle Cloud側の設定・データ提供の問題と特定。
    - 当初：Directions APIが無効化されており`REQUEST_DENIED`
    - Directions API有効化後：`ZERO_RESULTS`（エラーは変化したが解決せず）
    - Routes API有効化後，新しい`computeRouteMatrix`を直接呼び出して再検証 → `condition: "ROUTE_NOT_FOUND"`（新旧どちらのAPIでも失敗）
    - API有効化・キー制限・割り当て（クォータ）を確認したが問題なし
    - テスト区間：東京駅⇔渋谷駅，新宿駅⇔渋谷駅など，本来Googleが高精度にカバーしているはずの都心区間でも再現
  - **結論**：コンソールの設定項目では解決できない，アカウント/プロジェクト単位のTransitデータ提供に関する制限の可能性が高い。
  - **次のアクション（要対応）**：Google Maps Platformサポート/Google Cloudサポートに、以下を添えて問い合わせる。
    - 徒歩・車・自転車は同一キー・同一プロジェクトで正常動作している
    - Distance Matrix API（legacy）のTRANSITモード → `ZERO_RESULTS`
    - Routes APIの`computeRouteMatrix`のTRANSITモード → `condition: ROUTE_NOT_FOUND`
    - 対象区間の具体例（東京駅⇔渋谷駅など）
  - 関連コード：`src/lib/travel-mode.ts`（`fetchTravelDurationMinutes`），`src/components/trip/travel-connector.tsx`，`src/lib/hooks/use-suggested-start-time.ts`




