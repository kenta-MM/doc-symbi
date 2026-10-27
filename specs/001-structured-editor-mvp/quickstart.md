# Quickstart and Validation Guide

この文書はMVP全体の検証手順である。アプリの全5 storyと自動検証を実装済み。
実機IME、初回利用者評価、基準端末、通常Chrome/Edgeの受け入れは未完了。
以下のnpm script名は定義済みで、実行していない試験を合格と記録しない。
データ規則は[data-model.md](data-model.md)、外部形式と操作は[contracts](contracts/)を参照する。

## Prerequisites

- Windows 11、通常のChrome/Edgeプロファイル。日本語IMEを有効にする。
- Node.js 22系22.12以上とnpm。初回依存導入・Playwrightブラウザ導入時だけネット接続が必要。
- package.json、package-lock.json、対応するconfigと下記scriptを作成済み。
  依存の復元にはnpm ciを使用する。ローカルNodeとブラウザ配置はREADMEを参照。
- 性能測定はplan.mdの基準端末で行う。OS/browser/CPU/RAMと実行日時を結果に残す。
- テスト専用origin/profileを使い、利用者の保存データを検証準備で消さない。

## Setup and commands

リポジトリルートから実行する。PowerShellでnpm.ps1の実行制限がある場合はnpm.cmdを使う。

```powershell
node --version
npm ci
npx playwright install chromium
npm run typecheck
npm run lint
npm run test:unit
npm run test:contract
npm run build
npm run test:integration
npm run test:e2e
npm run test:performance
```

| Script | Expected behavior |
| --- | --- |
| typecheck | tsc --noEmit、strict境界の型検査 |
| lint | import方向、循環依存、React/editor境界の規約検査 |
| test:unit | Vitest run: domain/applicationの純粋操作と失敗状態 |
| test:contract | Vitest run: codec/adapter往復と不正データ |
| build | Vite production build + Workboxの資産manifest/SW生成 |
| test:integration | Playwright: FileDocumentRepository/旧IndexedDBとeditorの契約。prod previewを固定originで起動 |
| test:e2e | Playwright: e2e/e2e-offline両構成で全US、別試験でcold startとSW更新 |
| test:performance | Playwright: 基準fixtureで20回を計測し生値と達成件数を出力 |
| dev | Vite開発サーバー。オフライン検証の代用にしない |
| preview | distをlocalhost:4173、strictPortで配信 |

開発表示は`npm run dev`、手動受け入れは`npm run build`後に
`npm run preview -- --host localhost --port 4173 --strictPort`。
利用準備完了が表示されるまで待ってからオフライン試験を開始する。

初回は「保存フォルダーを選択」で検証専用の空フォルダーを指定する。記事は1文書1個の
`.docsymbi.json` として保存される。ハンドルの許可を再要求するときは「保存先に再接続」を使う。
移動・削除されたフォルダーは選び直す。origin/profileごとに保存先を選択する。
旧ブラウザ内の記事は「ブラウザ内の記事をコピー」で元を残して移行する。
通常importは同じIDを拒否する。「現在の文書をファイルで更新」は対象IDを確認した明示的更新である。
v1を読み込み可能なまま、画像はv2の正規形式で保存する。詳細はdocument-format契約を参照。

見出しは選択範囲、未選択ならカーソル行へ適用する。階層ごとのリスト種類も画面で変更できる。
Undo/RedoはCtrl+Z/Y/Shift+Zのみ。履歴なしの操作では理由を表示する。
閲覧中は上部タイトル入力と保存済みボタンを隠し、保存状態は文字で示す。
編集終了は保存操作ではない。未確定の文書名も未保存保護に含まれる。
同じIDの明示的再読込は本文と履歴を初期化し、通常保存・閲覧切替では履歴を維持する。

## Automated acceptance scenarios

### A. Domain and serialization — FR-003〜006/012/013/015, SC-001/004

20件以上のfixtureに空paragraph、全種別、見出し1〜6、重複/空見出し、混在3階層リスト、
日本語・絵文字・コードの連続空白/LF、全階層のmetadataを含める。
各10回serialize/deserializeおよびtoEditor/fromEditorを行い全fieldの深い同等性を確認する。
編集操作では対象外のIDとmetadataが不変であることも確認する。
未知版/未知キー/未知node/重複ID/不正深さ/破損/上限超過は全件拒否されること。

