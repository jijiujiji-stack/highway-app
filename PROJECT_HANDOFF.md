# PROJECT_HANDOFF.md

## プロジェクト名

高速・下道コスパナビ

---

## 目的

現在地または出発地から目的地までの移動について、以下を比較し、時間・料金・コスパの観点から判断できるようにするWebアプリです。

- 高速利用
- 有料回避
- 途中ICから乗る入口比較
- 途中ICで降りる出口比較

想定利用は、iPhoneでアプリ画面を見ながら、別途Googleマップ等でナビを行う運用です。

---

## 主要ファイル

### index.html

画面構造を定義します。

主な要素：

- ダッシュボードカード
- 検索エリア
- 出発地・目的地入力
- 許容遅れ設定
- 入口比較・出口比較の切替UI
- 複数IC比較カード
- 旧表示パネル
- デバッグ用 `<details>` エリア

現在、旧パネルの多くは `old-feature-hidden` クラスで通常画面から非表示化されています。

---

### app.js

アプリ本体のロジックです。

非常に大きなファイルで、以下を含みます。

- Google Maps / Routes API 呼び出し
- 高速利用ルート取得
- 有料回避ルート取得
- 通常検索
- 入口比較
- 出口比較
- Polyline解析
- IC候補選定
- 首都高IC判定
- NEXCO IC判定
- GPS取得
- 自動更新
- Wake Lock制御
- ダッシュボード表示
- API使用量トラッキング
- デバッグ・診断機能

---

### style.css

画面のスタイルを定義します。

主な要素：

- ダークテーマ
- ダッシュボードカード
- 検索フォーム
- 比較カード
- 結果表示
- 色分け表示

---

### config.js

Google Maps APIキーを保持する設定ファイルです。

GitHub Pagesの静的Webアプリであるため、ブラウザからAPIキーが見える前提です。

Google Cloud側で以下の制限を維持します。

- HTTPリファラー制限
- 利用API制限
- 使用量監視
- 予算アラート

---

## 現在の設計方針

現在の主役は、Google Routes API の polyline 解析です。

旧来の「目的地から距離だけで方面判定する方式」は、主役ではなくフォールバック・補助扱いです。

**2026-07-18時点の補足**：上記はIC候補選定（入口比較・出口比較）についての方針です。料金計算・トップパネル表示・「有料道路を使用していません」判定については、Routes APIの`navigationInstruction.instructions`内「有料区間」タグを見るTOLL TAG方式が主軸になっています（直近の大きな変更13参照）。座標ベースのpolyline解析（`shutoSegments`等）は、これらの用途では診断・フォールバック用に後退しています。

主な比較モードは以下です。

### 通常検索

現在地または出発地から目的地までについて、以下を比較します。

- 高速利用
- 有料回避

表示例：

- 所要時間
- 距離
- 概算ETC料金
- 時間差
- コスパ判定
- 想定ルート

---

### 入口比較

下道走行中に、どのICから高速に乗るべきかを比較します。

基本構造：

```text
現在地 → 候補入口ICまで下道
候補入口IC → 目的地側まで高速
目的地側IC → 目的地まで下道
```

入口比較では、首都高入口候補とNEXCO入口候補を組み合わせて比較します。

---

### 出口比較

高速走行中に、この先どのICで降りるべきかを比較します。

基本構造：

```text
現在地 → 候補出口ICまで高速
候補出口IC → 目的地まで下道
```

出口比較候補は、Polyline解析で得た進行方向上のICを使います。

---

## 重要：入口/出口の統括関数

入口比較と出口比較の自動比較は、別々のトップレベル関数ではありません。

統括しているのは以下です。

```js
searchAutoExitIcComparison(...)
```

この関数内で `currentMultiIcMode` を見て、以下を呼び分けます。

```js
if (currentMultiIcMode === "entrance") {
    await searchEntranceIcComparisonV2(...);
} else {
    await searchExitIcComparisonV2(...);
}
```

注意：

```text
searchAutoEntranceIcComparison という関数は存在しません。
```

---

## 候補IC選定パイプライン

現在の候補IC選定の流れは以下です。

```text
Routes APIで高速ルート取得
↓
analyzeHighwayRoutePolyline(highwayRoute)
↓
buildPolylineBasedComparisonIcCandidates(polylineAnalysis)
↓
入口候補：
  filterEntranceCandidatesByRouteSection(...)
  selectLimitedComparisonIcCandidates(...)
↓
出口候補：
  buildForwardExitComparisonIcCandidates(...)
  selectForwardComparisonIcCandidates(...)
↓
selectPolylineBasedMultiIcCandidates(...)
↓
searchEntranceIcComparisonV2(...)
または
searchExitIcComparisonV2(...)
```

---

## 主な関数

### Polyline解析

```js
analyzeHighwayRoutePolyline(highwayRoute)
```

Routes APIから返る高速ルートの polyline を解析し、通過道路・首都高入口・首都高出口・NEXCO入口・NEXCO出口などを推定します。

---

### 候補生成

