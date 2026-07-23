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

### 17. 堤通（首都高）スタブの複数エリア重複問題（2026-07-18発覚、2026-07-19大部分解消）

keiyo・joban・chuo・tomei・aqualine・tokan の6エリアに「堤通（首都高）」スタブが存在し、
SHUTO_IC_MASTER本体側（shuto-6-tsutsumidori、MapFan検証済み、35.7357056,139.8150419）と
座標が食い違っていた（約548m差）。

2026-07-19時点で、joban・chuo・tomei・aqualine・tokan の座標をSHUTO_IC_MASTER側に同期済み
（keiyoは既に対応済みだったため対象外）。**堤通については全6エリアで解消済み。**

なお、chuo・tomei・aqualine・tokan の各エリアには、堤通以外にも「上野（首都高）」
「高井戸（首都高）」「外苑（首都高）」「代官町（首都高）」「一ツ橋（首都高）」等の
首都高スタブが存在する。これらはchuo側で確認した限り、各エリアとSHUTO_IC_MASTER側の座標が
一致しているが、**両者とも未検証のプレースホルダー値を共有しているだけ**であり、
根本的な検証（MapFan等での座標確認）はまだ行われていない。SHUTO_IC_MASTER側が将来検証・
修正された際に、同じ「他エリア側が追従できていない」問題が再発する可能性がある。
tomei・aqualine・tokan側でこれら5件の座標がchuo側と同一かどうかは未確認。

---

### 18. kenoエリアの残タスク（2026-07-19時点）

kenoエリアの通常IC10件は座標検証・修正済み（既知の保留事項10は該当部分解消）。以下が残タスク。

- **JCT6件が未着手**：海老名JCT・八王子JCT・久喜白岡JCT・つくばJCT・大栄JCT・東金JCT。
  いずれも`isSelectable:false`で候補選定には使われないため優先度は相対的に低いが、
  noteフィールドが存在せず未検証のまま。
- **海老名南JCTが未登録**：新東名高速道路と圏央道を結ぶ実在のJCT（海老名JCTとは別施設）。
  IC_MASTERに登録されていない。新規登録するかどうかはユーザー判断待ち。
- **東金ICの「他路線との混同」の実害未確認**：千葉東金道路にも同名「東金IC」が別施設として
  存在すること（約600m離れた別の料金所・IC番号）をnoteに明記済みだが、これがアプリの
  候補選定ロジックに実害を及ぼしていないかは未検証（座標調査のみで、ロジック面は未確認）。

**2026-07-22追記・JCT座標登録状況の棚卸し結果**：既知の保留事項26関連の実車確認（荒川区役所→松本城）で、区間境界の判定精度を調査する過程で、IC_MASTER・SHUTO_IC_MASTER内のJCTエントリ（真のJCTは14件：SHUTO4件・keno8件・tohoku1件・chuo1件）を全件棚卸しした。

- 出典付きで検証済みと言えるのは6件（SHUTO側の堀切JCT・小菅JCT・江戸橋JCT・三宅坂JCT、chuoの大月JCT、kenoの鶴ヶ島JCT）のみ
- 郡山JCT（tohoku）は既存のnoteに「他情報源では最大約700m程度のばらつき」「ダブルトランペット型のため代表点の取り方は要再検討」と記載があり、要再検討フラグ付き
- kenoエリアの残り7件（海老名JCT・八王子JCT・久喜白岡JCT・つくばJCT・大栄JCT・東金JCT・木更津JCT）は全てnote欄が空の未検証丸め値であり、本項目（既知の保留事項18）で既に「未着手」と記録されている通り
- **新規発見**：「藤岡JCT」（関越道・上信越道の分岐点）が、IC_MASTER内のどのエリアにも一切登録されていないことが判明した。既存の未登録JCT（海老名南JCT・岡谷JCT・松本JCT、既知の保留事項10・11・18・19参照）に加わる、新たな未登録JCTである。松本城ルートの実車確認で、この地点の代わりに1,435m離れた「藤岡IC」が区間境界として拾われる事象が発生した
- JCT専用テーブル（`JCT_MASTER`）への分離は、既存の`getAllRouteAnalysisIcDefinitions()`等が既にJCTを正しく候補として拾えていること（`isSelectable:false`によるフィルタは行われていない）、分離作業のコストが既存の複数関数（`dedupeIcDefinitionsByIdentity()`・`filterEntranceCandidatesByRouteSection()`等）の呼び出し元整理を伴い大規模リファクタリングに相当するリスクがあることから、現時点では見送りが妥当と判断した。当面は、既存のIC_MASTER/SHUTO_IC_MASTER構造のまま、JCT14件の座標検証（特にkenoエリアの未検証7件）を優先タスクとして進める方針とする

---

### 19. chuoエリアの未登録3件（2026-07-19発覚）

既知の保留事項11に記載の「岡谷JCT・松本JCTのIC_MASTER登録要否」「谷村PAのスマートIC有無」
について、コード確認の結果、以下3件はいずれも**IC_MASTER内に一切登録されていない**ことが
判明した。

- **岡谷JCT**：未登録。「岡谷IC」（長野自動車道）は登録済みで、noteに岡谷JCTとは別施設である
  旨の記載あり。
