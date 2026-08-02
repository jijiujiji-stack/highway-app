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

### 14. findNearestIcByRouteDistanceへの2段階フォールバック実装（既知の保留事項24の解決）

既知の保留事項24で長期間調査していた、`findNearestIcByRouteDistance`（区間境界のIC名判定、方式B）が浮島IC周辺のような複雑なJCT構造で不安定になる問題について、2段階フォールバック方式を実装した。

- 道のり位置ベースの判定（既存ロジック）が失敗した場合のみ、道のり位置ベースで最も近かった候補（`nearestCandidate`）1件について、投影後座標同士の直線距離で再確認するフォールバックを追加
- フォールバックは新たな候補探索を行わないため、首都高のような密集エリアで別のICに取り違えるリスクは構造的に無い
- 実車4ルート（荒川区役所↔鴨川シーワールド往復、台東区根岸→鴨川シーワールド、荒川区役所→東京ディズニーシー）で確認し、いずれも意図通り動作。密集エリアでの回帰も発生していない
- 一時デバッグログ（DEBUG5・DEBUG6・DEBUG7）は削除済み
- 実車確認の過程で、逆方向ルート（鴨川シーワールド→荒川区役所）で「入谷→IC不明」という、今回のフォールバックとは別原因の検出漏れが新たに見つかった（後述の既知の保留事項に記録）

---

### 15. トップパネルETC概算内訳の表示順を走行順に変更

`buildTollCategoryBreakdownItems`の最終出力の並び順を、`TOLL_ROAD_CATEGORY_RULES`の固定定義順（首都高→アクアライン→NEXCO）から、`tollSections`内でカテゴリが最初に出現した順（＝出発地から目的地への走行順）に変更した。

- 実装は、集計に使っている`amountByRuleId`（Map）が持つキー挿入順（JS仕様上、最初に`.set()`した順序が保持される）をそのまま利用する形で、最小限の差分で実現
- 例：鴨川シーワールド→荒川区役所では「高速 + アクアライン + 首都高」の順、逆方向では「首都高 + アクアライン + 高速」の順で表示される

---

### 16. NEXCO・首都高の料金計算を距離制料金式に変更

料金計算（`TOLL_ROAD_CATEGORY_RULES`）を、これまでの単純な固定額・距離比例（税・端数処理・上限下限なし）から、2026年7月時点の現行の正式な料金体系（深夜割引等の特殊割引は考慮しない）に近づけた。

- **NEXCO**：`(150円 + 距離km × 24.6円) × 1.1`、10円単位で4捨5入
- **首都高**：`(距離km × 29.52円 + 150円) × 1.1`、10円単位で4捨5入、下限300円・上限1,950円
- **アクアライン**：現状の固定800円のまま変更なし
- `TOLL_ROAD_CATEGORY_RULES`に新しい`tollType: "distanceFormula"`を追加し、共通ヘルパー`calculateTollAmountForRule`を新設。重複していた計算ロジック（`estimateMainHighwayTollFromTollSections`・`buildTollCategoryBreakdownItems`）をこれに統一
- `estimateComparisonCandidateToll`の首都高側も、従来の別定数`SHUTO_TOLL_ESTIMATE_YEN`（固定1,000円）への依存をやめ、`polylineAnalysis.tollSections`から求めた実際の首都高利用距離を使う新方式に統一。これにより、入口比較・出口比較カードの首都高料金も、トップパネルと整合するようになった
- 首都高利用距離が取得できない場合（`polylineAnalysis`が無い、または`tollSections`に`shuto`区間が見つからない場合）は、固定値へのフォールバックをせず、候補の料金計算自体を算出不可（`null`）として扱い、既存の失敗表示パスに合流させる設計とした
- `estimateMainHighwayToll`のフォールバック経路（stepsデータ取得不可時）は、全ての呼び出し元がstepsを前提としたフィールドマスクでリクエストしており実質到達しない異常系と確認できたため、今回は変更していない
- `estimateTollFromTollCategorySequence`（Step6、現状どこからも参照されていない）も、今回は更新していない
- 実車確認済み（荒川区役所↔鴨川シーワールド往復）：新しい距離制料金式での金額が、走行順表示とあわせて正しく表示されることを確認した
- Routes API呼び出し回数は変更なし（既存データに対する計算式変更のみ）

---

### 17. 「IC不明」検出漏れのパターン調査としきい値拡張（既知の保留事項27・28関連）

既知の保留事項27・28で確認されていた「IC不明」検出漏れについて、複数ルート（幕張メッセ・松本城・名古屋城、往復含む）で実車確認し、原因を切り分けた。

**分かったこと（3種類の異なる原因が混在していた）：**

1. **密集構造での投影不安定**：浮島IC周辺のような、複数のIC・JCTが短い道のり距離に密集する構造で、`findNearestIcByRouteDistance`の道のり位置比較が不安定になる（既知の保留事項24で対応済み、2段階フォールバックで解消）
2. **データ未整備（IC_MASTER登録範囲外）**：名古屋城ルートのように、ルートの後半にIC登録が追いついていないエリアでは、乖離が数十〜数百km級になる。カバー率も著しく低い。これはしきい値調整では対処できず、既存の座標検証作業（keiyo・joban等）の延長でしか解決しない
3. **Routes APIのデータ粒度限界（新規発見）**：高井戸IC・京葉市川IC・湾岸習志野IC等で、乖離が551〜605m程度で安定して発生していた。詳細に調査した結果、これはアプリ側の座標登録の精度不足でも、投影ロジックの不安定さでもなく、**Google Routes API（`computeRoutes`）のレスポンスが、有料区間の内部にある本当の境界（例えば出口ランプの途中で無料区間に切り替わる地点）の情報を一切含んでいない**ことが原因と判明した。Google Maps本体（消費者向けWebサイト）の画面では、同じ地点により細かい粒度で「有料区間・600m」等の表示がされているが、これは公開APIには含まれていない情報であり、`navigationInstruction.instructions`の文字列判定や`step`オブジェクトの生データを確認しても、この内部境界を検出する手段がないことを確認した

**対応：**

- `findNearestIcByRouteDistance`（区間境界のIC名判定、方式B）専用のしきい値定数`TOLL_SECTION_ROUTE_DISTANCE_MATCH_THRESHOLD_METERS`を新設し、500mから700mに拡張した
- 他の3箇所（`findNearestIcByPointToPoint`＝方式A、`detectIcsOrderedAlongPolyline`＝候補IC検出、`trySplitNexcoSectionByBoundaryCategory`＝アクアライン境界分割）は、今回の調査・実車確認の対象外であり、リスク特性も異なるため、既存の`TOLL_SECTION_IC_MATCH_THRESHOLD_METERS`（500m）のまま変更していない
- フォールバックは道のり位置ベースで最も近かった候補（`nearestCandidate`）1件のみを再確認する設計のため、しきい値拡張によって別ICへの取り違えが発生するリスクは無い
- 実車確認済み：荒川区役所→幕張メッセ（京葉市川IC・湾岸習志野IC付近が解決）、荒川区役所→松本城（高井戸IC付近が解決）。荒川区役所→名古屋城は、想定通り変化なし（データ未整備の問題のため）

**残課題（次回以降）：**

- 700mでもなお解決しない稀なケース（データ未整備エリア等）では、引き続き「IC不明」という表示名が残る。料金計算上のカテゴリ判定（NEXCO扱いか首都高扱いか等）は、アクアラインで使っている`boundaryIcNames`と同種の仕組みで対応できる見込みだが、画面に表示される「IC名」自体の解決方法は未設計。次回、既存の`boundaryIcNames`を流用した表示名補完の設計を検討する予定
- 既知の保留事項27（木更津金田IC出口ランプのアクアライン料金二重計上）は未対応のまま残っている
- Routes API呼び出し回数は変更なし（既存データに対するしきい値調整のみ）

---

### 18. 「IC不明」の見つけやすさ・分かりやすさの改善（幕張IC登録、表示改善一式）

前回（しきい値700m拡張）に続き、「IC不明」が発生した際に、原因調査を効率化するための一連の改善を行った。

- **幕張IC新規登録**：荒川区役所→幕張メッセルートで、実際には幕張ICで降りているにもかかわらずIC_MASTERに未登録だったため「IC不明（乖離34,001m）」になっていた問題を発見。MapFanで座標を確認し、kanetsu/keiyoの該当箇所に新規登録した（既存のorder番号は変更せず、中間値で挿入）
- **「通過IC順」ログをtollSectionsベースに修正**：従来、距離の上限なしで最寄りICを選ぶ`passedIcEntries`ベースの表示だったため、実際には通っていない遠方のICが誤って表示される問題があった（既知の保留事項21）。既存の未使用関数`buildTollSectionBasedIcSequence`を呼び出す形に変更し、実際の判定と一致するデータに統一した
- **「全通過IC」表示機能の追加**：検索条件パネル・診断ログに、`tollSections`の道のり範囲内にある`routeDistanceCandidateIcs`（正確な候補プール）を道のり順に並べた一覧を新規追加。区間の境界ICだけでなく、沿線の中間ICも含めて表示できるようにした
- **区間ごとの独立処理化**：上記の「全通過IC」表示が、ルートの一部区間でIC不明が発生した場合に一覧全体が空になってしまう問題を修正。区間ごとに独立して処理し、失敗を後続に引きずらない設計にした（名古屋城ルートのような、途中からデータ未整備になるケースでも、判明している範囲は表示されるようになった）
- **IC名ヒント表示の追加**：「IC不明」になった境界について、Googleの案内文（`navigationInstruction.instructions`）から「〇〇IC」パターンの文字列を正規表現で抽出できた場合、「IC不明（未登録の可能性　※Googleの案内では「〇〇IC」）」の形で手がかりを併記するようにした。抽出できない場合は何も追加しない
- **道のり距離の併記**：「IC不明」が複数連続する場合に、同じ地点の重複なのか別々の地点なのかが見た目で分からなかったため、各IC不明に道のり距離（km）を併記するようにした
- 実車確認済み：荒川区役所→幕張メッセ・名古屋城で、上記の表示改善が意図通り機能することを確認した
- Routes API呼び出し回数は変更なし（既存データに対する表示・登録の変更のみ）

**残課題（次回以降）：**
- 「IC不明」を返す発生源が本当に1箇所のみか（`findNearestIcByRouteDistance`のみか、他に到達しうる経路がないか）は、まだ実際にClaude Codeへ調査依頼を送っていない（指示書は作成済みだが未送信）
- 名古屋高速道路（丸の内IC等）が、料金カテゴリ上「NEXCO」にフォールバックされてしまう問題を、荒川区役所→名古屋城の実車確認で発見した。首都高・アクアライン・NEXCO以外のカテゴリ（名古屋高速、阪神高速等）への対応は未着手。次にIC追加や名古屋方面の料金計算を扱う際に、あわせて検討する
- しきい値の動的化（前後候補ICとの間隔に応じて可変にする）アイデアは、密集エリア（首都高等）でのデータが一度も再現できず、検証未完了のまま保留。当初テストケースとして検討していた藤岡ICは、座標を確認した結果、登録・判定ともに問題ないことが判明し、動的しきい値の実験材料としては使えないと分かった
- 一時ログ（`[DEBUG-NEIGHBOR-DISTANCE]`・`[DEBUG-POINT-TO-LINE]`）は、まだ削除せず残っている

---

