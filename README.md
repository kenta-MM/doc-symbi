# DocSymbi

構造化ドキュメントをローカルで編集するデスクトップ Web アプリです。
段落・見出し・混在入れ子リスト・コード、文書管理、アウトライン、Undo/Redo、
正規 JSON の取り出し／復元、準備後のオフライン起動を実装しています。
実機・利用者評価を含む最終受け入れは未完了です。
進捗と未実施条件は [tasks.md](specs/001-structured-editor-mvp/tasks.md) に記録しています。

## 開発環境

Node.js 22 系（22.12 以上）と npm を使用します。依存関係は lockfile で固定しています。
このワークスペースのローカル Node を使用する場合、PowerShell で次を実行します。

```powershell
$env:PATH = "$PWD\.tools\node-v22.23.4-win-x64;$env:PATH"
$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD\.tools\playwright"
npm ci
npx playwright install chromium
npm run dev
```

## 検証

```powershell
npm run typecheck
npm run lint
npm run test:unit
npm run test:contract
npm run build
npm run test:integration
npm run test:e2e
npm run test:performance
```

build はアプリと Workbox Service Worker を生成し、HTML/JS/CSS/icon/manifest を同梱します。
開発サーバーでは Service Worker を登録しません。オフライン検証には build と preview を使用します。
`npm run preview` は production build を `http://localhost:4173` で表示します。
Playwright はこのポートを専有するため、手動 preview を終了してから実行してください。
自動試験は独立した `.test-build` を生成し、テスト用 harness を含む production-mode preview を使用します。
通常の `dist` には harness を含めません。試験中はこの preview を専有します。
自動試験は通常のブラウザプロファイルを使用せず、persistent profile は OS の一時領域に
`docsymbi-test-*` として作成します。テスト結果、ブラウザ、依存、build は Git 対象外です。

詳細な受け入れ手順は [quickstart.md](specs/001-structured-editor-mvp/quickstart.md) を参照してください。

## 保存と復元

- 文書は利用中の origin / ブラウザプロファイルの IndexedDB `docsymbi` に保存します。
  サーバーへ文書を送信しません。`localhost` と `127.0.0.1`、異なるポートは別の保存領域です。
- 「保存」または Ctrl+S で明示保存します。未保存の変更は強制終了からの復旧対象ではありません。
- 「文書を取り出す」で現在の編集内容を `.docsymbi.json` に出力します。取り出しはDB保存とは別です。
- 「文書を読み込む」で復元します。同じIDが既にある場合は上書きせず拒否します。
  別環境へ移す場合は空のプロファイルで読み込んでください。
- 「オフライン利用の準備完了」が表示された後は、同じ origin / プロファイルでサーバー停止後も利用できます。
  更新版は利用者が適用するまで待機し、未保存時は保存／破棄／キャンセルを確認します。
- 保存領域の保持許可はブラウザ判断です。許可がなくても編集・保存は可能ですが、重要な文書はファイルでも保管してください。

形式仕様: [document-format.md](docs/document-format.md)。実測と残課題: [validation](specs/001-structured-editor-mvp/validation/acceptance.md)。