- **松本JCT**：未登録。「松本IC」（長野自動車道）は登録済み。松本JCTは2026年7月時点で
  「仮称・供用日未定」の計画中JCT。
- **谷村PA**：ファイル全体を検索しても存在せず、PA・SICいずれの形でも未登録。

3件とも新規登録するかどうかはユーザー判断待ち。登録する場合、CLAUDE.mdの慎重な追加ルール
（首都高公式・NEXCO公式での正式名称・座標確認を経ること）に従う必要がある。特に松本JCTは
供用日未定の計画中施設のため、登録するとしても`isSelectable:false`等の扱いを検討する必要が
ある。

---

### 20. chuoエリア部分検証5件の未解決状況（2026-07-19時点）

大月IC・一宮御坂IC・笛吹八代SIC・韮崎IC・諏訪湖SICの5件について、2回にわたる外部照合を
行ったが、確信を持って採用できる座標修正には至らず、座標値は変更せずnoteに調査結果のみ
追記した。個別の状況は以下の通り。

- **大月IC**：下り出口の参考座標は得られたが、NAVITIMEへの直接アクセスができず信頼度は中程度。
  採用は見送り。
- **一宮御坂IC**：出口座標の新情報は得られず。既存のNAVITIME代替値を暫定使用継続。
- **笛吹八代IC**：入口(上り)・出口(下り)の個別座標は今回も確認できず。MapFanに該当ページが
  存在しない可能性が高い。中間点暫定値を継続。
- **韮崎IC**：入口座標について矛盾する2つの候補（NAVITIME上り入口／URLデコードで得た下り入口）
  が判明し、かえって不確実性が増した。現地写真・NEXCO資料等での追加裏付けが必要。要ユーザー判断。
- **諏訪湖SIC**：座標未確認のまま。2025年7月27日開通と日が浅く、地図サービス側の座標データ
  整備が追いついていない可能性が高い。数ヶ月後の再調査を推奨。

全般に、NAVITIME側がWebFetchを403で拒否するため検索エンジン経由の値に頼らざるを得ず、
MapFan直接確認済みの値と比べて信頼度が一段低い点に留意。人間による実際のブラウザでの
再確認が望ましい。

**2026-07-22追記・関連事象**：既知の保留事項26（IC名決定方式の実験）の過程で、荒川区役所→松本城ルートを検証した際、松本IC（chuoエリア）が、IC境界検出パイプライン（Step2、detectIcsNearPolyline）の検出網に引っかからないケースが実際に発生することが確認された。具体的には、ルート全体の候補IC一覧（routeDistanceCandidateIcs）が佐久IC（ルート先頭から約176km地点）までしかカバーしておらず、松本IC（約239km地点、目的地側の出口IC）まで候補が存在しなかった。これにより、区間の出口IC名判定（方式B・方式Aいずれも）が失敗する事象が発生した。本事象は座標登録の精度・網羅性に起因するものであり、IC名判定ロジック自体の不具合ではないと判断している。既知の保留事項19・20に記載の、chuoエリア（特に松本IC・諏訪湖SIC周辺）の座標検証が未完了であることと符合する。今後、chuoエリアの座標検証を進める際は、この事象も踏まえて優先的に確認することが望ましい。

---

### 21. roadSequence/displayRoadSequenceの距離フィルタ欠如問題（2026-07-19発覚）

入口比較候補の再設計（passedIcEntriesベース化）で、findNearestIcMasterEntryForRoutePointに
距離上限が無いこと（isWithinThreshold:falseでも最寄りICとして採用してしまう）が原因の
ノイズ混入を発見・修正した（passedIcEntriesにdistanceMeters/isWithinThresholdを追加し、
入口比較候補生成時にフィルタする対応済み）。

同じ根本原因が、検索条件パネルの「想定道路：」表示等に使われるroadSequence/
displayRoadSequenceにも存在することが判明した。こちらは距離によるフィルタが一切なく、
唯一の補正（correctShortRoadSegments、5km・前後同一ラベルでサンドイッチされている場合のみ）
も「区間の長さ」のみに基づくもので、「個々のサンプル点の距離の信頼度」は見ていない。

実例：荒川区役所→名古屋城のルートで、「想定道路：首都高 → 東名 → 小田厚」のように、
実際には通らないはずの小田原厚木道路（小田厚）が混入する事象を確認した。東名沿線の
IC間隔が広い区間で、地理的に並走する小田原厚木道路側のICが、たまたま最寄りと誤判定
されたことが原因と推測される（「厚木IC」がtomei/odawaraAtsugi両エリアに重複登録されて
いることとも関連する可能性がある）。

影響範囲は表示だけにとどまらない。buildPolylineBasedComparisonIcCandidates内で
candidateAreas（入口・出口比較候補を探すエリア一覧）を決定する際、補正すら経由しない
生のroadSequenceを直接使っており、わずか1サンプル点のノイズで無関係なエリアが
candidateAreasに混入しうる。これは入口比較のフォールバック経路（buildSurroundingCandidates）・
出口比較（buildForwardExitComparisonIcCandidates）双方の候補選定ロジックに影響しうる。