### 19. tomei・kanetsu・joshinetsu・tohokuエリアの座標再照合（2026-07-25実施）

既知の保留事項6・7の棚卸し（2026-07-16〜17に座標検証済みだったが記録が追いついていなかったと判明・解消済みと記録更新）をきっかけに、これら4エリアで「推定」「未確認」表記だった座標について、Wikipedia座標テンプレート・Yahoo!地図・NAVITIME等の独立ソースによる再照合を行った。

**発見したパターン**：現在の登録座標（いずれもMapFan由来）が、Wikipedia・Yahoo!地図（・NAVITIME）という複数の独立ソースから300m〜700m系統的に離れて孤立しているケースが、対象約38件中12件で見つかった。該当ソース同士は互いに数十〜200m程度の範囲で近接一致しており、MapFan側のピン登録に精度上の問題があった可能性が高いと考えられる（推測）。

**修正した12件**：

- joshinetsu：碓氷軽井沢IC（MapFan由来座標が4ソースから約500〜700m孤立）
- tomei：静岡IC・吉田IC・相良牧之原IC・菊川IC
- kanetsu：昭和IC
- tohoku：羽生IC・館林IC・栃木IC・那須IC・須賀川IC・郡山南IC

**副次的な発見（入口・出口の多地区構造）**：静岡IC・昭和ICの2件は、単純な登録ミスではなく、「入口」と「出口」（または上り・下り）が実際に数百m離れた別地区に分かれている構造だった。Wikipedia・Yahoo!地図はこのうち片方の地区のみを代表点として示していたため、NAVITIMEで方向別の座標を個別に確認し、entranceLat/Lng・exitLat/Lngをそれぞれ正しい地区の値に修正した。今回のような「現在値からのズレ＝即誤り」ではないケースがあることが分かったため、今後の同種の再照合でも、複数地区に分かれている可能性を都度考慮する必要がある。

**問題なしと判定した項目の傾向**：Wikipedia単独が閾値（300m）を超えつつも、Yahoo!地図（またはMapion等の代替ソース）とは大きく食い違い、両者が近接一致しないケースが複数件あった。この場合はWikipedia側が孤立した外れ値である可能性が高いと判断し、「問題なし」（現在の登録値を維持）とした。

**tomei/kanetsu/tohoku各エリアの要注意率**：tomei 4/9件（約44%）、kanetsu 1/8件（約13%）、tohoku 6/19件（約32%）。kanetsuエリアは他の3エリアと比べて要注意率が低く、2026-07-17実施の座標検証がより高精度だった可能性がある（推測）。

**API呼び出し数への影響**：なし（座標テーブルの静的な値の修正のみ）。

**残タスク**：今回はentranceSelectable/exitSelectable/isSelectableの値は一切変更していない。また、フルIC/ハーフICの判定自体（noteに「推定」と残っているもの）は、座標の精度検証とは別の課題として引き続き未確定のまま残っている。

---

### 20. tokanエリア座標確定と「湾岸市川（首都高）」実在しないスタブの根絶（2026-07-25実施）

既知の保留事項15（tokanエリア9件の座標・構造確認未着手）に対応した。

**座標を新規確定・修正した8件**：

- 四街道IC・佐倉IC・酒々井IC・富里IC・成田IC・大栄IC・佐原香取ICの7件：従来noteフィールドが無く、900m〜3.3kmという大幅な乖離があった（精密な座標確認が一度も行われていなかったため）。Wikipedia座標テンプレート・Yahoo!地図の近接一致に基づき新規確定した
- 湾岸市川IC：現在の登録座標が、東関東自動車道の実施設ではなく、首都高速湾岸線側の「湾岸市川（首都高）」スタブと完全に同一の座標（施設の取り違え）だったことが判明し、NAVITIME・MapFan・Wikipedia・Yahoo!地図の4ソース一致に基づき東関東道側の正しい座標に修正した

**座標修正が不要と判断した1件**：葛西IC。東関東自動車道に「葛西IC」という施設は実在せず、東京方面から東関東道方面へのルート継続性を表現するため、意図的に首都高の葛西出入口を代理点として使っている設計と判断した。

**発見・対応した重大な問題（「湾岸市川（首都高）」実在しないスタブの根絶）**：

湾岸市川ICの調査過程で、この誤登録座標が海上を指しており、かつ首都高速湾岸線の出入口一覧に「市川」という名称の出入口自体が存在しない（実在するのは「市川PA」というパーキングエリアのみ）ことが判明した。調査の結果、以下が判明した。

- IC_MASTER側のaqualine・keiyo・tokanの3エリアに、同一の「湾岸市川（首都高）」スタブが重複登録されていた（削除済み）
- SHUTO_IC_MASTER側にも同一施設を指す`shuto-b-wangan-ichikawa`エントリが別途存在し、2026-07-13付で既に「実在しない可能性が高い」と結論づけられ、`entranceSelectable`/`exitSelectable`を`false`にする対策が取られていたが、この記録・対策はIC_MASTER側の3コピーには反映されていなかった
- さらに、TOLL TAG方式のIC境界名解決経路（`findNearestIcByPointToPoint`・`findNearestIcByRouteDistance`等、現在の本番主経路）は`entranceSelectable`/`exitSelectable`を一切参照しないため、2026-07-13の対策はこの経路には及んでおらず、`shuto-b-wangan-ichikawa`は依然として候補プールに含まれ、条件次第で区間境界のIC名として選ばれうる状態が残っていた
- PROJECT_HANDOFF.mdの「最近の手動確認例」（荒川区役所→幕張メッセ、「首都高出口：湾岸市川」という記録）は2026-07-04時点のものであり、2026-07-13の対策より前の古い記録だったことも判明した

最終的に、IC_MASTER側3件・SHUTO_IC_MASTER側1件の計4件、この施設に関する全ての登録データを削除し、TOLL TAG方式・座標ベース方式いずれの経路からも根絶した。

**教訓**：一部の経路にのみフィルタ・除外対策を施しても、データそのものが残っている限り、フィルタを共有していない別経路（今回はTOLL TAG方式の区間境界名解決）から再浮上しうる。実在しないと判断したデータは、フラグで無効化するより、データ自体を削除する方が全経路に対して確実に効く対策となる。

**API呼び出し数への影響**：なし（座標テーブルの静的な値の修正・削除のみ）。

---

### 21. IC_MASTER・SHUTO_IC_MASTER全体の重複登録整理（2026-07-25実施）

既知の保留事項25（首都高スタブの重複登録整理）に着手し、「湾岸市川」の発見をきっかけに、全体を対象とした重複登録の棚卸しを行った。

**重複の分類**：

- 分類A：NEXCO側エリアへの首都高スタブ（初期開発時の仮登録の残骸）
- 分類B：道路接続部の意図的な重複（`connection: true`で明示、`appendAreasContainingIc`等の候補エリア拡張ロジックの前提）
- 分類C：mirrorレコードか単純重複か個別確認が必要なもの
- 分類D：Uchimawari方向別ミラーテーブル（意図的設計、対象外）

**分類Aとして削除した施設（NEXCO側の重複コピーを削除、SHUTO_IC_MASTER側に一本化）**：

- 湾岸市川（IC_MASTER側3件＋SHUTO_IC_MASTER側1件、実在しない施設と確認の上で完全削除。詳細は項目20参照）
- 上野（座標をNAVITIME・keiyo側一次情報の一致により35.708561,139.776389に統一の上、NEXCO側5件削除）
- 堤通・葛西・空港中央・有明・新木場・大井南（座標一致済みを確認の上、NEXCO側計21件削除。大井南・有明はkeiyo側にあった構造上の重要note（2018年料金所撤去、ハーフIC方向制限）をSHUTO_IC_MASTER側に引き継いだ上で削除）
- 代官町・一ツ橋・外苑・加平（座標一致を再確認の上、NEXCO側計7件削除）

**分類C（個別確認）の結果**：

- 木更津南IC・富浦IC・君津PA SIC（分類C-1）：`resolveEffectiveNexcoExit`・`NEXCO_MIRROR_SWAP_DIRECTION_BY_GOOGLE_NAME`という本番稼働中の方向判定ロジックが直接参照する、意図的なmirrorレコードと確認。削除しない
- 市原IC・姉崎袖ケ浦IC・木更津北IC・君津IC（分類C-3）：mirror方式ではないが、`dedupeIcDefinitionsByIdentity`の`NEXCO_AREA_KEY_BY_ROAD_NAME_PATTERN`（googleNameの`/館山/`パターンでtateyamaを優先）により、通常検索のメイン経路（TOLL TAG方式のIC境界名解決）では既に実質的にtateyama側1件のみが使われていることが判明。keiyo側の複製4件を削除した

**重複削除の判断基準として確立した方針**：

今回の作業を通じて、「通常検索のメイン経路（TOLL TAG方式、`findNearestIcByRouteDistance`・`dedupeIcDefinitionsByIdentity`を経由する経路）が実際にそのデータへ依存しているか」だけを基準に削除可否を判断する、という方針を確立した。入口比較・出口比較の候補選定（`appendAreasContainingIc`・`buildSurroundingCandidates`等、dedupeを経由しない経路）への影響は、これらの機能が将来的に作り直される前提であることから、現時点では考慮しない（精度が落ちても許容する）方針とした。

**分類Bとして削除しなかったもの**：横浜青葉IC・横浜町田IC・厚木IC等（daisanKeihin/yokohamaShindo/hodogayaBypass/tomei/odawaraAtsugiクラスタ）を確認したところ、これは「道路ごとに異なる実名（googleName）を持つ施設」を`connectedRoads`で結びつける設計であり、市原IC等（同一名称の単純複製）とは前提が異なることが判明した。木更津金田IC・高崎IC/藤岡IC等、市原IC等と同じ「同一名称の複製」パターンを持つ他の施設も、`connectedRoads`のみで済ませる設計への統一は技術的に可能そうだが、IC_MASTER全体の設計方針に関わる大きめの変更になるため、今回は見送った。

**残タスク**：蘇我IC・木更津金田IC・袖ケ浦IC・高崎IC・藤岡IC等、市原IC等と同じ「同一名称の複製」パターンを持つ他の施設についても、同じ基準（通常検索メイン経路が片方のエリアだけで機能するか）で確認し、不要な複製を削除する作業が残っている。

**API呼び出し数への影響**：なし（座標テーブルの静的な値の削除・修正のみ）。

---

### 22. 判断基準の改訂と、蘇我IC・木更津金田IC・袖ケ浦IC・高崎IC・藤岡ICの重複削除（2026-07-25実施）

項目21で残タスクとしていた、蘇我IC・木更津金田IC・袖ケ浦IC・高崎IC・藤岡ICについて、対応を実施した。

**高崎IC・藤岡IC**：`connection`/`connectedRoads`が付いておらず、市原IC等（項目21の分類C-3）と同じ「同一名称の単純複製」と確認できたため、`dedupeIcDefinitionsByIdentity`が決定的に優先するエリア側（高崎IC→kanetsu、藤岡IC→joshinetsu）を残し、もう一方の重複コピーを削除した。