### B. Save, management and failure — FR-001/002/007/008/013/014, SC-007/008

UIで新規→入力→保存→再起動→名前変更→保存→再起動→削除キャンセル→削除確定を行う。
同名の2文書でも対象以外が変化しないことをexport結果で確認する。
容量不足/abort/書込不可をrepository境界で注入し、前回保存ファイルと現在編集を比較する。
同じrevisionから2つの独立ページでsaveし、成功は1件、残りはConflictであること。
別ページによるdelete後に古いsaveをしてNotFoundとなり、復活しないこと。
保存中に追加入力し、完了後もdirtyが残り、次の保存で新revisionを使うこと。
読み込み失敗の入力と既存文書が不変であること。
故障注入はテスト専用の構成で提供し、本番UIにデバッグ操作を公開しない。

### C. Editing, outline and history — FR-003/004/009/010/015, SC-005/008

画面上の操作だけで全ブロック追加、順序変更、見出し種類/level変更、リストindent/outdentを行う。
100件の個別履歴イベントを作り、Undo100回で初期本文、Redo100回で最終本文と一致すること。
途中で保存しても履歴が残り、Undo後の新編集でRedoが消えること。
ID/metadataがUndoでも復元されること。名前変更は本文Undoで巻き戻らないこと。
空/同名/レベル飛びの見出しから正しい場所へ移動し、変更がoutlineへ反映されること。
全削除後は空paragraphが一つ残り、保存再読込可能であること。

### D. Offline cold start and portability — FR-011/012, SC-003/004

1. production previewを固定originで起動し、専用persistent profileで開く。
2. SWによる制御と全app shellのcacheを確認し、準備完了表示を待つ。
3. 文書を保存してブラウザを完全に閉じる。previewサーバーを停止し、通信を切断する。
4. 同じprofileとoriginで再起動する。HTML/JS/CSSがcacheから開き全USを実行できること。
   単に開いたページへoffline設定するだけのテストでは代用しない。
5. 正規形式をexportし、別の空profileで準備済みアプリへimportする。全fieldが一致すること。
6. networkログで文書内容の送信が0件であることを確認する。SW更新確認の失敗で編集を止めない。
7. オンラインに戻し新SWを用意しても未保存編集を強制reloadしないことを確認する。

Playwrightの統合設定では通常の失敗注入とSW有効のオフライン試験を分ける。
SWが仲介する通信は通常のpage.routeだけで捕捉できると仮定しない。

### E. Performance — SC-006

1,000ブロック・合計10万文字で見出し/混在リスト/コードを含む固定fixtureを使用する。
production build、1つのアプリページ、拡張機能なしで20回ずつ計測。
表示は選択から本文と操作が利用可能になるまで、移動はoutline選択から対象が画面内に入るまで、
入力はkeydown/inputから該当文字を描画したframeまでとする。
20回中19回以上で2秒/1秒/100ms以下。外れ値を削除せず全値を記録する。
満たさなければprofileで原因を特定し、正確性を維持した修正と再試験を行う。

## Manual acceptance

- Windows日本語IMEで段落/見出し/listItem/codeに入力し、変換候補、確定、Enter、再変換、
  Undo/Redo、保存再読込を試す。欠落/二重入力/変換中の強制selection変更がないこと。
- Ctrl+S/Z/Y/Shift+Z、ボタン操作、未保存での文書切替とタブ終了、削除キャンセルを確認する。
- SC-002: 初回利用5人に同じ作成→各種ブロック→保存→再読込課題を渡し口頭支援しない。
  各人の所要時間、完了、分かりやすさ1〜5を記録。4人以上が10分以内かつ評価4以上。
- 実フォルダー選択、権限失効・再接続、書込拒否からの再試行を確認する。persistは旧IndexedDB方式だけが対象で、フォルダー保存の許可とは区別する。
- 基準ChromeとEdge両方で主要操作とcold startを確認。正確な版と環境を記録する。

## Exit criteria

全FRの自動検証成功、SC-001〜008の結果、手動IME/UX結果、性能生値、利用した環境と版を記録する。
未実施または失敗があればMVPの受け入れ完了とは報告しない。
設計レビューは完了しているが、上記動作の達成は実装フェーズの検証事項である。