対応は未着手。今後、roadSequence/displayRoadSequenceの構築ロジックにも、passedIcEntriesと
同様のisWithinThresholdベースのフィルタ・除外処理を適用するかどうかの検討が必要。
影響範囲が表示・候補選定ロジック双方にまたがるため、着手時は小差分に分割して進めること。

---

### 22. 料金計算のTOLL TAG方式全面刷新と、テキスト判定の限界（2026-07-19〜20実施）

入口比較の再設計（既知の保留事項の一連の経緯参照）の過程で、料金計算（`tollSections`の道路カテゴリ判定）が座標ベースの`icBasedIsShuto`（距離無制限の最寄りIC判定）に依存しており、アクアラインのような首都高接続部が近い区間で誤判定（首都高固定料金の二重計上、NEXCO距離料金の欠落）を起こすことが判明した。

**完了した対応：**

- `TOLL_ROAD_CATEGORY_RULES`（道路カテゴリごとの料金ルール一覧、首都高固定1,000円・アクアライン固定800円・NEXCO距離比例24円/km）と判定関数`determineTollRoadCategory`を新規追加
- `detectTollSectionsFromSteps`の`isShutoSection`判定を、座標ベースからGoogleの案内テキストベース（`determineTollRoadCategory`）に切り替え
- `estimateMainHighwayTollFromTollSections`を、カテゴリごとの料金ルールを参照する形に変更
- トップパネルの道路名ラベル表示に、個別カテゴリ（アクアライン等）のラベルを反映
- `classifyStepsByRoadType`のステップ単位判定を、`TOLL_ROAD_CATEGORY_RULES`ベースの多値分類（首都高／アクアライン／NEXCO）に変更し、`splitRunByRoadType`（無変更で汎用的に動作）による区間の細分化を実現
- 入口比較・出口比較の候補料金計算（`estimateComparisonCandidateToll`）を、通常検索と同じTOLL TAG方式に統一（候補ルート取得のフィールドマスクに`steps`を追加、フォールバックは廃止しエラー時は明確なエラー状態を返す設計に変更）
- `estimateComparisonCandidateToll`内の首都高利用回数算出を、元検索ルート全体の値ではなく候補固有の値（起点・終点のいずれかが首都高かどうか）に簡略化

**未解決・次回への申し送り：**

テキストキーワードマッチングには限界があることが実車確認で判明した。具体的には、荒川区役所→館山（アクアライン経由）のルートで、木更津JCT以降のstep（`「木更津JCT で 館山自動車道、京葉道路/千葉/館山/かずさアカデミアパーク 方面の標識に従う」`）に「アクアライン」という単語が含まれず、`TOLL_ROAD_CATEGORY_RULES`のいずれのキーワードにも`hasExplicitNexcoSignal`にも一致しないため、sticky継承によって直前のアクアライン区間の分類をそのまま引き継いでしまい、木更津JCT以降（実際は館山道、距離ベース料金がかかるべき区間）もアクアライン固定800円の一部として扱われてしまう（本来かかるはずの距離料金が欠落したまま）。

**次回の設計方針（合意済み、未着手）：**

テキストキーワード判定から、**IC境界ベースの判定**への転換を行う。具体的には：

- `TOLL_ROAD_CATEGORY_RULES`の各カテゴリに、キーワードの代わりに「境界となるIC名」（例：アクアラインなら`浮島IC`・`木更津金田IC`）を持たせる
- 区間の入口・出口IC名前解決（`findNearestIcLabel`、座標ベース、既存の仕組みをそのまま流用）の結果を使い、区間の`entranceIc`/`exitIc`が、あるカテゴリの境界IC名と一致するかどうかで、その区間のカテゴリを判定する
- テキストの表記ゆれ（「アクアライン」「東京湾アクアライン」「方面」の有無等）に一切左右されなくなる
- 将来、明石海峡大橋等の特別料金道路を追加する際も、境界IC名を登録するだけで対応できる汎用設計になる見込み
- この転換により、現在アクアラインのみ例外的に行っているトップパネルの道路名ラベル表示（`resolveTollSectionRoadLabel`内の個別カテゴリ分岐）も、既存の`resolveTollSectionNexcoRoadLabel`（IC経由の道路名解決、テーブルベース）に統合でき、コードがシンプルになる可能性がある
- ただし、この転換には区間の分割方法自体（現在はステップのテキストで分割している`classifyStepsByRoadType`）の設計変更も伴う可能性があり、次回セッションで腰を据えて設計する必要がある
- 既知の保留事項21（`roadSequence`/`displayRoadSequence`の距離フィルタ欠如問題）とも関連が深く、座標ベースのIC最寄り判定の仕組みを統一的に整理する好機の可能性がある