**蘇我IC・木更津金田IC・袖ケ浦IC**：いずれも`connection: true`・`connectedRoads`が付与されており、当初は既知の保留事項25の判断基準（「削除してはいけない例」）に該当するとして削除を保留していた。しかし、`connection`/`connectedRoads`フィールドを実際に読んでいるコード（`appendAreasContainingIc`・`isRouteTransitionValidated`・`connectsToLaterRoadSection`・JCT名regex除外処理）の呼び出し元を遡って調査した結果、これらはいずれも入口比較・出口比較専用の仕組み（`buildPolylineBasedComparisonIcCandidates`経由）であり、通常検索が画面に表示する料金・道路ラベルの計算経路（`estimateMainHighwayToll`・`buildAssumedRouteHtml`・TOLL TAG方式一式）には一切関与しないことが判明した。

ユーザーの方針（入口比較・出口比較は将来作り直す前提のため、精度低下を現時点では許容する）に基づき、この3施設についても`dedupeIcDefinitionsByIdentity`が優先するエリア側（蘇我IC→keiyo、木更津金田IC・袖ケ浦IC→aqualine）を残し、重複コピーを削除した。残したエントリのnoteに削除経緯を追記し、IC_MASTER冒頭のコメント（木更津金田ICを意図的重複の代表例として明記していた箇所）も実態に合わせて更新した。

**判断基準の改訂**：DEVELOPMENT_CONTEXT.mdの「重複IC登録の削除可否判断基準」を改訂し、「`connection: true`が付いていれば即削除不可」という一律ルールをやめ、「そのフィールドを実際に読んでいるコードを呼び出し元まで遡り、通常検索の主要フローに影響するか、入口比較・出口比較専用かを都度確認する」という判断プロセスに変更した。「削除してはいけない例」は、方向判定ミラー（`isMirror`、`resolveEffectiveNexcoExit`等の本番ロジックが直接参照するもの）とUchimawari方向別ミラーテーブルの2つに整理した。

これにより、既知の保留事項25で残タスクとしていた重複整理は完了した。

**運用ルールの追加**：ファイル変更を伴う指示書では、`finish-check.cmd`（または`finish-check.ps1`）を実行してdiff.txtを生成し、その中身をそのまま貼ってもらう運用を徹底することとした（手動での`git diff`コピーは、PowerShellのエンコーディング起因の文字化けや、無関係な差分の混入が起きやすいため）。

**API呼び出し数への影響**：なし（座標テーブルの静的な値の削除・修正のみ）。

---

### 23. tollSection境界の末尾フォールバック機能の実装（既知の保留事項27・28対応、2026-07-25実施）

**試みて撤回した設計（絶対座標による強制打ち切り）**：最初に「入谷ICの座標をルートが通過した地点より後ろは、Googleの『有料区間』タグの有無に関わらず強制的に非課金区間として扱う」という、`TOLL_SECTION_TERMINUS_IC_NAMES`という定数を使った仕組みを実装した。しかし実車確認で、「荒川区役所→鴨川シーワールド」方向では入谷ICがルートの序盤（首都高に乗ってすぐ）に位置するため、この絶対座標ベースの判定が、そこから先の正しい有料区間全体を丸ごと非課金として切り捨ててしまい、ETC概算が約0円になるという重大なバグを引き起こした。この設計は方向非対称（往路と復路で挙動が異なる）という根本的な欠陥があったため、コミットごと撤回した。

**採用した設計（区間内の相対的フォールバック）**：`detectTollSectionsFromSteps`が生成する各`tollSection`について、`entranceIc`または`exitIc`が「IC不明」になった場合、そのrun自身の`entranceLatLng`〜`exitLatLng`という道のり距離の範囲内に限定して、`routeDistanceCandidateIcs`から「解決できなかった側に最も近い、実在する既知IC」を探し、フォールバックとして採用する（`applyTailFallbackToTollSections`）。あわせて、`totalDistanceMeters`（料金計算に使う距離）から、はみ出した分だけを差し引くことで、料金の過大請求も同時に補正する。入口側・出口側両方が未解決で候補順序が逆転する場合は、両方ともフォールバックを見送る安全策を組み込んだ。この設計は、個々の区間自身の相対的な範囲内でのみ動作するため、前回撤回した設計とは異なり、往路・復路どちらの方向でも対称的に正しく機能することを実車確認で確認した。

**表示面の対応**：
- 検索条件パネルの「首都高入口／出口／NEXCO入口／出口」の4行で、フォールバックにより決定された境界を、既存の薄紫色（`ic-area-reason-new-pipeline`）とは別の黄色（`ic-area-reason-tail-fallback`）で表示し、デバッグ・検証をしやすくした
- トップパネルの「参考：高速利用ルート」表示（`buildAssumedRouteHtmlFromTollSections`）で、フォールバックにより`entranceIc`と`exitIc`が同一ICになった「退化区間」（例：「NEXCO 入谷 → 入谷」）を、単独の区間として表示せず、直前の区間の末尾IC名に「（ここで降車）」という注記を付け足す形に変更した

**根本原因の再確認**：この問題が単なる表示の問題ではなく、実際の料金計算（`totalDistanceMeters`）にも直結していることが、調査の過程で確定した。当初「表示専用の仕組み（`buildFullPassedIcSequenceFromTollSectionRange`）の話ではないか」という推測が立てられたが、実際には`tollSections`そのもの（料金計算対象）の区切りであることが判明し、この訂正を踏まえて設計を進めた。

**実車確認結果（鴨川シーワールド→荒川区役所）**：ETC概算が約2,670円→約2,640円に減少（残留タグ分、約1.1kmが正しく切り詰められた）。

**API呼び出し数への影響**：なし（既存のsampledPoints・cumulativeDistances・icDefinitionsを再利用するのみ、新規のRoutes API呼び出しは発生しない）。

---

### 24. classifyStepsByRoadTypeのNAME_CHANGE誤判定ガード追加（2026-07-25発見・対応）

「荒川区役所→西濃運輸株式会社足立東支店」ルートの実車確認で、実際には終始首都高（中央環状線→川口線、江北JCT経由）を走行しているにもかかわらず、想定道路が「首都高 → NEXCO → 首都高」と、実体のないNEXCO区間を挟む誤判定が発生することを発見した。

**原因**：`hasExplicitNexcoSignal`は「NEXCO関連キーワードの一致」または「`maneuver === "NAME_CHANGE"`」のいずれかで真になる設計だった。調査の結果、`nexcoRouteLabelKeywords`（IC_MASTER各エリアのlabel、短縮通称）は、Googleの実際の案内テキスト（正式名称、「自動車」の有無・スペースの有無が食い違う）とほとんど一致せず、実質的に`NAME_CHANGE`という信号だけがNEXCO判定の頼りになっていたことが判明した。`NAME_CHANGE`はGoogle側の「道路名が変わった地点」を示す一般的な信号であり、首都高⇔NEXCO間の乗り継ぎだけでなく、首都高内部でのJCT通過（路線名の変化）でも等しく発生するため、「江北JCTを進む」のような、道路名を一切含まないJCT通過の案内文でも、無条件に"nexco"と誤判定されていた。

**検討して見送った対応案**：
- `NEXCO_AREA_KEY_BY_ROAD_NAME_PATTERN`（`dedupeIcDefinitionsByIdentity`が使う、正式名称に近い正規表現集）への置き換えを検討したが、この正規表現集は5エリア分（京葉・館山・関越・上信越・アクアライン）しかカバーしておらず、「江北JCTを進む」（道路名自体を含まない）の解決にはならないことがシミュレーションで判明し、見送った
- `maneuver === "NAME_CHANGE"`条件を単純に削除する案も検討したが、他11エリア（東北道・中央道・東名・常磐道・圏央道等）への本物の乗り継ぎ検出も同時に失われ、既知の保留事項22と同種のより広範囲な回帰を招くリスクが高いため、見送った

**採用した対応（案A）**：`classifyStepsByRoadType`に、「`maneuver === "NAME_CHANGE"`のみを根拠に"nexco"と仮判定されたstep」を記録し、その周辺の確定済みカテゴリ（曖昧なstepをスキップして遡った文脈、既存のsticky補完アルゴリズムを流用）が"shuto"であれば、その仮判定を打ち消す（曖昧＝直前を継承）というガードを追加した。既存のsticky補完ロジック自体は`applyStickyFill`として切り出しただけで一切変更せず、これを2回（ガード判定用・最終補完用）呼び出す設計とした。この方式により、JCTが複数連続するケース、確定済みカテゴリが1つも無いケース（ルート先頭からJCT名のみが続く等）のいずれでも、既存ロジックの正しさをそのまま流用して期待通りに動作することをシミュレーションで確認した。

**実車確認結果**：「荒川区役所→西濃運輸株式会社足立東支店」で誤判定が解消されたことを確認。既知の保留事項27・28で対応した末尾フォールバック機能を含む既存ルートへの回帰も確認された。

**残る既知の限界（今後の課題）**：`nexcoRouteLabelKeywords`は依然として、東北道・中央道・東名・常磐道・圏央道等、多くのエリアでGoogleの実際の案内テキストとほとんど一致しない状態のままである。今回の修正は「キーワードが無くNAME_CHANGEのみで、かつ前後がshuto確定済み」という特定のパターンにのみ対応しており、それ以外の場面（例えば、首都高を経由せず直接NEXCOのみを走行するルートで、キーワードが実際の案内テキストと一致しない場合）については、引き続き`NAME_CHANGE`頼みのままであり、未解決の課題として残っている。

**API呼び出し数への影響**：なし（既存のstepsデータに対する分類ロジックの変更のみ）。

---

### 25. 北関東自動車道（kitakantoエリア）の新規登録（2026-07-29発見・対応）

「筑波山→スパリゾートハワイアンズ」ルートの実車確認で、実際には北関東自動車道（桜川筑西ICから乗り、友部JCTで常磐道へ合流、約40km）を走行しているにもかかわらず、この区間に候補ICが1件も見つからず、末尾フォールバック機能（項目23）により遠く離れた常磐道側の水戸北SICまで区間が切り詰められ、ETC概算が約590円分欠落する問題を発見した。

**原因の切り分け**：ユーザーから「実際にはGoogleマップ上、石岡小美玉SIC付近から乗っているのではないか」という指摘があり、当初はテキスト判定の誤り（項目24のNAME_CHANGE誤判定と同種の問題）を疑ったが、Google Routes APIが返した実際の乗車地点座標（36.355793, 140.081535）を、石岡小美玉SICの正しい座標（36.222285, 140.283552、NAVITIME確認）と比較したところ約23km離れており、ユーザーの想定は誤りだったことが判明した。改めてこの座標を北関東自動車道の実在IC「桜川筑西IC」の座標（36.358551, 140.086245付近、NAVITIME確認）と比較したところ数百m以内で一致し、Googleのテキスト判定・実際の乗車地点はいずれも正確で、根本原因は当初の見立て通り「北関東自動車道がIC_MASTERに一切登録されていないこと」だったと確定した。教訓として、ユーザーの想定であっても、実際の座標データで裏付けを取ってから結論づける必要があることを再確認した。

**対応**：IC_MASTERに新しいエリア`kitakanto`（label: "北関東道方面"）を新設した。

