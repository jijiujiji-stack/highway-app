# CLAUDE.md

## プロジェクト概要

このリポジトリは「高速・下道コスパナビ」の静的Webアプリです。

現在地または出発地から目的地までの移動について、Google Maps / Google Routes API を使い、以下を比較・表示します。

- 通常検索：高速利用ルートと有料回避ルートを比較する
- 入口比較：下道走行中に、どのICから高速に乗るべきかを比較する
- 出口比較：高速走行中に、この先どのICで降りるべきかを比較する

アプリは GitHub Pages で公開されています。

- ブランチ：master
- 配信元：root
- 主なファイル：
  - index.html：画面構造
  - app.js：本体ロジック
  - style.css：見た目
  - config.js：Google Maps APIキー設定

---

## 最重要ルール

このプロジェクトでは、Google Routes API の呼び出し数を増やさないことを最重要とします。

以下を必ず守ってください。

- Routes API の呼び出し数を不用意に増やさない
- 候補IC数の上限を勝手に増やさない
- 通常モードの候補数は3件
- 「高データ更新」または実車テストON時の候補数は5件
- 自動テストでGoogle Maps / Routes APIを叩かない
- ヘッドレスChrome、Puppeteer、Playwright等による自動ブラウザ実行は禁止
- APIを叩く検証は人間による手動確認を基本とする
- 大規模リファクタリングを勝手に行わない
- 旧関数、旧HTML、旧CSSを安易に削除しない
- config.js のAPIキーを不用意に変更・複製・出力しない
- git push --force は禁止
- 1作業1コミットを基本にし、差分を小さくする

---

## API候補数制限の重要仕様

候補IC数の上限は `getActiveIcCandidateCount()` が起点です。

現在の仕様：

- `isRealDriveTestMode === false`
  - `DEV_IC_CANDIDATE_COUNT = 3`
  - 通常モード
- `isRealDriveTestMode === true`
  - `PROD_IC_CANDIDATE_COUNT = 5`
  - 「高データ更新」または実車テストON

候補IC 1件は、概ね Routes API の比較リクエスト 1回に対応します。

そのため、候補数を増やす変更は、API呼び出し数とコストの増加につながります。

候補数制限に関係する主な関数：

- `getActiveIcCandidateCount()`
- `selectLimitedComparisonIcCandidates(...)`
- `selectForwardComparisonIcCandidates(...)`
- `selectPolylineBasedMultiIcCandidates(...)`

候補数を増やすために、呼び出し側で `maxCount` や `slice` を個別に広げないでください。

---

## 入口比較・出口比較の重要仕様

入口比較と出口比較の自動比較は、別々のトップレベル関数ではありません。

以下の関数が統括しています。

- `searchAutoExitIcComparison(...)`

この関数内で `currentMultiIcMode` を見て、入口比較と出口比較を呼び分けています。

- `currentMultiIcMode === "entrance"`
  - `searchEntranceIcComparisonV2(...)`
- `currentMultiIcMode === "exit"`
  - `searchExitIcComparisonV2(...)`

注意：

- `searchAutoEntranceIcComparison` という関数は存在しません
- 入口比較用の新しい統括関数を勝手に作らないでください
- 既存の `searchAutoExitIcComparison(...)` の責務を理解した上で変更してください

---

## Polyline解析の現在方針

現在の主役は、Google Routes API の Polyline 解析です。

旧来の「目的地から距離だけで方面判定する方式」は、現在は主役ではなく、フォールバック・補助扱いです。

主な流れ：

1. `analyzeHighwayRoutePolyline(highwayRoute)`
   - 高速ルートの polyline を解析する
   - 通過道路、首都高入口、首都高出口、NEXCO入口、NEXCO出口などを推定する

2. `buildPolylineBasedComparisonIcCandidates(polylineAnalysis)`
   - Polyline解析結果から入口・出口比較用の候補ICを組み立てる

3. 入口候補
   - `filterEntranceCandidatesByRouteSection(...)`
   - `selectLimitedComparisonIcCandidates(...)`

4. 出口候補
   - `buildForwardExitComparisonIcCandidates(...)`
   - `selectForwardComparisonIcCandidates(...)`

5. 最終候補
   - `selectPolylineBasedMultiIcCandidates(...)`

---

## 首都高ICとNEXCO IC

首都高ICは主に以下で管理しています。

- `SHUTO_IC_MASTER`

NEXCO系ICは既存の以下で管理しています。

- `IC_MASTER`

首都高ICには以下のような属性があります。

- `entranceSelectable`
- `exitSelectable`
- `isSelectable`

入口専用、出口専用、選択不可ICを判定するため、これらの属性を無視しないでください。

特に以下を守ってください。