**2026-07-22追記・解決**：本セッションで解決した。根本原因は、`classifyStepsByRoadType`が木更津JCT以降の曖昧なstepを正しく分類できず、区間全体が"aqualine"のまま確定してしまうことだった。解決手段は、当初合意していた「テキストキーワード判定から境界IC名ベースの判定への全面転換」ではなく、既に実装済みだった境界IC区間再分割（`trySplitNexcoSectionByBoundaryCategory`、既知の保留事項23のStep1〜3）の発動条件を緩和し（`tollCategoryId === "nexco"`限定のガードを撤廃）、かつその距離計算に使う座標データを、精度不足だった案内ステップ単位の粗い点列から、Step1〜7で既に生成されていた密なサンプリング座標（`sampledPoints`）に置き換えることで実現した（詳細は既知の保留事項24の追記を参照）。`classifyStepsByRoadType`のstep単位テキスト判定自体は、区間の「有料/無料の境目」を見つける役割としては引き続き使われており、削除していない。カテゴリの確定（shuto/aqualine/nexcoのいずれか）は、境界IC区間再分割後、`resolveIcTollCategoryId`（IC名からIC_MASTER登録情報を参照するテーブル参照方式）による再判定に置き換わっている。

---

### 23. IC境界ベース新パイプラインの実装・検証結果（2026-07-20実施、2026-07-20訂正）

既知の保留事項22（料金計算のTOLL TAG方式全面刷新）の続きとして、「IC境界ベースの判定」への転換を実装・検証した。

**実装した内容（Step 1〜7、全て新規追加のみ・既存処理には未接続の診断ログ）：**

- `calculateDistanceToLineSegment`・`findShortestDistanceFromIcToPolyline`：点と線分の最短距離計算（Step 1）
- `detectIcsNearPolyline`：登録済み全IC×Polyline全体の「IC→線」距離判定による近接IC検出（Step 2）
- `findClosestPositionOnPolylineForIc`・`detectIcsOrderedAlongPolyline`：検出ICの走行順ソート（Step 3）
- `resolveIcCategoryLabel`・`buildRoadCategorySequenceFromOrderedIcs`：ICの所属道路（IC_MASTER登録情報）による表示用カテゴリ区間列の組み立て（Step 4）
- `buildCumulativeDistanceArray`・`attachRouteDistanceToOrderedIcs`：各ICの出発地からの走行距離付与（Step 5）
- `resolveIcTollCategoryId`・`buildTollCategorySequenceWithDistance`・`estimateTollFromTollCategorySequence`：料金計算用カテゴリ区間列と料金概算（Step 6）
- `buildTollCategorySequenceWithGapDetection`・`findDetectionGapsInOrderedIcs`：検出漏れ区間の可視化・料金への反映（Step 7）

**実車確認の結果（3ルートで検証）：**

「IC検出→走行順ソート→カテゴリ区間列→料金計算」というパイプラインは、**IC_MASTERの整備が進んだ関東近郊のルート（joban・aqualine等）では非常に高精度**だった（スパリゾートハワイアンズ：新方式5,021円 vs 実際5,036円、いずれもほぼ一致）。

鴨川シーワールド（館山）のケースでは、新方式2,839円・本番1,800円と乖離が見られたため、当初は「新方式がアクアライン区間内の検出漏れを誤って汎用NEXCO料金で計算してしまった」と判断したが、これは誤りだった。実際には**本番側の1,800円自体が、既知の保留事項22の未解決バグ（木更津JCT以降がテキスト曖昧判定によりアクアライン区間へsticky継承で誤結合される）の影響で、アクアライン区間が本来15kmのところ26.7kmとして計算されており、圏央道・館山道の距離料金が欠落した不正確な値**だったことが、`[ETC概算 料金計算]`ログの区間内訳（`アクアライン(fixed) 距離26.7km 料金800円`）から確認できた。新方式（2,839円）の方が実態に近い可能性が高い。

名古屋城のケース（カバー率31.2%、検出漏れが大量に発生）についても、これはIC_MASTERにまだ登録されていないICが多いことによる、純粋なデータ整備不足が原因であり、パイプラインのロジック自体の欠陥ではないと判断する。

**結論（訂正）：**

Step 1〜7のIC境界ベースパイプラインは、有効に機能していると判断する。「料金計算を引き算方式に全面転換する」という、前回時点での結論は撤回する。

残る課題は、既知の保留事項22で既に特定済みの「区間分割の精度」（`classifyStepsByRoadType`のテキストキーワード判定が、木更津JCT以降のような曖昧なstepでsticky継承により誤判定するケース）のみであり、これは既に合意済みの「IC境界ベースの判定へのカテゴリ判定転換」（保留事項22の次回の設計方針を参照）で対応する予定。

Step 1〜7で実装した関数群は、そのまま活用する方向で進める（削除・撤回はしない）。名古屋城のような検出漏れが多いケースへの対応（カバー率の低さへの対処）は、IC_MASTER自体の座標整備（keiyo・joban等で行ってきた地道な検証作業）を進めることが本質的な解決策であり、パイプライン側の設計変更では解決しない。

---

### 24. 境界IC区間再分割は本番接続済みだが、ETC概算に未反映（2026-07-20〜21調査中）

既知の保留事項23（訂正版）で記録した通り、境界IC区間再分割（Step1〜3）は実装・本番接続が完了しており、`detectTollSectionsFromSteps`の出力・トップパネルの参考ルート表示・検索条件パネルの首都高/NEXCO入出力表示には、正しく分割結果（アクアライン15.096km＋NEXCO11.575km等）が反映されている。コンソールの`[境界IC区間再分割検証・一時的]`ログも、実際に実行されていることを確認済み。