- まず実害に直結する東側区間（桜川筑西IC〜水戸南IC、8件：IC6件・JCT2件）を登録し、実車確認でETC概算が約2,350円→約2,939円に改善したことを確認した
- 続けて西側区間（高崎JCT〜真岡IC、18件：IC13件・JCT3件・PA2件）も登録した。西側区間はまだ実車確認していない
- 岩舟JCT〜栃木都賀JCT間は東北自動車道との重複区間だが、既存の`tohoku`エリアには当該JCTの登録が無く、重複懸念はないことを確認した上で`kitakanto`側のみに登録した（`connectedRoads: ["kitakanto", "tohoku"]`）
- 高崎JCTも同様に、既存の`kanetsu`エリアには登録が無いことを確認した上で新規登録した（`connectedRoads: ["kitakanto", "kanetsu"]`）
- 壬生PAは、併設予定のスマートICが2023年新規事業化段階でまだ未開通のため、`entranceSelectable`/`exitSelectable`を`false`とし、開通後の再検証が必要な旨をnoteに明記した
- 全26件中、複数ソースが近接一致し確信度が高いもの（伊勢崎IC・足利IC・都賀IC・壬生IC・真岡IC等）がある一方、単一ソースのみ・ソース間のズレが大きい等の理由で確信度が「中」「低〜中」に留まるもの（太田藪塚IC・太田強戸PA/SIC・佐野田沼IC・宇都宮上三川IC・出流原PA/SIC等）も複数あり、noteに個別に明記した

**座標検証で見られた傾向**：今回もMapFan・Wikipedia・Yahoo!地図の組み合わせで「2ソースが近接一致し、1ソースが200〜460m程度の外れ値になる」というパターンが大半だった。ただし外れ値になるソースは施設によって異なり（笠間西ICはMapFan・NAVITIMEが一致しWikipedia・Yahooが外れ値、他の多くはWikipediaのみが外れ値等）、機械的な多数決ではなく個別の近接度確認が引き続き有効だった。

**API呼び出し数への影響**：なし（座標テーブルへの静的な追加のみ）。

**残タスク**：西側区間の実車確認が未実施。確信度が低めの施設（太田藪塚IC・太田強戸PA/SIC・出流原PA/SIC・佐野田沼IC・宇都宮上三川IC・友部IC・茨城町西IC・茨城町東IC）は、追加ソースでの再検証が望ましい。壬生PAのスマートICは開通後に座標調査・selectable変更が必要。

---

### 26. Uchimawariミラー13エリア・60件の削除（2026-07-29実施）

首都高の内回り/外回り方向別ミラーテーブル（`gaikanUchimawari`・`shutoC1Uchimawari`等13エリア、計60件）について、通常検索メイン経路への依存有無を調査した。

**経緯**：ユーザーから「首都高の内回り/外回り両方の座標を持つ仕組みは、通常検索に本当に必要か」という疑問が出発点となった。既知の保留事項21では、この種の方向判定ミラー機構は「本番稼働中のロジックが直接参照するため削除してはいけない例」として記録されていたが、調査の結果、この「本番稼働中」が指していたのは入口比較・出口比較機能（`resolveEffectiveShutoExit`等）であり、通常検索の主要フロー（TOLL TAG方式の料金計算・IC名表示）ではなかったことが判明した。両者を区別せずに「本番稼働中だから削除不可」と一括りにしていた点は、記録の精度が不十分だったと言える。

**検証内容**：
- Uchimawariミラー60件全てについて、対応するSHUTO_IC_MASTER側（`gaikanUchimawari`のみIC_MASTER.gaikan側）の本体エントリと`googleName`が完全一致するかを、PowerShellの`[string]::Equals(..., Ordinal)`による厳密な文字列比較で全件検証し、不一致0件を確認した
- `buildIcDefinitionIdentity`のロジックにより、全件が`dedupeIcDefinitionsByIdentity`で本体側1件に正しく統合され、ミラー側は候補プールから除外されることを、静的検証と実測ログ（`getAllRouteAnalysisIcDefinitions()`の出力、「入谷」で実車確認）の両方で確認した
- Uchimawariミラーの唯一の利用箇所は、入口比較・出口比較専用の方向判定→候補差し替え機能であり、通常検索の料金計算・IC名表示には一切影響しないことを確認した

**対応**：ユーザーの現在の方針（入口比較・出口比較は精度低下を許容する）に基づき、13エリア・60件を削除した。`resolveEffectiveShutoExit`等の方向判定ロジック自体は変更せず、差し替え対象が見つからない場合は静かに無効化される（エラーを起こさない）設計であることを確認した上で削除した。

**教訓**：「本番稼働中のロジックが参照している」という理由だけで削除不可と判断するのではなく、その「本番」が通常検索のメイン経路を指すのか、精度低下を許容する別機能（入口比較・出口比較）を指すのかを、都度明確に区別する必要がある。この教訓は、DEVELOPMENT_CONTEXT.mdの「重複IC登録の削除可否判断基準」（既に「実際に読んでいるコードを遡って確認する」という趣旨で記録済み）の実例として蓄積する。

**API呼び出し数への影響**：なし（座標テーブルの静的な削除のみ）。

---

### 27. kitakantoエリア誤削除事故の発見・復元（2026-07-29発生・対応）

**事故の内容**：コミット433f3c3「IC_MASTER: Uchimawariミラー13エリア・60件を削除」は、意図した13エリア・60件の削除に加えて、IC_MASTER内で隣接する位置に登録されていたkitakantoエリア（北関東自動車道、東側8件・西側18件、計26件、同日に新規登録・実車確認済みだったもの）を、単一の連続した削除ハンクに巻き込んで誤って削除していた。差分の行数（948行削除）は本来の60件分より明らかに多かったが、コミット時の確認では「意図した範囲のみ」という報告を鵜呑みにし、実際の削除範囲・行数を検証していなかったため、事故発生に気づかなかった。

**発覚の経緯**：「大洗海岸→伊香保温泉」ルートの実車確認で、末尾フォールバック機能により「NEXCO入口：栃木IC」という、本来の入口（水戸南IC付近）から大きく離れた（約89km）結果が表示され、黄色（フォールバック発動）になっていることに気づいたことがきっかけとなった。当初は「太田藪塚IC・佐野田沼ICの500mしきい値超過」という、前日確認していた別の軽微な問題が原因ではないかと調査を進めていたが、実際にはより深刻な原因（kitakantoエリアの全消失）が背景にあった。一時ログによる実測で、候補プール全体でsourceAreaKeyが"kitakanto"の件数が0件であることを確認し、事故を確定させた。

**対応**：コミット433f3c3の親コミット時点のapp.jsからkitakantoエリアの定義を取得し、座標・note・order番号等を一切改変せず、完全に一致する形で復元した。復元前に、削除範囲全体（948行）が「13個のUchimawariエリア＋kitakanto26件」のみで過不足なく説明できるか（他に巻き込まれた箇所が無いか）を突き合わせで確認し、他の巻き込みが無いことを確認した上で復元作業を行った。

**教訓**：
- Claude Codeからの「変更概要」「確認結果」という要約報告だけを鵜呑みにせず、実際のdiffの行数・内容を都度確認する必要がある。今回、要約自体は「13エリア・60件のみ削除」という誤った内容だったため、要約を信じた時点で見落としが発生した
- 大きな削除作業（数十件規模）を行う際は、削除前後の該当キーワードの`grep -c`件数比較等、機械的な検証を必須のステップとして組み込むべきである
- 同一の削除作業で、意図した範囲の直前・直後に別の重要なデータが隣接している場合、削除ハンクの範囲が意図せず広がっていないか、特に注意して確認する必要がある

**API呼び出し数への影響**：なし（座標テーブルの復元のみ）。

---

### 28. 有料道路カテゴリ判定を、テキストキーワードからStep1〜7（IC境界ベース）へ段階移行する方針決定（2026-07-30合意）

**背景**：`classifyStepsByRoadType`によるテキストキーワード判定（`nexcoRouteLabelKeywords`がGoogleの実際の案内テキストとほとんど一致しない、かつ`NAME_CHANGE`ガードが首都高→NEXCOの初回遷移まで握り潰してしまう）が原因で、京葉道路・常磐道・中央道等、多くのエリアで「NEXCOカテゴリが一度も検出されず、ルート全体が首都高のまま」という誤判定が発生することを実車確認で確認した。

**検証**：既知の保留事項23に記録されているStep1〜7パイプライン（座標とIC_MASTER登録情報のみで完結し、Googleテキストを一切見ない設計、それまでは診断ログとしてのみ動作）を、問題が発生していた2ルートに実際にかけたところ、いずれも正しくshuto→nexcoの境界を検出できることを確認した。

- 荒川区役所→船橋駅（京葉道路経由）：本番はshuto 1区間・17.9kmのまま。Step1〜7はshuto 7IC・11.8km → nexco 4IC・6kmと正しく分割
- 荒川区役所→スパリゾートハワイアンズ（常磐道経由）：本番はshuto 1区間・180.9kmのまま。Step1〜7はshuto 8IC・12.5km → nexco 23IC・167.5kmと正しく分割

**採用する役割分担（合意済み設計）**：

1. 「有料区間」タグ方式（TOLL TAGタグ）は、「今、有料道路の上にいるか、無料道路の上にいるか」の判定にのみ使う。下道と高速が並走している区間はGoogleのテキストが無いと区別できないため、ここだけはテキスト依存を維持する。
2. 有料区間と判定された区間の中身（首都高／NEXCO／アクアラインのどのカテゴリか、複数にまたがるなら境界はどこか）は、Step1〜7（`detectIcsOrderedAlongPolyline`・`resolveIcTollCategoryId`等）で決定する。`classifyStepsByRoadType`のNEXCO/アクアラインキーワード判定・`NAME_CHANGE`ガードは、将来的にこの役割からは丸ごと不要になる（有料/無料の境目の検出という役割自体は引き続き必要）。
3. 粒度の使い分け：料金計算（tollSections、ETC概算）には`resolveIcTollCategoryId`ベースのカテゴリID粒度（shuto/aqualine/nexcoの3値）を使う。「想定道路」表示には、IC_MASTERエリアlabelベースの粒度（"常磐道方面"等）を使う。
4. 境界ICが解決できない場合のフォールバックは1本化する。既知の保留事項27で実装した`applyTailFallbackToTollSections`（区間の範囲内で、解決できなかった側に最も近い実在ICを採用し、はみ出した距離を差し引く）と同じ考え方を、Step1〜7が検出したIC順序リストに対して適用する。専用の終点フラグは追加しない方針とする。

**今回のスコープ**：まずkeiyoエリア（京葉道路）の首都高⇔京葉道路の境界にのみ、この新しい判定を適用した（詳細は次項29）。他のエリア（chuo・tomei・joban等）は、今回は`classifyStepsByRoadType`による従来の判定のままとし、keiyoでの実装・実車確認が済んでから順次拡大する予定。

---

### 29. keiyoエリア限定でIC境界ベースのカテゴリ判定を本番接続（2026-07-30実装）

項目28の方針決定を受け、keiyoエリア（京葉道路）に限定して実装・本番接続した。

**実装内容（すべてapp.js）：**

- `trySplitTollSectionByIcCategoryForArea(section, routeDistanceCandidateIcs, sampledPoints, cumulativeDistances, targetAreaKey)`：1つのtollSectionについて、その区間の道のり距離範囲内にあるrouteDistanceCandidateIcs（Step1〜7で検出済みの走行順IC一覧、`detectTollSectionsFromSteps`内で既に1回だけ計算済みのものを再利用）を`resolveIcTollCategoryId`でカテゴリ再判定し、カテゴリが変わる箇所でサブ区間に分割する。区間内にtargetAreaKey（"keiyo"）のICが1件も含まれない場合は何もせず元のsectionをそのまま返すため、keiyo以外のエリアには影響しない
- `applyAreaCategorySplitsToTollSections(...)`：区間配列全体に上記を適用する、`applyBoundaryCategorySplitsToTollSections`（アクアライン境界分割）と同じflatMapパターンのラッパー
- `detectTollSectionsFromSteps`内で、`applyBoundaryCategorySplitsToTollSections`（アクアライン境界分割）の後・`applyTailFallbackToTollSections`（末尾フォールバック）の前に、`applyAreaCategorySplitsToTollSections(..., "keiyo")`を挿入した