```js
buildPolylineBasedComparisonIcCandidates(polylineAnalysis)
```

Polyline解析結果をもとに、入口比較・出口比較に使う候補IC群を組み立てます。

---

### 入口候補フィルタ

```js
filterEntranceCandidatesByRouteSection(...)
```

実際に通ったルート区間から外れる入口IC候補を除外します。

直近の改修で、現在地側の首都高入口だけでなく、ルート上の首都高入口候補も追加するようになっています。

---

### 入口候補の件数制限

```js
selectLimitedComparisonIcCandidates(...)
```

入口候補を、Routes APIへ問い合わせる上限件数まで絞ります。

通常3件、実車テストONで5件の上限に関わる重要関数です。

---

### 出口候補の件数制限

```js
selectForwardComparisonIcCandidates(...)
```

出口候補を、現在地から進行方向順・距離順を考慮して上限件数まで絞ります。

---

### 候補数上限

```js
getActiveIcCandidateCount()
```

候補数上限の起点です。

- 通常モード：3件
- 実車テストON / 高データ更新ON：5件

---

### 自動比較統括

```js
searchAutoExitIcComparison(...)
```

入口比較・出口比較の自動比較ボタンから呼ばれる統括関数です。

`currentMultiIcMode` により、入口比較と出口比較を呼び分けます。

---

## API呼び出し数の運用

Google Routes API の呼び出し数を増やさないことが重要です。

現在の方針：

- 通常モード：候補3件
- 実車テストON：候補5件
- 候補IC 1件につき、概ねRoutes API比較リクエスト1回
- 自動テストでAPIを叩かない
- ヘッドレスブラウザで自動実行しない
- 実機・実ブラウザで手動確認する

---

## 首都高ICマスター

首都高ICは主に以下で管理しています。

```js
SHUTO_IC_MASTER
```

現在、首都高ICは段階的に追加・整備済みです。

追加済みの主な範囲：

- 6号向島線 / 6号三郷線
- 7号小松川線
- 9号深川線
- 湾岸線東側
- C2中央環状線 東側 / 北側
- C2中央環状線 西側 / 南側
- C1都心環状線 銀座周辺

直近追加された例：

- 宝町
- 京橋
- 新富町
- 銀座
- 汐留
- 芝公園
- 飯倉
- 堀切JCT・小菅JCT・三宅坂JCT・江戸橋JCT（`connection:true`・`connectedRoads`付き、`checkOrderContinuity`のルート同一性判定=`getRouteIdentity`の起点として登録）

**要フォローアップ**：keiyoエリアの座標修正作業（2026-07-18）で、IC_MASTER内keiyoエリアの「上野（首都高）」スタブの座標を35.708561,139.776389に更新しましたが、SHUTO_IC_MASTER本体側の「上野」エントリ（id: `shuto-1-ueno`）は未修正のままで、値が食い違っています（堤通で過去に発生したのと同種の不整合）。次回、SHUTO_IC_MASTER本体側も合わせて確認・修正するか判断が必要です。

首都高ICでは、以下の属性が重要です。

- `entranceSelectable`
- `exitSelectable`
- `isSelectable`

---

## 直近の大きな変更

### 1. SHUTO_IC_MASTER の整備

首都高ICを段階的に追加しています。

入口専用・出口専用・JCT・座標不安なICを区別しながら登録しています。

---

### 2. 検索条件パネルにPolyline解析結果を表示

通常検索後、検索条件パネルに以下を表示します。

- Polyline解析結果
- 想定道路
- 首都高入口
- 首都高出口
- NEXCO入口
- NEXCO出口
- 出口比較候補

「通常入口 / 通常出口」という表現は紛らわしいため、「NEXCO入口 / NEXCO出口」に変更済みです。

---

### 3. トップパネルの通行順表示を役割別ICベースに整理

Polyline解析の役割別ICを使って、通行順を表示します。

使う役割：

- 首都高入口
- 首都高出口
- NEXCO入口
- 想定道路
- NEXCO出口

---

### 4. 出口比較候補プレビューから出口不可ICを除外

`exitSelectable === false` のICを出口比較候補から除外します。

ただし、`exitSelectable` 未定義のNEXCO ICは除外しません。

---

### 5. 旧パネルを通常画面から非表示化

旧表示は削除せず、`old-feature-hidden` で非表示化しています。

非表示化したもの：

- 高速利用パネル
- 有料回避パネル
- 評価パネル
- 詳細情報

HTML要素・ID・JS更新先は残しています。

---

### 6. 出口比較カードを進行方向順に表示

出口比較カードは、候補選定時のPolyline進行方向順を尊重します。

以前のように `minutesToCandidate` 順で再ソートしません。

---

### 7. 入口比較にルート上の首都高入口候補を追加

以前は入口比較の首都高入口を「現在地最寄り1件」に絞っていました。

現在は、候補数上限を増やさずに以下の構成へ変更済みです。

通常3件：

```text
首都高入口 最大2件
非首都高候補 1件以上
```

実車5件：

