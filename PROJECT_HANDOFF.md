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

現状表示：

```text
首都高 上野 → 木更津金田IC → アクアライン → 館山道 → 君津PA SIC
```

理想候補：

```text
首都高 上野 → アクアライン → 木更津金田IC → 館山道 → 君津PA SIC
```

致命的ではないため保留中です。

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

### 2. アクアライン系トップパネル表示順

現在の表示順がやや不自然な場合があります。

現状：

```text
首都高 上野 → 木更津金田IC → アクアライン → 館山道 → 君津PA SIC
```

理想：

```text
首都高 上野 → アクアライン → 木更津金田IC → 館山道 → 君津PA SIC
```

保留中です。

---

### 3. 浦安など入口・出口分離IC対応

浦安は入口と出口の座標が約2km以上離れているため、単一レコードでは扱いづらい可能性があります。

将来的には以下のどちらかを検討します。

- `浦安入口` / `浦安出口` のようなランプ別レコード
- `entrancePoint` / `exitPoint` を持つ設計

今すぐではなく、実車テスト後でよいです。

---

### 4. 旧関数・旧CSS・旧HTMLの整理

旧パネルは非表示化済みですが、関数・HTML要素・IDは削除していません。

将来的に不要が確定したら整理を検討します。

ただし、削除は慎重に行います。

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