**境界フォールバックとの関係**：新規に作る関数を用意する代わりに、`applyTailFallbackToTollSections`が使っているのと同じ`routeDistanceCandidateIcs`（区間範囲内で検出済みの実在IC一覧）をそのまま参照する設計にした。これにより、生成されるサブ区間のentranceIc/exitIcは常に実在ICで確定し（IC不明にならない）、後段の`applyTailFallbackToTollSections`は素通りするだけで二重にフォールバックが走ることはない。ロジックの複製は行っていない。

**表示・料金計算への反映**：`estimateMainHighwayTollFromTollSections`・`buildPolylineComparisonSummaryHtml`（検索条件パネル）・`buildAssumedRouteHtmlFromTollSections`（トップパネル参考ルート）は、いずれも`tollSections`配列の`tollCategoryId`/`entranceIc`/`exitIc`/`totalDistanceMeters`等の既存フィールドだけを参照する設計だったため、変更不要だった。「想定道路」表示のラベル解決（IC_MASTERエリアlabelベース）も、既存の`resolveTollSectionRoadLabel`→`resolveTollSectionNexcoRoadLabel`（entranceIc/exitIcの`sourceAreaKey`からIC_MASTER[key].labelを引く、既存の仕組み）がそのまま使えたため、新しいラベル解決関数は追加していない。

**スコープ限定の徹底**：`applyAreaCategorySplitsToTollSections`の`targetAreaKey`引数は"keiyo"固定で1箇所から呼んでいるだけなので、区間内にkeiyoエリアのICが検出されないルート（chuo・tomei・joban等）は、常に元のtollSectionsがそのまま返り、従来通り`classifyStepsByRoadType`・`NAME_CHANGE`ガード・`trySplitNexcoSectionByBoundaryCategory`（アクアライン専用）の判定結果のみで確定する。既存のこれらの関数自体は変更していない。

**実車確認待ち**：荒川区役所→船橋駅（京葉道路経由）で、検索条件パネルの「想定道路」が「首都高 → 京葉道路」に分かれ、NEXCO入口/出口に篠崎IC等が表示されることの確認。ETC概算に京葉道路分の距離料金が新たに計上されることの確認。keiyoが絡まないルート（例：常磐道経由）の挙動が変わっていないことの確認。

---

### 30. アクアラインの汎用ロジック統合、境界位置のズレを発見（2026-07-30調査・保留）

**背景**：項目28・29でkeiyoエリア限定に本番接続した汎用カテゴリ分割ロジック（`trySplitTollSectionByIcCategoryForArea`）について、アクアライン専用ロジック（`trySplitNexcoSectionByBoundaryCategory`）をこちらに統合できないか、診断ログのみで比較検証した（本番接続はしていない、`targetAreaKey: "aqualine"`での試験呼び出しのみ）。

**方針**：将来的にはアクアラインも汎用ロジックへ統合し、`trySplitNexcoSectionByBoundaryCategory`（アクアライン専用）は廃止する方向で進めたい。アクアラインだけ別方式のまま残す理由は無いという判断。ただし、下記の境界位置のズレを解消してからでないと安全に切り替えられない。

**検証結果（実車確認2ルート：荒川区役所→鴨川シーワールド、荒川区役所→館山）**：

1. **浮島JCTのループ構造による道のり距離の重複・混同は発生していなかった**。`routeDistanceCandidateIcs`内で「浮島IC」は常に1件のみ検出され、道のり距離も1つの妥当な値だった。既知の保留事項24で過去に問題になった「粗い案内ステップ座標によるカーブの誤近似」は、Step1〜7が使う密なサンプリング座標（`sampledPoints`）では再現しなかった。

2. **アクアライン→NEXCOの境界位置が、既存ロジックと新方式で一致しない**。首都高→アクアラインの境界（浮島IC）は両ロジックで一致するが、アクアライン→NEXCOの境界が異なる。

   - 既存ロジック（`trySplitNexcoSectionByBoundaryCategory`、`boundaryIcNames: ["浮島IC", "木更津金田IC"]`）：木更津金田ICでアクアラインを終える
   - 新方式（`trySplitTollSectionByIcCategoryForArea`、IC_MASTER登録の`sourceAreaKey`をそのまま参照）：木更津金田ICより先（袖ケ浦IC〜木更津JCT付近）までアクアラインとして扱う

   この差は2ルートとも同じ傾向で再現しており、偶然のブレではないと考えられる。既存ロジックが木更津金田ICを終端としているのは、既知の保留事項27「木更津金田IC出口ランプがアクアライン料金として二重計上される」への対応の経緯が関係している可能性が高い（未確認）。新方式はIC_MASTER登録上の`sourceAreaKey`（袖ケ浦IC・木更津JCTがそれぞれaqualine・kenoに登録されている）をそのまま読んでいるだけなので、この経緯を踏まえていない可能性がある。

**次回やること（申し送り）**：

- 既知の保留事項27の詳細を再確認し、木更津金田IC・袖ケ浦IC・木更津JCT付近で、なぜ既存ロジックが木更津金田ICを終端に選んだのか（IC_MASTER登録上の理由か、二重計上を避けるための意図的な設計か）を特定する
- その上で、(a) IC_MASTERの`sourceAreaKey`側を見直すべきか、(b) 新方式のカテゴリ解決ロジック側に何か補正が必要か、(c) 単純にIC_MASTER登録通りで問題ないのか（境界がズレて見えるだけで実害があるか）を判断する
- 実害（二重計上・距離計算のズレ等）の有無を、既存ロジックと新方式それぞれのETC概算金額を比較して確認する
- 上記が解決した後、アクアラインも`trySplitTollSectionByIcCategoryForArea`側へ本番接続し、`trySplitNexcoSectionByBoundaryCategory`（専用ロジック）を廃止する

**現状**：診断ログのみ（`[DEBUG-AQUALINE-NEWPIPELINE調査・一時的]`・`[DEBUG-UKISHIMA-LOOP調査・一時的]`、`analyzeHighwayRoutePolyline`内）は残したまま。本番接続はまだ行っていない。commit・pushは今回のドキュメント追記分のみ行う。

---

### 31. アクアライン境界ズレの解消（袖ケ浦ICのエリア移動）を実車確認、汎用ロジックへ本番切り替え（2026-08-01実施）

項目30で発見した、アクアライン→NEXCOの境界位置のズレ（既存の専用ロジックは木更津金田IC、新方式（汎用ロジック）は袖ケ浦IC〜木更津JCT付近で境界を引いていた食い違い）について、原因調査・修正・実車確認まで完了した。

**原因**：東京湾アクアラインの正式区間定義は、川崎浮島JCT - 木更津金田IC間が「東京湾アクアライン」（固定/割引料金）、木更津金田IC - 木更津JCT間が「東京湾アクアライン連絡道」（木更津金田ICの本線料金所で精算後、通常のNEXCO距離料金区間）である。IC_MASTERの`aqualine`エリアに、連絡道区間にある袖ケ浦IC（googleName:「東京湾アクアライン連絡道 袖ケ浦インターチェンジ」）が誤って登録されていたことが原因だった。

**対応**：袖ケ浦ICの登録を、IC_MASTERの`aqualine`エリアから`keno`エリアへ移動した（order/branchOrderは、移動先での既存IC（相模原愛川IC、order:4）との衝突を避けるため、木更津東IC（order:44）と木更津JCT（order:45）の間の44.5に変更）。

**実車確認結果**（荒川区役所→鴨川シーワールド、荒川区役所→館山、往復含む）：`[DEBUG-AQUALINE-NEWPIPELINE調査・一時的]`ログで、既存の専用ロジック（`trySplitNexcoSectionByBoundaryCategory`）と新方式（`trySplitTollSectionByIcCategoryForArea`、`targetAreaKey: "aqualine"`）の区間分割結果が完全に一致することを確認した（区間数3・各区間のtollCategoryId/entranceIc/exitIc/距離が一致）。浮島JCTのループ構造による道のり距離の重複・混同も発生していないことを確認済み（項目30参照）。

**本番切り替え**：上記の検証結果を受け、今回`detectTollSectionsFromSteps`内で、keiyoで既に本番接続済みの汎用ロジック（`applyAreaCategorySplitsToTollSections`、`targetAreaKey: "aqualine"`）をaqualineにも適用するようにした。

**専用ロジックとの併用を試みたが回帰が発生（2026-08-01発見・当日中に修正）**：当初、`estimateComparisonCandidateToll`（`sampledPoints`無しで`detectTollSectionsFromSteps`を呼ぶため、汎用ロジックが必要とする`routeDistanceCandidateIcs`が常に`null`になる）でもアクアライン境界分割が機能し続けるよう、専用ロジック（`trySplitNexcoSectionByBoundaryCategory`）を安全網として残し、`専用ロジック→汎用ロジック（keiyo）→汎用ロジック（aqualine）`の順に両方適用する構成を試した。しかし実車確認（荒川区役所→鴨川シーワールド）で、木更津金田IC・袖ケ浦ICを行き来する不自然な区間分割とETC概算の増加（2,590円→3,860円）が発生した。原因は、専用ロジックが分割した後続区間（木更津金田IC〜君津IC、`tollCategoryId:"nexco"`）の候補IC範囲判定に、区間境界そのものである木更津金田IC自身（`sourceAreaKey`は`aqualine`のまま）が含まれてしまい、境界IC1件だけカテゴリが異なると判定されて汎用ロジックが意図しない再分割を行ったため。

**最終対応**：専用ロジック（`applyBoundaryCategorySplitsToTollSections`）の呼び出しを完全に外し、汎用ロジックのみで`keiyo`・`aqualine`両方を判定する構成（`tollSections → 汎用ロジック（keiyo）→ 汎用ロジック（aqualine）→ 末尾フォールバック`）に統一した。これにより二重適用による境界IC混入は解消したが、`estimateComparisonCandidateToll`経由（`sampledPoints`無し）の料金計算パスでは、keiyo・aqualineともに境界分割が機能しなくなる（`routeDistanceCandidateIcs`が`null`のため汎用ロジックが素通りする）。これは、keiyoが元々専用ロジックを持たず同じ制約を受け入れていたのと同等の仕様として、今回aqualineにも適用することで合意し、許容した。専用ロジックの関数自体（`trySplitNexcoSectionByBoundaryCategory`・`applyBoundaryCategorySplitsToTollSections`）は、CLAUDE.mdの「旧関数を安易に削除しない」方針に従い、呼び出し元からのみ外し、コード上には残している。他のエリア（chuo・tomei・joban等）は引き続き`classifyStepsByRoadType`による従来の判定のまま。

---

### 32. IC境界ベースのカテゴリ判定を全エリアへ汎用化（既知の保留事項22・28〜31の集大成、2026-08-01実施）