```text
首都高入口 最大3件
非首都高候補 2件程度
```

現在地側の首都高入口1件を最優先し、さらにルート上の首都高入口を進行方向順で追加します。

除外条件：

- 重複IC
- JCT
- 後方候補
- `entranceSelectable:false`
- `isSelectable:false`

Routes API候補数上限は変更していません。

---

### 8. V2候補料金計算の共通化と首都高固定料金の整理

入口比較V2・出口比較V2の候補料金計算を、共通ヘルパー `estimateComparisonCandidateToll(...)` に統一しました。

対象：

- `searchEntranceIcComparisonV2`
- `searchExitIcComparisonV2`

この時点では、通常検索の `estimateMainHighwayToll` は未変更でした（後述の9で統一済み）。

首都高固定料金は `SHUTO_TOLL_ESTIMATE_YEN = 1000` を使用します。

料金ルール：

- 首都高IC → 首都高IC：距離ベース概算を重ねず、首都高固定1,000円のみ
- 首都高IC → 非首都高IC：首都高固定1,000円 + NEXCO入口以降の距離ベース概算
- 非首都高IC → 首都高IC：非首都高区間の距離ベース概算 + 首都高固定1,000円
- 非首都高IC → 非首都高IC：従来どおり距離ベース概算

`polylineAnalysis.nexcoEntranceIc` / `nexcoExitIc` を使って、首都高区間への距離ベース二重計上を避けています。

必要なIC情報が取れない場合は、既存の距離（fallbackDistanceMeters）を使うフォールバックがあります。

表示側：

- 入口比較カード：「料金目安：首都高 約1,000円 + 他道路 約◯円」の内訳表示を追加済み
- 出口比較カード：「通常 約◯円 / この出口 約◯円」の料金目安表示を追加済み

API呼び出し数：

Routes API呼び出し数を増やさない方針です。首都高IC同士では、料金概算用の `getHighwayRouteForTollEstimate` を呼ばないため、むしろ呼び出し回数が減る場合があります。

---

### 9. 通常検索側の料金計算もV2候補料金ルールに統一

通常検索の `estimateMainHighwayToll` も、8で共通化した `estimateComparisonCandidateToll(...)` 経由に変更し、V2候補料金と同じ首都高料金ルールに揃えました。

変更点：

- `estimateMainHighwayToll` 内の `startIc → endIc` 直接距離ベース計算（`getHighwayRouteForTollEstimate` 直接呼び出し）を、`estimateComparisonCandidateToll(...)` 呼び出しに変更
- `highwayToll` は `amount - shutoToll` で逆算し、既存の料金内訳表示（トップパネルの「首都高◯ + 高速◯」）にそのまま反映
- `startIc` / `endIc` の決定ロジック、`lastTollStartIcGoogleName` / `lastTollEndIcGoogleName` の保存ロジックは変更していない
- `startIc.googleName === endIc.googleName` の早期returnブロックも変更していない

これにより、通常検索・入口比較V2・出口比較V2の3箇所で首都高料金ルールが揃いました。

- 首都高IC → 首都高IC：首都高固定1,000円のみ
- 首都高IC → 非首都高IC：首都高固定1,000円 + NEXCO入口以降の距離ベース概算
- 非首都高IC → 首都高IC：非首都高区間の距離ベース概算 + 首都高固定1,000円
- 非首都高IC → 非首都高IC：従来どおり距離ベース概算

影響：

- 通常検索のETC概算、トップパネルの料金内訳、出口比較V2の「通常 約◯円」が同じルールで整合するようになった
- 首都高経由ルートのETC概算や出口比較の節約額は、二重計上を避けた結果、以前より下がる場合がある
- Routes API呼び出し数は増やしていない。首都高IC同士では料金概算用ルート取得を避けられる場合がある

---

### 10. IC_MASTER全エリアの座標・構造検証（2026-07-14〜07-16実施）

IC_MASTER内の各エリアについて、座標・`entranceSelectable`/`exitSelectable`等をNEXCO中日本公式サイト・MapFan・Wikipedia等の一次情報で検証し、順次修正・commitしました。

- keiyo（京葉道路）・aqualine（アクアライン）・tateyama（館山道）：全件検証・修正
- 貝塚IC・篠崎ICに、NEXCO方向判定ミラー機構を導入（Phase 1）
- 木更津南IC・富浦IC・君津PA SICに同機構を横展開（Phase 2）
- IC_MASTER内の重複登録判定（`dedupeIcDefinitionsByIdentity`）の優先順位を、道路名ベースの判定に修正
- gaikan（外環）・tokan（東関東道）：全件検証・修正（湾岸習志野IC・湾岸千葉IC・潮来ICのハーフIC化等）
- joban（常磐道）・keno（圏央道）・chuo（中央道）・tomei（東名）・kanetsu（関越道）・joshinetsu（上信越道）：スマートIC全件検証・修正
- joban・keno・chuoの通常IC検証・修正（守谷SA除外・友部SA重複削除、高井戸IC・稲城ICの入口/出口構造修正等）
- 中央道富士吉田線（都留IC・富士吉田西桂SIC・河口湖IC・大月JCT）を新規追加