**しかし、ETC概算（トップパネルに表示される金額）だけが、分割前の古い値（アクアライン26.7km扱い、圏央道・館山道の距離料金が欠落した金額）のまま更新されない**という問題が残っている。

**調査の経緯（複数回、調査結果が実態と食い違った）：**

1. 「`detectTollSectionsFromSteps`が1回の検索で2回呼ばれ、2回目はstepsなしの簡易版」という調査結果が出たが、後の調査で「該当コードは存在しない」と判明（矛盾）
2. 「`estimateMainHighwayToll`が`analyzeHighwayRoutePolyline`より先に実行され、古いグローバル変数を参照している」という仮説を立てたが、実際のコード（app.js:9821-9854）を確認したところ、`analyzeHighwayRoutePolyline`は`estimateMainHighwayToll`より先に実行されており、しかも`lastHighwayRoutePolylineAnalysis`ではなく`polylineAnalysis`（ローカル変数、`analyzeHighwayRoutePolyline`の戻り値）を直接渡していることが確認され、この仮説も誤りだった
3. 実車のスクリーンショットで、実際に出力されているログを確認したところ、`[ETC概算 料金計算]`というログに「首都高利用回数（shutoEntryCount）：2」という、これまで想定していたロジック（`tollCategoryId`ベースの区間分け、境界IC分割後は首都高区間は1つのはず）とは異なる集計方法が使われている可能性が浮上した。**この`[ETC概算 料金計算]`ログを出している関数が、本当に`estimateMainHighwayTollFromTollSections`なのか、それとも別の独立した計算ロジック（`estimateMainHighwayToll`自体が内部で別の計算をしている等）なのかが、まだ特定できていない**

**次回やるべきこと：**

- `grep`で以下の文字列を検索し、実際に`[ETC概算 料金計算]`ログ・`shutoEntryCount`を出力している関数を正確に特定する
  - `"ETC概算 料金計算"`
  - `"shutoEntryCount"`
- 特定できた関数の実装コード全文を確認し、`estimateMainHighwayTollFromTollSections`（境界IC区間再分割済みの`tollSections`を使うはずの関数）との関係を明確にする
- もし別の独立したロジックだった場合、なぜ2つの計算ロジックが存在するのか、どちらが実際に画面に表示される金額を決めているのかを特定した上で、境界IC区間再分割の結果が正しく反映されるよう修正する

**このセッションでの調査の教訓：**

このセッション内では、コンソールログ・grep結果のテキストコピー＆ペーストが複数回にわたって空の状態でしか届かない問題が発生し、正確な調査ができなかった。次回セッションでは、スクリーンショット（画像）での共有を優先するか、新しいセッションでテキストコピーが正常に機能するか確認してから進めることを推奨する。

**2026-07-21 追加調査で判明したこと：**

- `[ETC概算 料金計算]`ログを出しているのは`logMainHighwayTollCalculation`（表示専用）であり、実際の金額計算は`estimateMainHighwayTollFromTollSections`が行っている。`estimateMainHighwayToll`自体には独立した計算ロジックは無いことを確認済み
- `estimateMainHighwayTollFromTollSections`の先頭に、渡された`tollTagResult.tollSections`の件数・各区間の`tollCategoryId`・距離(km)・入口/出口IC名を出力する一時デバッグログ（`[DEBUG 一時的]`）を追加済み（commit済み）

**次回セッションで最初にやること：**

荒川区役所→鴨川シーワールド（またはアクアライン経由の同種のルート）で通常検索を実行し、コンソールの`[DEBUG 一時的]`ログを確認する。

- `tollSections件数：3`（分割済み、アクアライン15km・NEXCO11.5km等）であれば、`estimateMainHighwayTollFromTollSections`には正しいデータが渡っているにもかかわらず、計算結果に反映されていないという、関数内部のロジックの問題に絞り込める
- `tollSections件数：1〜2`（分割前のまま）であれば、`estimateMainHighwayTollFromTollSections`に渡す前の時点で、既に古いデータが使われているという、呼び出し元・データの受け渡し経路の問題に絞り込める

確認後、デバッグログ（`[DEBUG 一時的]`）は役目を終えたら削除してよい。

**2026-07-22追記・方針転換**：この問題の根本原因は、`trySplitNexcoSectionByBoundaryCategory`が使う`sectionPolylinePoints`（案内ステップ単位の粗い座標列）が、高速道路のカーブを正しく近似できていないことだった（木更津金田ICとの距離898mという計算結果自体が、実在しない直線上の点までの距離であったことを、Google Maps上での目視確認で確認済み）。当初「まずアクアライン区間のみの狭いパッチで対応し、IC境界検出パイプライン（Step1〜7、既知の保留事項23）の本番採用は別途検討する」という順序で進めていたが、これは順序が逆だったと判断する。次回セッションでは、`sectionPolylinePoints`の構築元を、Step1〜7が既に使っている密なサンプリング座標（`sampledPoints`、`analyzeHighwayRoutePolyline`内で`decodeRoutesEncodedPolyline`＋`sampleRoutePointsByDistance`により生成済み）から、対象区間に対応する部分を切り出したものに置き換える方向で、統一的に解決する。