項目28（keiyo限定導入）・30・31（aqualineへの拡張）で、`targetAreaKey`を1つずつ指定してエリアごとに`applyAreaCategorySplitsToTollSections`を呼び出す設計だったため、残りの全エリア（joban・chuo・tomei・kanetsu・joshinetsu・tohoku・keno・kitakanto・tateyama・gaikan・tokan等）に同じ仕組みを広げるには、エリアの数だけ呼び出しを追加し続ける必要があった。

**汎用化の要点**：`resolveIcTollCategoryId`は、`shuto`・`aqualine`以外の`sourceAreaKey`をすべて`nexco`という同じ料金カテゴリに丸める設計であり、また、SHUTO_IC_MASTER由来のICは`sourceAreaKey`が常に`undefined`、IC_MASTER由来のIC（NEXCO側、aqualineを含む）は`sourceAreaKey`に実際のエリア名が入る。この性質を利用し、`trySplitTollSectionByIcCategoryForArea`内の判定条件（`isTargetAreaIc`：特定の`targetAreaKey`との一致）を、「区間内の候補ICに`sourceAreaKey`が定義されているもの（＝SHUTO_IC_MASTER以外の、何らかのNEXCO系エリアに属するIC）が1件でもあるか」という汎用条件（`isNexcoAreaIc`）に置き換えた。これにより`targetAreaKey`引数自体が不要になったため、関数名を`trySplitTollSectionByIcCategory`・`applyIcCategorySplitsToTollSections`にリネームし、`detectTollSectionsFromSteps`内の呼び出しも、keiyo・aqualine個別の2回呼び出しから、エリア指定なしの1回の呼び出しにまとめた。カテゴリのグルーピング（`resolveIcTollCategoryId`による分類、`categoryGroups`の組み立て）自体は変更していない。

**影響**：keiyo・aqualineは従来通り機能する一方、joban（常磐道）等、これまでこの仕組みが及んでいなかった残りの全エリアにも、既知の保留事項22の恩恵（テキストキーワード判定だけでは検出できない首都高→NEXCOの遷移を、IC境界ベースで補う）が及ぶようになった。`classifyStepsByRoadType`・`NAME_CHANGE`ガード等のテキストキーワード判定側のロジックは変更・削除していない（区間内にIC_MASTER由来の候補ICが検出されないルートでは、引き続きテキスト判定の結果がそのまま使われる）。

---

### 33. 【総括】IC境界ベースのカテゴリ判定への全面移行が完了（2026-08-01）

既知の保留事項22（`classifyStepsByRoadType`によるテキストキーワード判定が、首都高→NEXCOの遷移を検出できない問題）から始まった一連の作業が、本日で完了した。経緯を総括して記録する。

**発端**：京葉道路・常磐道等、多くのルートで「想定道路：首都高のみ」「NEXCO入口/出口：なし」という誤判定が発生し、ETC概算が実際より大幅に低い金額になっていた。

**採用した設計方針**：「有料道路の上にいるか」の判定にはGoogleのテキスト（TOLL TAGタグ）を引き続き使うが、「有料区間の中身がどのカテゴリ（首都高／NEXCO／アクアライン）か」の判定は、IC_MASTER登録情報（座標・`sourceAreaKey`）のみで完結する、既存のStep1〜7パイプライン（既知の保留事項23で実装・検証済みだったが本番未接続だった）を土台にしたロジックに置き換える。

**段階的な移行の経緯**（直近の大きな変更・項目28〜32参照）：

1. keiyoエリア（京葉道路）限定で試験導入（項目28・29）
2. aqualineエリアにも拡張（項目30）。この過程で、IC_MASTERの`aqualine`エリアに東京湾アクアライン連絡道区間（本来はNEXCO距離料金扱いすべき区間）の袖ケ浦ICが誤登録されていたことが発覚し、修正した（項目31）
3. アクアライン専用の境界分割ロジック（`trySplitNexcoSectionByBoundaryCategory`）との併用を試みたが、区間境界ICの二重判定による回帰（区間の行き来）が発生したため、専用ロジックの呼び出しを完全に撤去し、新ロジックのみに一本化した（項目31）
4. 想定道路の表示ラベルが、複数のIC_MASTERエリアにまたがる区間で単一ラベルしか表示できない問題を修正し、「圏央道 → 館山道」のように通過順に連結表示できるようにした
5. `targetAreaKey`をエリアごとに指定する設計から、「区間内の候補ICに`sourceAreaKey`が定義されているもの（＝首都高以外）が1件でもあれば発動する」という汎用条件に置き換え、keiyo・aqualineに限らず、joban・chuo・tomei・kanetsu・joshinetsu・tohoku・keno・kitakanto・tateyama・gaikan・tokan・hodogayaBypass・odawaraAtsugi等、残り全エリアを一括で対象にした（項目32）

**実車確認結果**：joban（常磐道）・chuo（中央道）・keno（圏央道）・kanetsu（関越道）・joshinetsu（上信越道）・tomei（東名）・odawaraAtsugi（小田原厚木道路）・gaikan（外環）・tateyama（館山道）が絡む複数ルートで、いずれも追加の個別対応なしに正しく区間分割・料金計算・表示ラベル生成が機能することを確認した。keiyo・aqualine単体ルートでも、これまでの結果から変化が無いことを確認済み（回帰なし）。

**現在の構成**：

```
tollSections（TOLL TAGタグ方式で検出）
  → applyIcCategorySplitsToTollSections（IC境界ベースの汎用カテゴリ判定）
  → applyTailFallbackToTollSections（末尾フォールバック）
```

`classifyStepsByRoadType`・`NAME_CHANGE`ガード・アクアライン専用ロジック（`trySplitNexcoSectionByBoundaryCategory`）は、CLAUDE.mdの「旧関数を安易に削除しない」方針に従い、コード上には残っているが、本番のメイン解析パス（`sampledPoints`あり）では実質的に使われなくなった。

**既知の制約（今回許容した仕様）**：`estimateComparisonCandidateToll`（入口/出口比較の料金見積り、`sampledPoints`無しで`detectTollSectionsFromSteps`を呼ぶ経路）では、IC境界ベースの判定が必要とする`routeDistanceCandidateIcs`が計算されないため、この経路では区間分割が機能しない。入口/出口比較機能は今後作り直す予定であり、現時点でこの経路の精度改善は優先度を下げる方針で合意している。

**今後の残タスク**：

- IC_MASTER全体の`sourceAreaKey`整合性の確認（今回aqualineで見つかった袖ケ浦ICのような誤登録が、他エリアにも無いか）はまだ全面的には行っていない。実車確認で不自然な区間分割・ラベル表示に気づいた場合は、同様の誤登録を疑う
- `estimateComparisonCandidateToll`経路（入口/出口比較）へのIC境界ベース判定の適用は、当該機能の作り直しと合わせて将来的に検討する
- IC_MASTER未検証の残り約190件（既知の保留事項、Phase 3・スマートIC30件等）、kitakantoエリアの座標確信度が低い箇所、東水戸道路の未登録等、以前から記録されている個別のデータ整備タスクは、本件とは独立して引き続き残っている

---

### 34. 日光宇都宮道路の新規追加と、有料道路カテゴリ判定のテキスト依存を完全に解消（2026-08-02）

**日光宇都宮道路の新規追加**：東北自動車道 宇都宮IC〜日光市清滝ICの30.7km、栃木県道路公社が運営（NEXCOではない）する有料道路を、IC_MASTERに新規登録した（`nikkoUtsunomiya`エリア、宇都宮IC(JCT)・徳次郎IC・篠井IC・大沢IC・土沢IC・今市IC・日光口PA・日光IC・清滝IC）。

- 実料金とNEXCO距離計算式を比較したところ、一貫して45〜85%の乖離があったため、NEXCO扱いにはせず、専用の簡易計算式を新設した：`料金 = 14.5 + 21.35 × 距離(km)`（宇都宮IC発着の実料金4点から線形近似、誤差±8円程度）
- 土沢IC〜今市IC間は料金所が無く無料という特殊構造があるが、今回は対応せず、既知の制約として許容する（この区間をまたぐルートでは簡易計算式の精度が落ちる可能性がある）

**有料道路カテゴリ判定のテキスト依存を完全に解消**：日光宇都宮道路の追加をきっかけに、`detectTollSectionsFromSteps`のStep Bで、区間の初期カテゴリ判定がいまだにGoogleの案内テキストベース（`determineTollRoadCategory`、既知の保留事項22で導入）で行われていることが判明した（既知の保留事項33の全エリア汎用化は、この初期カテゴリを後から上書きする再分割ロジックのみを対象としており、初期カテゴリ自体はテキスト依存のまま残っていた）。日光宇都宮道路のケースで、案内テキストに「日光宇都宮道路」という文字列がたまたま含まれていたことで区間全体が誤ったカテゴリで初期化され、後段の再分割で完全には上書きされずに異常な表示（「日光宇都宮道路 浦和IC → 宇都宮IC(JCT)（ここで降車）」）が発生したことで発覚した。

これを機に、区間の初期カテゴリ判定を、区間の入口地点に最も近い候補ICの`sourceAreaKey`を使う座標ベースの方式に置き換えた。近傍にICが見つからない場合は、テキストにはフォールバックせず、既存の末尾フォールバック（`applyTailFallbackToTollSections`）と同じ「範囲内で最も近い実在ICを借りる」ロジックを再利用する。これにより、「Googleのテキストを使うのは有料/無料の境目検出のみ、カテゴリの中身は座標のみで決まる」という、既知の保留事項30〜31の頃から目指していた設計が完成した。`determineTollRoadCategory`・`classifyStepsByRoadType`・`NAME_CHANGE`ガードの関数定義自体は削除していないが、本番のカテゴリ判定経路からは完全に外れている。

**宇都宮IC(JCT)の重複登録解消**：日光宇都宮道路追加時に、既存の`tohoku`エリア側の登録とは別に`nikkoUtsunomiya`側にも新規登録してしまい、約170m離れた座標の重複登録が、候補ICの並び順を乱す原因になっていた。高崎JCT等、既存の複合JCTと同じパターン（1件のみ登録し`connectedRoads`で両方の接続を示す）に統合した。

**実車確認結果**：日光東照宮ルートで、想定道路の誤表示・浦和ICの誤入口表示が解消されたことを確認。keiyo・aqualine・joban等、既存エリアへの回帰が無いこと、東北道のみを通るルートで宇都宮IC統合後も正しく機能すること、入谷ICが絡むルートで末尾フォールバックが引き続き正常に動作することを確認済み。

**残っている既知の課題**：日光東照宮ルートで、「宇都宮IC（ここで降車）」という末尾フォールバックの黄色注記が引き続き表示される。これは今回のカテゴリ判定修正とは独立した別の問題（宇都宮IC自体のIC名解決、`entranceIc`/`exitIc`フィールドの解決処理）であり、料金には影響しない（表示精度のみ）。今回は対応せず、別途調査する。

---

### 35. トップパネルの表示調整（2026-08-02）

トップパネルのルート情報表示について、以下の調整を行った。