各エリアの未確認・残課題は「既知の保留事項」に記載しています。

---

### 11. 「参考：高速利用ルート」表示の再設計

`buildAssumedRouteHtml`を、固定テンプレート順（首都高→NEXCO→道路名の固定並び）から、実際の走行順序（`routeTrace`/`roadSwitches`）に基づく組み立てに変更しました。既知の保留事項2「アクアライン系トップパネル表示順」はこれにより解消見込みです（実車確認待ち、後述）。

候補選定・料金計算ロジック（`buildPolylineBasedComparisonIcCandidates`・`estimateComparisonCandidateToll`等）は変更していません。

---

### 12. 「有料道路を使用していません」検出機能の新規実装

高速利用ルートと有料回避ルートのPolylineを直接比較し、実質同一経路であれば「参考：高速利用ルート」欄に「（有料道路を使用していません）」と表示する機能（`isProbablyNoTollRouteByPolylineComparison`）を追加しました。

- 比較方式：既存の`decodeRoutesEncodedPolyline`・`sampleRoutePointsByDistance`・`calculateDistance`を流用し、一定距離間隔でサンプリングした座標同士の近似一致率で判定
- 実装過程で、`getLocalRoute`のフィールドマスクに`routes.polyline.encodedPolyline`が不足しており、判定が常にfalseになるバグを発見・修正
- 旧来の`isProbablyNoTollRouteByMetrics`（所要時間・距離差ベース）・「※有料未使用かも」表示は、関数自体は削除せず残しつつ、表示は新方式に一本化するため無効化
- 閾値（`MATCH_DISTANCE_METERS=50m`・`MATCH_RATIO_THRESHOLD=90%`）は理論的な初期提案値。実車確認での調整が必要（既知の保留事項参照）
- API呼び出し数は増やしていない（既存レスポンスのencodedPolylineを追加でデコードするのみ）

---

### 13. 【最重要・アーキテクチャ変更】TOLL TAG方式への全面移行

Google Routes APIの`routes.legs.steps.navigationInstruction.instructions`に含まれる「有料区間」という固定文言を検出し、高速道路利用判定の主軸に採用する新方式（TOLL TAG方式）を実装しました。

- `detectTollSectionsFromSteps(highwayRoute)`が`tollSections`（区間ごとの道路種別・IC名を含む配列）と`tollEntryCount`を算出する中心関数
- 連続する「有料区間」タグが首都高→NEXCO等、複数の道路種別にまたがる場合は`splitRunByRoadType`でさらに分割し、`classifyStepsByRoadType`のキーワードセット＋sticky（前後補完）分類で道路種別を判定
- 区間の入口・出口IC名は`findNearestIcLabel`が担当。`entranceLat`/`exitLat`が離れているIC（八潮南等）については、両座標への距離を計算し近い方を採用するよう修正済み

以下すべてが、この新方式に切り替わりました（`hasTollSectionStepsData`フラグで有無判定、データがない呼び出し元向けに座標ベースの旧ロジックはフォールバックとして温存）。

- 料金計算：`estimateMainHighwayTollFromTollSections`（首都高定額・NEXCO距離比例）。`estimateMainHighwayToll`・`getShutoTollEstimateForIcPair`・`estimateComparisonCandidateToll`から呼び出し
- 検索条件パネル：`buildPolylineComparisonSummaryHtml`
- トップパネルの参考ルート表示：`buildAssumedRouteHtmlFromTollSections`（複数区間はpillマーカー表示、NEXCO道路名は`IC_MASTER[sourceAreaKey].label`から解決、不明時は「IC不明」）
- 有料道路使用判定の統一表示：`buildTollUsageSummaryHtml(polylineAnalysis, isOldNoToll)`。「形状判定：◯◯ / TOLLTAG：◯◯」を常に1行表示し、新旧不一致時は`.assumed-route-no-toll-mismatch`で警告色表示。従来2箇所（`displayRouteComparison`・`updateDashboardAssumedRouteForComparisonMode`）に分散していた「有料道路を使用していません」表示ロジックをこの1関数に統一

温存事項（削除していないもの）：

- 旧来の座標ベース判定（`shutoSegments`・進行方向5点ウィンドウ・山型判定・`order`連続性・JCT裏付けチェック・`getAllRouteAnalysisIcDefinitions`ベースの最近傍探索等）は、判定の主軸からは外れ、診断・参考・フォールバック用として関数ごと温存
- `buildNoTollRouteNoteHtml`（旧「有料道路を使用していません」表示関数）も削除せず温存（未使用）

API呼び出し数への影響：

- `getHighwayRoute`・`getHighwayRouteFromGps`のフィールドマスクに`routes.legs.steps.navigationInstruction`・`routes.legs.steps.distanceMeters`・`routes.legs.steps.startLocation`・`routes.legs.steps.endLocation`を追加。既存の1リクエストにフィールドを追加しただけで、**API呼び出し回数は増えていない**