- `entranceSelectable:false` のICを入口候補に入れない
- `exitSelectable:false` のICを出口候補に入れない
- `isSelectable:false` のICを候補に入れない
- JCTや座標不安なものを安易に候補化しない

---

## 旧UI・旧関数の扱い

`old-feature-hidden` が付いた旧パネルや旧表示は、現在は通常画面では非表示ですが、HTML要素・ID・JS更新先は残っています。

削除してはいけないものの例：

- 高速利用パネル
- 有料回避パネル
- 評価パネル
- 詳細情報
- デバッグ用 `<details>` 内のテストボタン
- V1系または旧比較系の関数
- フォールバック用の関数
- タイマー、自動更新、onclick から呼ばれている可能性がある関数

未使用に見えても、以下から参照されている可能性があります。

- HTML onclick
- setInterval / タイマー
- 自動更新
- フォールバック処理
- デバッグボタン
- 実車テスト用ログ

削除や整理を行う場合は、必ず呼び出し元を確認し、ユーザーの明示的な許可を得てください。

---

## config.js とAPIキーの扱い

`config.js` には Google Maps APIキーが含まれます。

このアプリはGitHub Pagesの静的Webアプリのため、ブラウザからAPIキーが見える前提です。

ただし、Google Cloud側で以下の制限を維持する必要があります。

- HTTPリファラー制限
- 利用API制限
- 予算アラート
- 使用量監視

Claude Codeは以下を行わないでください。

- APIキーをログに出力しない
- APIキーを別ファイルに複製しない
- APIキーをコメントやMarkdownに転記しない
- config.jsを不用意に変更しない
- APIキーのローテーションを勝手に提案・実行しない

APIキー管理の変更は、ユーザーの明示的な指示がある場合のみ行います。

---

## テスト・確認方針

このプロジェクトでは、API課金と実機GPS依存があるため、自動テストの導入は慎重に扱います。

禁止：

- Google Maps / Routes APIを叩く自動テスト
- ヘッドレスChromeによる自動ブラウザ実行
- Puppeteer / Playwright によるE2Eテスト実行
- 実機確認の代わりにAPIを大量に叩く検証

推奨：

- 静的な差分確認
- 目視レビュー
- `git diff --check`
- 文字化け確認
- ユーザーによる実ブラウザ・実機確認

---

## 作業前の確認

作業前に以下を確認してください。

```powershell
git status
git log --oneline -5
```

作業ツリーが clean であることを確認してから変更してください。

---

## 作業後の確認

作業後は、PowerShellで以下を確認してください。

```powershell
git status
git diff --check
Select-String -Path app.js,index.html,style.css -Pattern "鬥|鬮|竊|繝"
git diff --cached --name-only
```

`diff.txt` を作る場合は確認用であり、コミットしないでください。

確認用・バックアップ用ファイルはコミットしないでください。

例：

- diff.txt
- diff2.txt
- index.restore.html
- 一時ログ
- バックアップHTML
- 自動生成された不要ファイル

---

## Git運用

- ブランチは `master`
- GitHub Pages は `master / root`
- コミット単位は小さくする
- コミットメッセージは日本語でよい
- `git push --force` は禁止
- `git add .` は原則避ける
- 変更対象ファイルだけを `git add` する
- コミット前に `git diff --cached --name-only` を確認する

推奨例：

```powershell
git status
git diff --check
git add app.js
git diff --cached --name-only
git commit -m "入口比較の候補表示を調整"
git push origin master
```

---

## Claude Codeへの作業指示ルール

ファイル変更前に、必ず変更方針を短く説明してください。

以下を守ってください。

- 指定された範囲だけを変更する
- 関係ない関数を整形しない
- 大規模リファクタリングをしない
- 仕様変更を勝手に混ぜない
- API呼び出し数が増える可能性がある場合は、変更前に明示する
- 旧関数や旧HTMLの削除は提案だけに留める
- ユーザーの許可なしにファイル削除をしない
- ユーザーの許可なしにコミット・pushしない

Claude Codeは、実装担当です。
仕様判断・大きな設計変更・削除判断は、ユーザー確認を挟んでください。

---

## 作業完了時の必須処理

作業完了時は、リポジトリ直下でPowerShellから以下の1コマンドを実行してください。

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\finish-check.ps1
```

このスクリプトは以下をまとめて行います。

- `git status` / `git diff --check` / 文字化けパターン確認 / `git diff --cached --name-only`
- 前回の diff.txt を削除してから、今回の差分を diff.txt に出力
- 作業完了通知の音（beep）

diff.txt は、ユーザーがChatGPTへ貼って差分確認するための一時ファイルです。

コミット対象には含めないでください。

`tools/finish-check.ps1` の内容自体を変更する場合は、ユーザーの明示的な許可を得てください。