- 「形状判定：◯◯ / TOLLTAG：◯◯」の併記表示をやめ、TOLLTAG（新判定）のみの表示に変更
- 新旧判定（`isProbablyNoTollRouteByPolylineComparison`とTOLL TAG方式）の比較・不一致警告（「⚠一致していません」）を廃止。TOLL TAG方式の方が正確であることが確立したため
- 「ルート情報なし」の表示色・中央寄せを調整（当初グレーに変更したが視認性が悪く、白に戻した上で中央寄せを維持）
- 道路名部分（例：「首都高 堤通 → 三郷 → 外環 → …」）を1行に収まる省略表示（`text-overflow: ellipsis`）に変更し、表示欄の高さ制限により下のTOLLTAG行が隠れる問題を解消。道路名pill（`.assumed-route-road`）が`inline-block`だったため省略位置が不自然になる問題も、`inline`に変更して解消
- `isProbablyNoTollRouteByPolylineComparison`関数自体は削除せず、呼び出しのみ外している

---

### 36. 出発地・目的地の検索履歴機能を追加（2026-08-02）

出発地・目的地の入力欄で、過去に検索した場所を履歴として覚えておき、入力時に候補として表示する機能を新規実装した。

- 保存先：`localStorage`（キー`highwayCospaNavi.placeHistory.v1`）
- 保存件数：出発地・目的地合計で最大20件、新しいもの順
- 重複排除：`place_id`（無ければ住所文字列）を識別子とし、再利用時は最近使った順に更新
- UI：Google Places Autocompleteの候補とは別枠（`#originHistoryList`/`#destinationHistoryList`）として、入力欄の下に独自表示。Google Autocomplete自体の動作には影響を与えない設計
- 履歴候補を選択した場合、Google Autocompleteで選択した場合と同じ後続処理（`selectedOriginAddress`等の変数更新）が動くようにしている

---

### 37. ルート取得失敗時のエラー表示を統一（2026-08-02）

大山阿夫利神社（車で行けない山中の目的地）を検索した際、Google Routes APIがHTTP 200・エラーフィールドなしの正常応答として空のルート情報を返すことが判明した（アプリ側のバグではなく、Google側がその目的地への車のルートが存在しないと判断した結果）。

この際、通常検索ボタンは`alert`でエラーを表示するが、「現在地から再検索」ボタンは失敗時に画面上何も表示されず無反応に見える、という挙動の違いがあったため、以下を実施した。

- 「現在地から再検索」ボタンでも、手動押下時（GPS移動による自動再検索時は除く。走行中に自動再検索が失敗するたびにダイアログで操作を止めるのは危険なUXのため）に、通常検索ボタンと同じ`alert`表示をするよう統一
- エラーメッセージの文言を、内部エラーオブジェクトの技術的な内容ではなく、「Googleから〇〇ルートの情報を取得できませんでした。目的地が車で行けない場所（山道・登山道等）である可能性があります。」という、利用者向けの分かりやすい表現に統一

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

**2026-07-25追記・解消済みと判明**：記録当時（2026-07-16 18:51）は未着手だったが、その数時間後（同日22:38、tomei）・翌日（07-17 09:51、kanetsu・joshinetsu）に座標検証が完了しており、ドキュメントの更新が追いついていなかった。tomei通常IC21件・kanetsu通常IC18件・joshinetsu通常IC8件（スマートIC除く）は全件noteフィールドに検証記録があり、解消済みと判断する。tomeiエリアに残る未検証項目（首都高スタブ7件）は、既知の保留事項17で別途追跡中の課題であり、本項目の対象外とする。

---

### 7. tohoku（東北道）：完全未着手

lat/lng自体が未設定のエントリのみで、座標検証以前の段階です。他エリアと同じ手順（NEXCO東日本公式・MapFan等での確認）で座標を確定させる必要があります。

**2026-07-25追記・解消済みと判明**：記録当時（2026-07-16 18:51）は「lat/lng自体が未設定」だったが、翌日（07-17 10:30〜10:45）に浦和IC〜郡山JCTまで全27件の座標が追加・検証済みとなっており、ドキュメントの更新が追いついていなかった。全件noteフィールドに2026-07-17付の検証記録があり、解消済みと判断する。

---

### 8. keiyo（京葉道路）エリアの個別残課題（2026-07-18更新）

前回の全件洗い出しで判明したkeiyoエリア14件（京葉道路本体6件＋首都高スタブ8件）のうち、堤通スタブ座標同期・船橋IC/花輪ICのnote追記・上野スタブ座標修正・葛西/湾岸市川/新木場/有明/大井南/空港中央のnote追記・穴川ICの代表点方式実装は完了・commit済みです。残る個別課題は以下の通りです。

- **原木IC・武石IC・松ヶ丘IC**：外部照合（Wikipedia等）を複数回試行したが、フルIC/ハーフICの判定根拠・座標の独立検証は今回も断定できず「不明」のまま。既存の2026-07-14付MapFan検証結果を変更せず維持している
- **穴川IC**：穴川西・穴川中・穴川東の3ランプ座標をWikipedia/MapFan/NAVITIMEで確認し、御殿場IC等と同様の代表点方式（穴川西の入口(上り)/出口(下り)）で座標を更新済み。3ランプの個別分離（mirrorレコード化）は未実施で、将来的に精度を上げる場合は篠崎IC・貝塚ICのisMirror/mirrorOfパターンを応用した再設計が必要（既知の保留事項3「浦安など入口・出口分離IC対応」と同種の課題）
- **有明（首都高）**：Wikipediaで「西行き出口・東行き入口のみのハーフインターチェンジ」と高確信度で確認したが、`entranceSelectable`/`exitSelectable`への反映（貝塚IC・篠崎IC等のmirrorレコード方式の要否含む）はユーザー判断待ちで保留中
- **大井南（首都高）**：2018年4月の湾岸線本線料金所（東行き）撤去に伴う構造変更（東行きは中央環状線・羽田線専用に変更、湾岸線への流入は不可）を確認したが、現在の`googleName`「首都高速湾岸線 大井南出入口」の登録内容への反映要否はユーザー判断待ちで保留中
- **湾岸市川（首都高）**：Wikipediaで「東関東自動車道側の湾岸市川IC（下り方面のみのハーフIC）とは別の施設であり、混同されやすい」と明記されているのを発見。本エントリが指す施設が実在するか、東関道側ICとの取り違えかは同定できておらず、座標は変更せずnoteに留保を明記した状態

  **2026-07-25追記・対応完了**：本エントリは、実在しない可能性が高い施設と最終確認され、IC_MASTER側3コピー（aqualine/keiyo/tokan）およびSHUTO_IC_MASTER側の対応エントリ（shuto-b-wangan-ichikawa）とも削除した（詳細は「直近の大きな変更」項目20を参照）。あわせて、東関東道側の「湾岸市川IC」（tokanエリア）とも、京葉道路側の「京葉市川IC」とも別施設であることを確認済み。
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

**2026-07-25追記・対応完了**：座標・構造確認を実施した（詳細は「直近の大きな変更」項目20を参照）。四街道IC・佐倉IC・酒々井IC・富里IC・成田IC・大栄IC・佐原香取ICの座標を新規確定、湾岸市川ICは東関東道側の正しい座標に修正、葛西ICは意図的な代理点のため対応不要と判断した。

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

**2026-07-25追記・表示部分は解決済みと判明**：本項目は2026-07-19時点で「対応は未着手」と記録していたが、調査の結果、通常検索の検索条件パネル「想定道路：」表示については、2026-07-22のコミット`f791331`で既に解決済みだったことが判明した。同コミットで、この表示はroadSequence/displayRoadSequenceベースから、tollSectionsベースの新方式（resolveTollSectionRoadLabel経由、トップパネルの「参考：高速利用ルート」・ETC概算と同じ経路）に切り替わっている。roadSequence/displayRoadSequenceが参照されるのは、steps未取得時のフォールバックのみで、通常検索では実質到達しない。

新方式はIC名テーブル参照方式（resolveIcTollCategoryId）による確定値を使っており、本項目の根本原因だった「距離無制限の最寄りIC判定」を経由しない設計のため、当時報告していた「小田厚の誤混入」（荒川区役所→名古屋城）は解消される見込みだが、実車での再確認はまだ行っていない。

一方、入口比較・出口比較の候補エリア決定（buildPolylineBasedComparisonIcCandidates内のcandidateAreas決定、app.js:17050付近）は、今も生のroadSequenceを直接参照しており、この部分は未解決のまま残っている。ただし、入口比較・出口比較については、多少の不正確さが生じても現時点では許容する方針とし、対応の優先度は下げている。

今後、入口比較・出口比較側の候補選定ロジックに着手する際は、こちらもtollSectionsベースへの統一を検討する余地がある。

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

**2026-07-22追記・2段階フォールバック方式の検証結果と実装方針（座標平均化案に代わる、より有力な案）**：座標平均化案に代わる対応として、「`findNearestIcByRouteDistance`（道のり位置ベースの比較）が失敗した場合に、投影後の座標同士（候補ICの投影点、および問い合わせ地点の投影点）を直線距離で比較し、それがしきい値（500m）以内であれば成功とみなす」という2段階のフォールバック方式を検証した。`[DEBUG7 一時的・投影後直線距離フォールバック検証]`ログを用いて、これまで確認した3ルートすべてで検証した結果は以下の通り。

- 荒川区役所→鴨川シーワールド：道のり位置の差1,390.79m（失敗）→ 投影後座標の直線距離171.24m（しきい値内、成功）
- 台東区根岸→鴨川シーワールド：道のり位置の差232m（そもそもしきい値内、成功。フォールバックは発動せず）
- 鴨川シーワールド→荒川区役所（逆方向）：道のり位置の差895.10m（失敗）→ 投影後座標の直線距離291.89m（しきい値内、成功）

3ルートすべてで、道のり位置での比較が失敗した場合でも、直線距離フォールバックが安定して成功しており、座標平均化案（逆方向ルートでは809m差が残り失敗のままだった）よりも有効性が高いと判断できる。

**なぜ2段階方式にするか（「道のり位置」と「直線距離」、いずれか一方に一本化しない理由）**：

- 「道のり位置」での比較は、既知の保留事項26で確認済みの通り、首都高のような登録済みIC・切り替わりポイントが密集しているエリアで、隣接する別のICと取り違えにくいという利点がある（近接した2点の座標だけで見分けるのではなく、道なりの前後関係を加味できるため）
- 「直線距離」だけで常に判定するようにした場合、密集エリアの近くで有料/無料の切り替わりが発生するケースでは、道のり位置なら区別できたはずの近接ICを、誤って取り違えるリスクを新たに抱える可能性がある（今のところ実際に確認された事例はなく、理論上の懸念にとどまる）
- したがって、「まず道のり位置（密集エリアに強い）を試し、それが失敗した場合にのみ、直線距離（浮島IC周辺のようなループ構造に強い）で補う」という順序が、双方の利点を活かせる、最も安全な組み合わせだと判断する
- この2段階の確認は、Googleの「有料区間」タグによる区間の境界点（切り替わりポイント）ごとに、その場で両方の計算を行うものであり、区間の分割数・切り替わりポイントの数そのものを増やす処理ではない

**次回セッションでの実装方針（更新）**：

- `findNearestIcByRouteDistance`に、道のり位置比較が失敗した場合の直線距離フォールバックを追加する（座標平均化案は不採用とし、この方式を優先する）
- フォールバックで使う投影後座標は、`interpolateLatLngOnSampledPoints`（DEBUG7検証で使用済み）で候補・問い合わせ地点それぞれ求められることを確認済み
- 実装時は、密集エリア（首都高等）を含む複数ルートでの回帰確認もあわせて行い、直線距離フォールバックが密集エリアでの精度に悪影響を及ぼさないことを確認する
- 一時デバッグログ（DEBUG5〜DEBUG7）は、実装完了・回帰確認まで残しておく