スコープ外（今回は変更していない）：

- 比較機能（入口比較V2・出口比較V2）の候補選定ロジック自体は、旧来の`shutoEntranceIc`/`nexcoEntranceIc`ベースのまま。TOLL TAG方式への移行は料金計算・表示側のみで、候補選定ロジックへの適用は将来的な検討課題として残っています

---

## 最近の手動確認例

### 荒川区役所 → 東京ディズニーランド

想定表示：

```text
首都高 堤通 → 葛西
```

Polyline解析：

- 想定道路：首都高
- 首都高入口：堤通
- 首都高出口：葛西
- NEXCO入口：なし
- NEXCO出口：なし

出口比較候補から `舞浜` は除外済みです。

---

### 荒川区役所 → 幕張メッセ

想定表示：

```text
首都高 堤通 → 湾岸市川 → 篠崎IC → 京葉道路 → 東関東道 → 湾岸千葉IC
```

Polyline解析：

- 想定道路：首都高 → 京葉道路 → 東関東道
- 首都高入口：堤通
- 首都高出口：湾岸市川
- NEXCO入口：篠崎IC
- NEXCO出口：湾岸千葉IC

---

### 荒川区役所 → マザー牧場

以前の表示（固定テンプレート順時代）：

```text
首都高 上野 → 木更津金田IC → アクアライン → 館山道 → 君津PA SIC
```

2026-07-16の`buildAssumedRouteHtml`再設計（直近の大きな変更 11）により、以下の順で表示される見込みです（実車確認待ち）：

```text
首都高 上野 → アクアライン → 木更津金田IC → 館山道 → 君津PA SIC
```

---

### 荒川区役所 → 筑波山

想定表示：

```text
首都高 堤通 → 三郷IC → 常磐道 → 千代田石岡IC
```

自然。OK。

---

### 荒川区役所 → 津久井湖

想定表示：

```text
首都高 上野 → 高井戸IC → 中央道 → 圏央道 → 相模原IC
```

自然。OK。

---

### 荒川区役所 → 熱海城

想定表示：

```text
首都高 上野 → 東京IC → 東名 → 小田厚 → 小田原西IC
```

自然。OK。

---

## 既知の保留事項

### 1. 実車テスト後の表示改善

今後の変更は、実車で使ってみて違和感が出た箇所を小さく修正する方針です。

大改修はしません。

---

### 2. アクアライン系トップパネル表示順（2026-07-16 対応済み・実車確認待ち）

以前は表示順がやや不自然な場合がありました。

以前の表示：

```text
首都高 上野 → 木更津金田IC → アクアライン → 館山道 → 君津PA SIC
```

`buildAssumedRouteHtml`の再設計（直近の大きな変更 11）により、以下の順で表示されるようになったはずです。

```text
首都高 上野 → アクアライン → 木更津金田IC → 館山道 → 君津PA SIC
```

実車での最終確認はまだのため、確認できるまで本項目は残しておきます。

---

### 3. 浦安など入口・出口分離IC対応

浦安は入口と出口の座標が約2km以上離れているため、単一レコードでは扱いづらい可能性があります。

将来的には以下のどちらかを検討します。

- `浦安入口` / `浦安出口` のようなランプ別レコード
- `entrancePoint` / `exitPoint` を持つ設計

今すぐではなく、実車テスト後でよいです。

Claude Codeで2レコード化案を静的調査したが、東行き/西行き/入口/出口が複雑そうなため、現時点では登録保留。

---

### 4. 旧関数・旧CSS・旧HTMLの整理

旧パネルは非表示化済みですが、関数・HTML要素・IDは削除していません。

将来的に不要が確定したら整理を検討します。

ただし、削除は慎重に行います。

---

### 5. 首都高IC追加時の確認ルール

参宮橋として追加候補が出たが、公式上は代々木出入口の可能性が高く、通称・地名と公式IC名が異なるため登録保留。代々木は首都高公式上、入口上り・出口下りのように方向別制約がある可能性があり、現行の`entranceSelectable` / `exitSelectable`だけで雑に登録しない。

首都高IC追加時は、Claude Codeや一般知識だけで登録せず、首都高公式の出入口一覧で正式名称・入口/出口方向を確認し、Google Mapsで座標と`googleName`を確認してから追加する。

座標や方向に不安があるICは、`isSelectable:false`で保留するか、登録しない。

---

### 6. tomei・kanetsu・joshinetsuの通常IC残り検証（未着手）

スマートICは検証済みですが、通常IC（フルIC/ハーフIC判定・座標精度）はまだ未着手です。

---

### 7. tohoku（東北道）：完全未着手

lat/lng自体が未設定のエントリのみで、座標検証以前の段階です。他エリアと同じ手順（NEXCO東日本公式・MapFan等での確認）で座標を確定させる必要があります。

---

### 8. keiyo（京葉道路）エリアの個別残課題（2026-07-18更新）