**2026-07-22追記・解決**：本セッションで解決した。実施した対応は以下の通り。

1. `trySplitNexcoSectionByBoundaryCategory`のガード条件（`section.tollCategoryId !== "nexco"`）を撤廃し、`boundaryIcNames`を持つカテゴリルールがあれば、区間の現在のカテゴリに関わらず分割を試みるように変更
2. `sectionPolylinePoints`（境界IC分割の距離計算に使う座標データ）を、案内ステップ単位の粗い点列から、`analyzeHighwayRoutePolyline`内で既に生成されている密なサンプリング座標`sampledPoints`（500m間隔）から、区間の累積距離範囲を切り出したものに置き換え。これにより木更津金田ICとの検出距離が898m（実在しない直線上の点までの距離）から37mまで改善し、分割が正しく発動するようになった
3. 境界IC名が区間の入口・出口名と既に一致する場合は、座標の再探索をスキップする対応を追加し、「浮島IC→浮島IC」のような無意味な極小区間が生成される問題を解消
4. 分割後の各サブ区間のtollCategoryIdを、元区間からの引き継ぎではなく`resolveIcTollCategoryId`による再判定に変更し、木更津金田IC以降の区間が正しくNEXCO距離課金として計算されるようになった
5. トップパネルのETC概算内訳表示を、`TOLL_ROAD_CATEGORY_RULES`から汎用的にカテゴリ内訳を導出する方式（`buildTollCategoryBreakdownItems`）に変更し、「首都高1,000 + アクアライン800 + 高速446」のようなカテゴリ別の内訳表示を実現。アクアラインを個別にハードコードせず、将来別の特殊料金区間（例：明石海峡大橋）を`TOLL_ROAD_CATEGORY_RULES`に追加登録するだけで、内訳表示にも自動的に反映される設計とした

実車確認済み（荒川区役所→鴨川シーワールド）：ETC概算が「約2,246円（首都高1,000 + アクアライン800 + 高速446）」と、区間ごとの正確な内訳で表示されることを確認した。

Routes API呼び出し回数は今回の一連の対応を通じて増えていない（既存レスポンス・既に計算済みのデータの再利用のみ）。

副次的な気づき・今後の課題：

- 一時デバッグログ（`[DEBUG2 一時的]`・`[DEBUG3 一時的・境界IC距離確認]`・`[境界IC区間再分割検証・一時的]`等）は、原因調査のために複数箇所へ追加されたままになっている。今後、動作が十分安定していると判断できた段階で、整理・削除を検討する
- 入口比較・出口比較カード側の内訳表示は、V2候補の料金計算が`tollSections`配列を保持しない設計のため、今回作成した汎用内訳表示の仕組みをそのまま転用できていない。将来、V2候補側の料金計算も`tollSections`ベースに揃える場合は、あわせて内訳表示も統一できる可能性がある
- 既知の保留事項26（IC名決定方式の点と点 vs 点と線の精度比較実験）は、今回とは別の未着手の将来課題として残っている

**2026-07-22追記・新たな回帰の発見と原因調査**：本セッションで、既知の保留事項26の実験（方式Bへの統一）を進める過程で、「入谷→浮島IC」区間に新たな不具合が発見された。

- 症状：荒川区役所→鴨川シーワールドルートで、以前は正しく「入谷→浮島IC→木更津金田IC→君津IC」の3区間として計算されていたものが、「入谷→IC不明→浮島IC→木更津金田IC→君津IC」の4区間に変化し、ETC概算が約2,246円から約3,046円に悪化した
- 原因の連鎖：(1) Googleの「有料区間」タグが首都高からアクアラインへ切り替わる境界点（浮島IC付近）で、`findNearestIcByRouteDistance`（方式B）が浮島ICを見つけられず、直近で撤廃した方式Aへのフォールバックもないため、この境界のIC名が「IC不明」になった。(2) これにより、境界IC区間再分割の名前一致スキップ処理（文字列完全一致が前提）が働かなくなり、座標再探索にフォールバックした結果、わずかなズレから意味のない極小区間が生まれた
- 根本原因：浮島IC・浮島JCT周辺は、ランプが複雑に立体交差する構造のため、ルートのpolylineが、浮島ICの登録座標に対して「地図上の距離としては近い（1000m以内）」状態を、道のり29,500m地点から32,500m地点までの約3kmという広い範囲にわたって維持し続けている。方式B（点と点の登録座標を、道のり上のたった1点に投影する）は、この「広い範囲でずっと近い」という状況に対して、投影結果がどこに定まるか不安定になりやすいという弱点があることが判明した。これは既知の保留事項19・20・26で確認済みの、松本IC等における弱点と同種のものである

**解決策の検証（座標平均化案）**：上記の弱点に対応する解決策として、「登録座標から一定距離（1000m）以内にある、道のり上の全ての点の緯度経度を単純平均し、その平均座標を、投影計算の入力として使う」という案を検証した。