**2026-07-23追記・2段階フォールバック方式の実装・実車確認結果**：前回検証した2段階フォールバック方式を、`findNearestIcByRouteDistance`に実装した（道のり位置ベースの判定が失敗した場合のみ、`nearestCandidate`1件について投影後座標同士の直線距離で再確認する。他候補への新たな探索は行わない）。

4ルートで実車確認した結果は以下の通り。

- 荒川区役所→鴨川シーワールド：道のり位置比較が失敗（差1,390.79m）→直線距離フォールバック（171.24m）で成功。「入谷→浮島IC→木更津金田IC→君津IC」の3区間に正しく分割され、ETC概算 約2,246円
- 鴨川シーワールド→荒川区役所（逆方向）：同様にフォールバックが成功（895.10m→291.89m）
- 台東区根岸→鴨川シーワールド：道のり位置比較の時点で成功（246m）。フォールバックは発動せず
- 荒川区役所→東京ディズニーシー（首都高完結・密集エリア）：フォールバックが密集エリアで別のICに取り違える回帰は発生せず

以上より、2段階フォールバック方式は意図通りに機能していると判断する。一時デバッグログ（DEBUG5・DEBUG6・DEBUG7）は削除済み。

**新たに発見した、別の検出漏れ事象（今回のスコープ外）**：鴨川シーワールド→荒川区役所（逆方向）ルートで、入谷よりさらに荒川区役所寄りの境界点において、道のり位置比較（差1,108m）・直線距離フォールバック（差1,098m）の両方がしきい値（500m）を超過し、「入谷→IC不明」という区間が生まれ、ETC概算が約2,246円ではなく約2,263円になる事象を確認した。これは今回実装したフォールバックの取り違えではなく、両判定が正直に失敗を返した結果であり、別の原因（該当区間のIC検出網の精度・網羅性、または別の登録ICとの位置関係）による検出漏れと考えられる。原因調査は次回以降の課題とする。

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

**2026-07-25追記・大部分対応完了**：全体棚卸しを実施し、分類A（首都高スタブ、11施設・計34件超）・分類C-3（市原IC等4施設、keiyo側4件）の重複を削除した（詳細は「直近の大きな変更」項目21を参照）。分類C-1（木更津南IC・富浦IC・君津PA SIC）は本番ロジックが参照する意図的なmirrorレコードと確認し、削除しないと結論した。分類B（道路接続部の意図的重複、connection:true明示）は候補エリア拡張ロジックの前提であり削除しないと結論した。分類D（Uchimawari方向別ミラー）は意図的設計のため対象外とした。

**2026-07-29追記・訂正**：上記の分類D判断を訂正する。Uchimawariミラーの唯一の利用箇所は入口比較・出口比較専用の方向判定機能であり、通常検索メイン経路には無関係であることが確認されたため、削除しても支障がないと判断し、13エリア・60件を実際に削除した（詳細は「直近の大きな変更」項目26を参照）。「意図的設計だから対象外」という当時の判断は、「通常検索メイン経路への影響」という基準では見送る理由にならなかった。

残タスクとして、蘇我IC・木更津金田IC・袖ケ浦IC・高崎IC・藤岡IC等、同種の複製パターンを持つ他施設の確認が残っている。

**2026-07-25追記・完全対応完了**：残タスクとしていた蘇我IC・木更津金田IC・袖ケ浦IC・高崎IC・藤岡ICについても対応した（詳細は「直近の大きな変更」項目22を参照）。蘇我IC・木更津金田IC・袖ケ浦ICは`connection:true`付きだったが、唯一の消費者が入口比較・出口比較専用の仕組みであることが判明し、判断基準を改訂した上で削除した。高崎IC・藤岡ICは単純複製として削除した。これにより、本項目（首都高スタブおよび同種の重複登録の整理）は完了とする。

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

### 27. 木更津金田IC出口ランプがアクアライン料金として二重計上される（2026-07-23発見）

荒川区役所→三井アウトレットパーク木更津のルートで、ETC概算が想定（約1,800円程度）より高い約2,600円になる事象を発見した。

`[STEPS検証・一時的]`ログで確認したところ、木更津金田ICで出口ランプに入った後の区間（「金田を出る」「ランプを牛込/海岸方面に進む」等、本来は無料の一般道であるはず）にも、Googleの案内テキストに「有料区間」というタグが付いたままになっており、`tollEntryCount: 3`のうち3番目の区間（`木更津金田IC→IC不明`、距離約1,032m）が、誤ってアクアライン料金として再計上されている可能性が高い。

原因・対処は未調査。次回セッションで、まず`detectTollSectionsFromSteps`・`classifyStepsByRoadType`周辺の該当区間の分類ロジックを確認するところから着手するのがよさそうである。

**2026-07-23追記**：本項目自体は未対応のまま。ただし、今回のIC不明パターン調査（直近の大きな変更、しきい値700m拡張の項目参照）の過程で、Routes APIが有料区間の内部境界情報を返さないという構造的な限界を確認した。本項目（出口ランプへの有料区間タグの残留）も、この構造的限界と関連する可能性がある。

**2026-07-25追記・保留事項28との関連性発見**：既知の保留事項28（「入谷→IC不明」）の調査過程で、構造的に同一の現象である可能性が高いことが判明した。入谷ICを降りた後の一般道（「昭和通りを進む」区間）にも、Googleの案内テキスト上「有料区間」タグが誤って付いたままになっていることを、STEPS検証ログおよびGoogle Maps上での実地確認で確認した。木更津金田ICのケース（出口ランプ後の一般道への有料区間タグ残留）と合わせて、Google Routes APIの「有料区間」テキストタグが、実際の課金区間終了後も残留するケースが複数確認されたことになる。現時点ではこの2件のみの確認であり、対処方針の検討はまだ行っていない。今後、別のICで同様の症状（IC不明の発生、または料金の不自然な超過）が見つかった場合は、同じ原因である可能性を疑い、事例として記録を蓄積してから対応を検討する方針とする。

**2026-07-25追記・対応完了**：`applyTailFallbackToTollSections`により、tollSection境界がIC不明になった場合のフォールバック機能を実装し、対応した（詳細は「直近の大きな変更」項目23を参照）。

---

### 28. 「入谷→IC不明」の検出漏れ（2026-07-23発見、既知の保留事項24とは別原因）

鴨川シーワールド→荒川区役所（逆方向）ルートで、`findNearestIcByRouteDistance`への2段階フォールバック実装後も、入谷よりさらに荒川区役所寄りの境界点において、道のり位置比較・投影後直線距離フォールバックの両方がしきい値（500m）を超過し、「入谷→IC不明」という区間が生まれる事象を確認した（`tollEntryCount: 4`、内訳は`君津IC→木更津金田IC→浮島IC→入谷→IC不明`）。

これは2段階フォールバックの取り違えではなく、両判定が正直に失敗を返した結果であり、該当区間のIC検出網の精度・網羅性、または別の登録ICとの位置関係による、既知の保留事項24とは別原因の検出漏れと考えられる。原因調査・対処は未着手。

**2026-07-23追記**：この「入谷→IC不明」と同種の現象（境界点での道のり位置比較・直線距離比較の両方がしきい値をわずかに超過する）について、他ルート（幕張メッセ・松本城）でも複数確認し、原因を調査した。結論は「密集構造での投影不安定」ではなく、「Routes APIが有料区間の内部境界情報を返さないことによる、登録座標との数百m級の恒常的な乖離」であった（直近の大きな変更、しきい値700m拡張の項目に詳細を記載）。対応として`findNearestIcByRouteDistance`のしきい値を700mに拡張したが、本項目の具体的なルート（鴨川シーワールド→荒川区役所の入谷付近）そのものでの再確認はまだ行っていない。

**2026-07-25追記・原因の訂正と新たな発見**：前回記録した「首都高速1号上野線は入谷から堀切JCT方面へ物理的に続いている」という記述は誤りだった。ユーザー確認により、入谷は同路線の物理的な終点であることが判明した。訂正する。

その上で改めて調査したところ、この「IC不明」の直接原因は、候補ICの登録漏れではなく、既知の保留事項27（木更津金田IC出口ランプの問題）と同一の現象である可能性が高いことが判明した。Googleの「有料区間」タグの境界座標（35.7284714, 139.7902562）は、入谷ICの登録座標から道のり約1.1km先にあるが、この区間はSTEPS検証ログ上「昭和通りを進む」という、入谷出口を降りた後の地上一般道であることを確認した。Google Maps上での実地確認でも、実際には入谷ICで高速を降りており、その先は一般道であることを確認済み。

つまり、道のり位置ベースの判定・直線距離フォールバックのいずれも、正しい入力（登録座標・Google境界座標）に対して正直に「しきい値超過」を返しているだけであり、判定ロジック自体に不具合はない。根本原因は、Google Routes APIの「有料区間」テキストタグが、実際の課金区間終了後の一般道にまで残留するという、API側のデータ精度の限界にある（詳細は既知の保留事項27の追記を参照）。

なお、この調査過程で、コード上に「候補プールの末尾（路線の終点）だから判定を特別扱いする」ロジックが存在するかどうかも確認したが、`findNearestIcByRouteDistance`・`detectIcsOrderedAlongPolyline`・`detectTollSectionsFromSteps`のいずれにも、そのような特別処理は存在しないことを確認した（末尾かどうかは診断ログの表示文言にのみ影響し、判定ロジックには一切影響しない）。

対応は保留事項27と合わせて、今後同様の事例が他のICでも見つかった場合にまとめて検討する方針とする。

**2026-07-25追記・対応完了**：入谷ICのケースを含め、tollSection境界の末尾フォールバック機能により対応した（詳細は「直近の大きな変更」項目23を参照）。これにより、既知の保留事項27・28はいずれも対応完了とする。

---

### 29. kitakantoエリアの座標確信度・実車確認状況（2026-07-29記録）

北関東自動車道（kitakantoエリア）全26件のうち、以下は座標の確信度が「中」以下、または実車確認が未実施であり、今後の再検証対象とする。

- 西側区間（高崎JCT〜真岡IC、18件）：登録のみ完了、実車確認は未実施
- 確信度が低め・要再検証：太田藪塚IC・太田強戸PA/SIC（確信度低〜中）・出流原PA/SIC（単一ソースのみ）・佐野田沼IC・宇都宮上三川IC・友部IC・茨城町西IC・茨城町東IC
- 壬生PA：併設予定のスマートICが未開通（2023年新規事業化段階）。開通後、座標調査・entranceSelectable/exitSelectableの再検証が必要

---

### 30. 東水戸道路が未登録（2026-07-29発見）

「大洗海岸→伊香保温泉」ルートの実車確認で、「NEXCO入口：水戸南IC」が黄色（末尾フォールバック発動）で表示された。これは、大洗海岸が水戸南ICのさらに東側、東水戸道路（水戸南IC付近で北関東自動車道・常磐道と接続する道路）から高速に乗っている可能性が高く、この道路がIC_MASTERに未登録のため、境界判定が失敗しフォールバックで水戸南ICまで戻っていると考えられる。北関東自動車道と同様の手順（複数ソースでの座標調査→登録）で追加が必要。優先度は、料金計算自体には影響しないため（今日確立した判断基準に照らせば表示精度のみの問題）、中程度とする。

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