前回の全件洗い出しで判明したkeiyoエリア14件（京葉道路本体6件＋首都高スタブ8件）のうち、堤通スタブ座標同期・船橋IC/花輪ICのnote追記・上野スタブ座標修正・葛西/湾岸市川/新木場/有明/大井南/空港中央のnote追記・穴川ICの代表点方式実装は完了・commit済みです。残る個別課題は以下の通りです。

- **原木IC・武石IC・松ヶ丘IC**：外部照合（Wikipedia等）を複数回試行したが、フルIC/ハーフICの判定根拠・座標の独立検証は今回も断定できず「不明」のまま。既存の2026-07-14付MapFan検証結果を変更せず維持している
- **穴川IC**：穴川西・穴川中・穴川東の3ランプ座標をWikipedia/MapFan/NAVITIMEで確認し、御殿場IC等と同様の代表点方式（穴川西の入口(上り)/出口(下り)）で座標を更新済み。3ランプの個別分離（mirrorレコード化）は未実施で、将来的に精度を上げる場合は篠崎IC・貝塚ICのisMirror/mirrorOfパターンを応用した再設計が必要（既知の保留事項3「浦安など入口・出口分離IC対応」と同種の課題）
- **有明（首都高）**：Wikipediaで「西行き出口・東行き入口のみのハーフインターチェンジ」と高確信度で確認したが、`entranceSelectable`/`exitSelectable`への反映（貝塚IC・篠崎IC等のmirrorレコード方式の要否含む）はユーザー判断待ちで保留中
- **大井南（首都高）**：2018年4月の湾岸線本線料金所（東行き）撤去に伴う構造変更（東行きは中央環状線・羽田線専用に変更、湾岸線への流入は不可）を確認したが、現在の`googleName`「首都高速湾岸線 大井南出入口」の登録内容への反映要否はユーザー判断待ちで保留中
- **湾岸市川（首都高）**：Wikipediaで「東関東自動車道側の湾岸市川IC（下り方面のみのハーフIC）とは別の施設であり、混同されやすい」と明記されているのを発見。本エントリが指す施設が実在するか、東関道側ICとの取り違えかは同定できておらず、座標は変更せずnoteに留保を明記した状態
- 成田ICと新空港自動車道側との関係（接続構造）の確認が必要（未着手）

---

### 9. joban（常磐道）エリアの残課題（2026-07-18更新）

- 三郷IC・日立中央IC・高萩IC：座標・構造確認が未着手（noteフィールドなし）
- joban内の堤通（首都高）/加平（首都高）スタブ：SHUTO_IC_MASTER本体側は座標修正済みだが、joban側のこの2件の重複スタブは未同期のまま（keiyo側の堤通スタブで発生したのと同種の不整合。8潮南（首都高）スタブは既に同期済み）

---

### 10. keno（圏央道）エリアの残課題

- 座標が片側（入口または出口）のみ確認できているIC：8件
- 幸手IC外回り側の確認
- 東金IC：他路線との混同の疑いあり、要再確認
- 海老名南JCTの確認
- 大栄JCT～松尾横芝IC間：未開通区間（2026年度内開通予定）。開通後に改めて検証が必要

---

### 11. chuo（中央道）エリアの残課題

- 韮崎ICの入口座標（MapFan個別ページが404で未確認）
- 大月ICの下り出口座標（NAVITIMEにURLのみ確認、座標値未取得）
- 一宮御坂ICの出口ページ（MapFanで未特定、NAVITIMEで代替確認のみ）
- 岡谷JCT・松本JCTのIC_MASTER登録要否（松本JCTは2026年7月時点で「仮称・供用日未定」の計画中JCT）
- 谷村PAのスマートIC有無の最終確認（富士吉田線調査時点では「スマートICなし」と暫定判断）

---

### 12. Phase 1適用ICの再検討（優先方向の統一）

蘇我IC・貝塚IC・木更津南IC等、Phase 1で「入口方向優先」基準を適用したICについて、その後確立した「実際の利用方向（下り）優先」基準に合わせて再検討する必要があります。

---

### 13. 「有料道路を使用していません」判定の閾値調整

`MATCH_DISTANCE_METERS=50m`・`MATCH_RATIO_THRESHOLD=90%`は理論的な初期提案値であり、実測データによる裏付けがありません。実車確認で調整が必要です（直近の大きな変更 12参照）。

---

### 14. 富士吉田IC（東富士五湖道路）は範囲外

河口湖ICのすぐ先にある富士吉田ICは、東富士五湖道路の起点であり中央道富士吉田線には属さないため、今回のIC_MASTER追加範囲には含めていません。必要になった場合は別途調査が必要です。

---

### 15. tokan（東関東自動車道）エリアの残課題

- 四街道IC・佐倉IC・酒々井IC・富里IC・成田IC・大栄IC・佐原香取IC・葛西IC・湾岸市川ICの計9件、座標・構造確認が未着手（noteフィールドなし）
- 上記のうち成田ICは、新空港自動車道側との接続関係の確認も必要（既知の保留事項8参照）
- 「湾岸市川IC」という同名施設が首都高速湾岸線側にも登録されている（keiyoエリアの「湾岸市川（首都高）」スタブ）が、Wikipediaによれば東関道側とは別施設であり同定に疑義がある（既知の保留事項8参照）。tokan側の湾岸市川ICを確認する際は、この混同問題も合わせて整理する必要がある