- 浮島IC登録座標（35.520593, 139.787833）から1000m以内の7点の緯度経度を単純平均したところ、平均座標（35.518355, 139.792067）は、Google境界座標（35.5184054, 139.7920848）から直線距離でわずか6mという、非常に近い場所になった
- この平均座標を、本番と同じ手順（`findClosestPositionOnPolylineForIc`→`attachRouteDistanceToOrderedIcs`）で道のり位置に変換したところ、30,922.74m地点となり、Google境界座標の道のり位置（30,925.05m地点）との差はわずか2mだった。従来の登録座標そのものを使った場合の差（1,391m、しきい値500m超過）と比べ、大幅に改善することを実データで確認できた
- この「座標平均化」は、近い候補が1件しかない通常のIC（浮島IC・浮島JCT周辺のような複雑な構造でない場所）では、平均を取っても結果が変わらない（1点の平均はその点自体になる）ため、副作用なく適用できる見込みがある

**次回セッションでの実装方針（未着手）**：

- `findNearestIcByRouteDistance`（またはその前段階でIC候補の座標を用意している箇所）で、登録済みIC1件ごとに、そのIC座標から一定距離（1000m目安）以内にある`sampledPoints`が複数存在する場合、それらの緯度経度を単純平均した座標を、投影計算に使うよう変更することを検討する
- 近い点が1件のみ、または0件の場合は、従来通り登録座標をそのまま使う（平均化による副作用を避けるため）
- 実装前に、他のJCT（既知の保留事項18の未検証7件等）でも同様の「広い範囲で近い」現象が起きていないか、`[DEBUG6 一時的・浮島IC複数通過確認]`ログの手法を応用して確認しておくことが望ましい
- 今回追加した一時デバッグログ（`[DEBUG5 一時的・境界点IC名解決調査]`・`[DEBUG6 一時的・浮島IC複数通過確認]`）は、実装時にも参考になる可能性があるため、次回の実装作業が完了するまでは削除せず残しておく

**2026-07-22追記・座標平均化案の追加検証結果（成功・失敗が混在）**：前回記録した「座標平均化案」について、出発地・進行方向を変えた追加ルートで検証したところ、単純な座標平均化だけでは解決しないケースがあることが判明した。前回の「有望な解決策」という評価はやや楽観的すぎたため、ここで訂正する。

検証結果一覧（いずれも浮島IC周辺の境界判定について、Googleの境界座標の道のり位置との差）：

- 荒川区役所→鴨川シーワールド：登録座標そのものでは1,391m差（しきい値超過、失敗）。近傍7点の座標平均を使うと2m差まで改善（成功）
- 台東区根岸→鴨川シーワールド：登録座標そのもので246m差（しきい値内、**そもそも平均化なしで成功**）
- 鴨川シーワールド→荒川区役所（逆方向）：登録座標そのものでは895m差（失敗）。近傍点の座標平均を使っても809m差（**しきい値超過のまま、改善したが不十分**）

分かったこと：

- 出発地・進行方向によって、そもそも失敗するかどうか自体が変わる（500m間隔のサンプリング点を打つ基準が、出発地に応じてズレるため、浮島IC周辺の近傍点の分布自体が毎回変化するとみられる）
- 座標平均化は、ケースによって「大幅に改善する」「わずかに改善するが不十分」の両方が起こりうり、常に有効とは言えない
- したがって、座標平均化を本番ロジックにそのまま組み込むのは時期尚早と判断する。次回セッションでは、以下を検討する必要がある
  - なぜ「鴨川シーワールド→荒川区役所」のケースでは、平均化しても改善が不十分だったのか、追加調査する（近傍点の分布・件数が、順方向のケースと異なる可能性がある）
  - 座標平均化以外の対応策（例えば、以前検討した「前後のIC・道路カテゴリとの整合性から絞り込む」という方向性）も、あわせて再検討する
  - 複数の出発地・複数の方向で、機械的に多数のルートを検証できる仕組み（手動で1つずつ実車確認する以外の方法）があると、この種の検証がしやすくなる可能性がある

**2026-07-22追記・影響範囲の再確認と、不安定さの構造的な原因について**：座標平均化案の実装方針を検討する過程で、以下の2点を確認・整理した。

1. **影響範囲の再確認（改善のリスクは低いことを確認）**：`findNearestIcByRouteDistance`（今回問題になっている、道のり位置ベースのIC名解決）は、`detectTollSectionsFromSteps`内でGoogleの「有料区間」タグが切り替わる境界点でのみ呼ばれており、ルート全体を通した全IC検出（Step1〜7、`detectIcsNearPolyline`等）とは、コード上完全に独立している。既知の保留事項26で確認された「代官町→北の丸」のような、密集エリアでの取り違え事例は、Step1〜7側の実験（点と点の全IC総当たり判定）で発生したものであり、`findNearestIcByRouteDistance`の改善（座標平均化等）を行っても、Step1〜7側の候補検出・表示には一切影響しない。したがって、この境界判定専用の改善は、密集エリアでの精度に対するリスクを伴わないと判断できる