---

### 16. 座標未検証IC全件洗い出し調査（2026-07-16実施）の結果

IC_MASTER・SHUTO_IC_MASTER全件を対象に、noteの有無・内容から座標未検証と判定されるICを機械的スキャン＋個別確認で洗い出しました（tomei・kanetsu・joshinetsu・tohoku・堤通/加平/八潮南は対象外）。エリア別の件数は以下の通りです（joban・keno・chuo・tokanの詳細は既知の保留事項9〜11・15を参照。以下はエリア横断での概数）。

- joban（常磐道）：3件
- keno（圏央道）：16件（うち通常IC10件、JCT等`isSelectable:false`のもの6件）
- chuo（中央道）：1件（木更津JCTの重複登録）
- odawaraAtsugi（小田原厚木道路）：7件（通常IC全件）
- aqualine（アクアライン）：1件（小田原西IC。海ほたるPAはPAのため対応不要と判断済み）
- tokan（東関東道）：9件（既知の保留事項15）
- keiyo（京葉道路）：14件（既知の保留事項8、対応中）
- SHUTO_IC_MASTER：29件（keiyo経由で扱った堤通・上野を除き、大半が未着手。神奈川1号横羽線＝K1系統15件は、今回のkeiyo/八潮南問題と同根の路線のため優先度が高いと考えられる）

**注記**：この件数は、Claude Codeが実際にapp.jsを読んで数えた結果であり、もし別の集計（例：joban10件・keno8件・chuo7件・SHUTO_IC_MASTER11件・aqualine4件、等）が別途存在する場合は、集計方法の前提が異なっている可能性があるため、再確認をお願いします。

---

### 17. 堤通（首都高）スタブの複数エリア重複問題（2026-07-18発覚）

joban側の堤通・加平スタブをSHUTO_IC_MASTER本体側に同期する作業（既知の保留事項9）の過程で、
「堤通（首都高）」スタブが chuo・tomei・aqualine・tokan の4エリアにも存在することが判明しました
（それぞれ app.js 5288・5445・5815・6356行付近）。

keiyoの「上野」、jobanの「堤通・加平」と同種のパターン（IC_MASTER側の複数エリアに散らばった
首都高スタブが、SHUTO_IC_MASTER本体側の座標修正に追従できていない）である可能性が高く、
座標が食い違っていないか個別確認が必要です。

未確認・未着手。次回、該当4エリアの首都高スタブについて、SHUTO_IC_MASTER本体側との座標比較を
行う必要があります。

---

## GitHub Pages / デプロイ

現在の運用：

- GitHub Pages
- branch：master
- folder：root

GitHub Pagesのデプロイが失敗することがありましたが、空コミットや不要ファイル削除後に更新確認済みです。

確認用ファイルとして以下が存在したことがありますが、不要なため削除対象です。

- diff.txt
- diff2.txt
- index.restore.html

これらは今後コミットしないでください。

---

## 作業後の確認コマンド

PowerShellで以下を確認します。

```powershell
git status
git diff --check
Select-String -Path app.js,index.html,style.css -Pattern "鬥|鬮|竊|繝"
git diff --cached --name-only
```

必要に応じて差分確認用ファイルを作る場合：

```powershell
git --no-pager diff -- app.js style.css index.html | Out-File -FilePath diff.txt -Encoding utf8
```

ただし、`diff.txt` はコミットしません。

---

## コミット運用

基本方針：

- 1作業1コミット
- 変更対象ファイルだけ git add
- `git add .` は避ける
- コミット前に `git diff --cached --name-only`
- push前に `git status`

例：

```powershell
git status
git diff --check
git add app.js
git diff --cached --name-only
git commit -m "入口比較の候補表示を調整"
git push origin master
```

---

## Claude Code移行時の注意

Claude Codeは実装担当として使います。

まずは以下の運用を推奨します。

- Claude Codeに作業前の方針を説明させる
- いきなりWriteさせない
- 大きい改修を任せない
- 最初は小さい表示修正のみ任せる
- 差分を必ず人間が確認する
- 必要に応じてChatGPTにも差分レビューを依頼する
- コミットとpushはユーザーが最終確認して行う

---

## 今後の基本方針

次に進める作業は、実車テスト結果に応じた小修正です。

大きな改修よりも、以下を優先します。

- 入口比較の候補順
- 出口比較の候補順
- おすすめ判定の違和感
- トップパネルの通行順表示
- Polyline解析結果の表示確認
- API呼び出し数の維持
- GitHub Pages反映確認

以上。

---

## Claude Code導入状況

2026-07-04時点で、Claude Code Pro連携・リポジトリ読解・CLAUDE.md / PROJECT_HANDOFF.md 読解確認済み。
初回はPowerShell上で動作確認し、VS Code拡張も導入して連携確認を進めています。

---

## Claude Code静的レビュー結果メモ

実施日：2026-07-04。app.jsの静的読解のみによる調査で、API呼び出し・ファイル変更・自動ブラウザ実行は行っていません。

### 1. API呼び出し数に影響する関数

- `getActiveIcCandidateCount()`（app.js:310）：`isRealDriveTestMode` で通常3件／実車テスト5件を切り替える起点。
- `computeRoutes` 呼び出しは7箇所（app.js:4570, 4649, 4731, 6082, 6183, 10466, 10552）。全てキャッシュ層（`createRoutesCacheRequest` / `getCachedRoutesResponse` / `cacheRoutesResponse`）と `incrementRouteRequestUsage("pro"|"ess")` をセットで持つ統一パターン。新規呼び出し追加時はこのパターンを踏襲する必要あり。
- `searchEntranceIcComparisonV2` / `searchExitIcComparisonV2`（app.js:11268, 11508）の候補ループは、候補IC 1件あたり2〜3回のcomputeRoutes呼び出しになる（下道＋高速＋トール概算）。「候補IC 1件≒Routes API 1回」は概算であり、実際は2〜3回である点に注意。
- `runCandidateIcTest()`（app.js:15635）：デバッグボタンから`TEST_DESTINATIONS`約28ルート分のAPIを叩く。手動実行のみに留めること。

### 2. 入口比較・出口比較の候補数制限に関係する関数

- `selectLimitedComparisonIcCandidates`（app.js:8489、入口用）、`selectForwardComparisonIcCandidates`（app.js:8468、出口用）が実際の`maxCount`ゲート。
- `selectLimitedComparisonIcCandidates`内の`reservedNonShutoCount = maxCount >= 5 ? 2 : 1`（app.js:8615-8616）は、`PROD_IC_CANDIDATE_COUNT=5`に決め打ちした分岐。この定数を変更する場合はここも見直しが必要。
- `selectPolylineBasedMultiIcCandidates`（app.js:8661）が入口/出口を`mode`で分岐して上記2関数を呼ぶ統括点。

### 3. 旧ロジックと新ロジックが混在していて壊しやすい箇所

- `searchAutoExitIcComparison`（app.js:15134）は、Polyline解析による新候補と、常に旧来の距離ベース`selectExitCandidatesForAutoExitComparison(...)`（app.js:15326-15336）の両方を計算し、`legacySelectedExits`としてフォールバックに使っている（Polyline解析失敗時のみ使用：app.js:8754-8757）。
- `USE_DISTANCE_ONLY_IC_AREA`（app.js:3、方面=icArea判定用の現役標準ロジック）と、出口比較候補選定における「距離だけ方式」フォールバックは別の距離ベースロジックだが、名前が似ており混同しやすい。
- `filterEntranceCandidatesByRouteSection`（app.js:7554）のJCT除外判定は`/JCT|ジャンクション/i`という表示名の正規表現一致に依存（app.js:7791-7797, 8422-8426）。明示フラグではないため、新規JCT追加時に名称に含めないと除外漏れが起きる。

### 4. 安易に削除してはいけない関数・要素

- `.highway-card` / `.local-card`（`old-feature-hidden`クラス付き）は、通常検索の中核関数`displayRouteComparison`から`document.querySelector`でnullチェックなしに直接参照・書き込みされている（app.js:4931-4953）。HTML側からこの要素を削除すると通常検索フローが例外で壊れるため、見た目だけの非表示ではなく実行時依存がある。
- `selectExitCandidatesForAutoExitComparison`（app.js:10314）：旧ロジックに見えるが、`searchAutoExitIcComparison`のフォールバック元として現役で毎回呼ばれている（app.js:12374, 15327, 15864）。
- `runCandidateIcTest` / `runCandidateIcTestCase`（app.js:15635, 15709）：デバッグ用テストボタンから参照。

### 5. コメントを追加すると将来安全になりそうな箇所

1. `reservedNonShutoCount = maxCount >= 5 ? 2 : 1`（app.js:8615-8616）— `PROD_IC_CANDIDATE_COUNT`との対応関係が読み取れないため、定数変更時に追従すべき旨のコメント。
2. `displayRouteComparison`内の`.highway-card`/`.local-card`直接参照部分（app.js:4931-4953）— 削除すると通常検索が例外で落ちる実行時依存の明記。
3. `legacySelectedExits`が常に計算・フォールバックとして使われている旨（app.js:15326-15344, 8754-8757）— 「未使用の旧関数」に見えて実は現役という誤解防止。
4. `filterEntranceCandidatesByRouteSection`のJCT正規表現除外（app.js:7791-7797）— 新規JCT追加時は表示名にJCT/ジャンクションを含めること、という運用ルールの明記。
5. `searchEntranceIcComparisonV2`/`searchExitIcComparisonV2`のループ内API呼び出し回数（app.js:11317-11380, 11568-11631）— 候補1件＝Routes API最大3回である旨のコメント。