2. **不安定さの構造的な原因**：登録済みIC（例：浮島IC）の座標そのものはテーブル上で固定だが、その座標を「ルートのpolylineに投影した、道のり上の代表位置」は、検索するルートが変わるたびに毎回計算し直される。浮島IC周辺のように、polylineが同じICの近くを広い範囲・複数回にわたって通過する構造では、この投影結果（＝そのルートにおける「浮島ICの代表地点」）が、ルートのわずかな違い（出発地・進行方向等）によって不安定に変動しうる。これが、既知の保留事項24で確認した「荒川区役所発では失敗するが、台東区根岸発では成功する」といった、ルートによって成功・失敗が入れ替わる現象の構造的な原因である

この2点を踏まえ、次回の実装検討では、「境界判定専用の改善であるため密集エリアへの影響を心配する必要はない」という前提のもと、「ルートごとに代表地点が揺れ動く」という不安定さそのものにどう対処するか（座標平均化の精度向上、投影後座標同士の直線距離によるフォールバック確認、等）に集中して検討を進めることができる。

---

### 25. 首都高ICの重複登録の将来的な整理方針（2026-07-22記録）

現在、SHUTO_IC_MASTERに登録されている首都高ICと同一の施設が、IC_MASTER内の他エリア
（joban・chuo・tomei・aqualine・tokan等）にも「首都高スタブ」として重複登録されている
箇所が複数存在する（既知の保留事項17参照）。これは、当初の座標ベース・距離無制限の
最寄りIC判定ロジックのために必要だった経緯によるものと考えられる。

現在進めているIC名テーブル参照方式（resolveIcCategoryLabel/resolveIcTollCategoryId）
への移行が完了し、classifyStepsByRoadType等の旧テキスト判定ロジックが十分な実車確認を
経て不要と判断された段階で、これらの重複スタブは整理・削除する方向で進める。
CLAUDE.mdの「通常検索パイプライン統合プロジェクトにおける例外」規定に従い、新方式の
検証が完了し、ユーザーが削除の指示を出した時点で実行する。現時点では削除しない。

---

### 26. IC名の決定方式（点と点 vs 点と線）の精度比較実験（将来課題、2026-07-22記録）

現在、IC名を決定する場面で、少なくとも2つの異なる方式が使われている。

- 方式A（点と点）：findNearestIcLabel等が使用。1つの座標（Googleの案内地点等）と、登録済み全ICの座標を1つずつ比較し、最も近いICを採用する
- 方式B（点と線）：IC境界検出パイプライン（Step1〜7）・境界IC区間再分割が使用。登録済みICの座標から、ルートのpolyline（線）までの最短距離を計算する

既知の保留事項24の調査過程で、この2方式の座標比較の基準が異なるために、同一のICであってもわずかな座標のズレが生じ、意図しない極小区間の発生等の不具合につながることが判明した。

今後、どちらの方式がより高い精度・認識率を持つか、実際のルートで比較実験を行いたい。特に、首都高のように登録済みICが密集しているエリアでは、方式A（点と点）は近接する複数のICを取り違えるリスクが方式Bより高い可能性がある（1点だけを比較するため、進行方向やルートの文脈を考慮できない）と考えられる。方式Bの方が高精度であることが実験で確認できれば、findNearestIcLabel等、現在方式Aに依存している箇所を、将来的に方式Bへ統一することを検討する。

この実験・統一作業は、既知の保留事項22で合意済みの「テキストキーワード判定からIC境界ベースの判定への転換」とも関連が深く、あわせて検討する価値がある。ただし影響範囲が広い（IC名決定はアプリのほぼ全域の表示・料金計算の土台になっている）ため、着手する場合は慎重に、小さなステップに分割して進める必要がある。

**2026-07-22追記・実験結果**：`[IC判定方式比較実験・網羅版]`ログ（analyzeHighwayRoutePolyline内、方式B＝icsNearPolylineで検出された全ICについて、その投影座標を方式Aで再探索し名前が一致するか、およびsampledPoints最近傍点への距離＝方式A距離とdistanceMeters＝方式B距離を比較する仕組み）を用いて、2ルートで実車確認した。

- 荒川区役所→名古屋城：30/30件、一致率100%
- 荒川区役所→松本城：38/39件、一致率97.4%。唯一の不一致は「代官町」（首都高、方式B距離255m）で、方式Aで再探索すると隣接する別のIC「北の丸」（距離298m）が最も近いと判定された

この結果から、以下が確認できた。

- 方式A（点と点）は、全体としては高い精度（98%台）で正しいIC名を判定できている
- ただし、当初懸念していた通り、首都高のようにICが密集しているエリアでは、隣接する別のICと取り違えるケースが実際に発生することが、具体的な事例（代官町→北の丸）で裏付けられた
- 方式Aと方式Bの距離差は、平均57〜69m、最大224m程度で、極端に大きな乖離ではなかった

現時点では、この程度の誤判定率（全体の1〜3%程度）が実用上どこまで許容できるかは未評価であり、また今回の2ルートのみでは統計的に十分なサンプル数とは言えない。方式Bへの統一を実際に進めるかどうかは、追加のルートでの検証結果も踏まえて、改めて判断する。

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
