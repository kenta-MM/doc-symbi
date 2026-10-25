# Research and Architecture Decisions: DocSymbi MVP

**Date**: 2026-10-25
**Status**: 計画に採用。実装・実測による検証は未実施。

ユーザー指定のTypeScript strict、React、Vite、Tiptap / ProseMirror、IndexedDB、Zod、
Vitest、Playwrightを採用する。以下は本機能のADRを兼ね、変更時は理由と影響を追記する。
技術上の未決事項は本記録で解決し、パッケージの正確なpatch版は初回導入時にlockfileで固定する。

## ADR-001: デスクトップPWAと単一フロントエンド

- **Decision**: React + Viteの静的PWA。Windows 11の通常プロファイルのChrome/Edgeを初期対象とする。
  バックエンド、クラウド、AI APIは設けない。アプリ資産をWorkboxで事前キャッシュし、
  初回のキャッシュ完了・service worker制御後にオフライン準備完了を表示する。
- **Rationale**: 指定技術を使い、ローカル編集と保存に集中できる。UI、モデル、保存は同一プロジェクト内で分離する。
- **Alternatives considered**: Electron/Tauriはネイティブファイル操作には有用だが、プロセス・権限・配布の境界が増える。
  通常SPAのみではオフライン再起動を満たさない。
- **Tradeoffs / risks**: データとキャッシュはorigin・プロファイルに属する。プライベートモードは非対応。
  サイトデータ削除や媒体障害を防ぐ保証ではない。ユーザーが保持できる正規形式ファイルの取り出しを必須とする。
  ブラウザ終了の確認はネイティブbeforeunload警告に従い、強制終了では未保存分の復旧を保証しない。
- **Test policy**: production buildで全資産のローカル利用、サーバー停止・通信切断後の再起動、
  service worker更新時の未保存状態保護を確認する。文書内容の外部送信は一切行わない。
- **Sources**: [Workbox app shell](https://developer.chrome.com/docs/workbox/app-shell-model),
  [Workbox build](https://developer.chrome.com/docs/workbox/modules/workbox-build),
  [Electron processes](https://www.electronjs.org/docs/latest/tutorial/process-model),
  [Tauri architecture](https://v2.tauri.app/concept/architecture/)

## ADR-002: 独自モデルと厳格な境界検証

- **Decision**: schemaVersion=1のDocSymbi JSONを正規形式とする。ドメインはTypeScript strictとZodにのみ依存。
  型はZod定義から導出し、全objectをstrictとして未知キーを拒否する。拡張メタデータは明示的な
  metadata領域のJSON値として保存する。JSON形式の版、IndexedDBの構造版、依存ライブラリ版を分離する。
- **Rationale**: エディタ更新で保存形式が変わらず、読み込み時の黙示的な情報欠落を防ぐ。
  plain objectに対するZodの既定の未知キー処理に依存しない。
- **Alternatives considered**: Tiptap JSONの直接保存は技術依存、HTML/Markdown正規化はIDや構造・メタデータの往復保証が難しい。
  独立した型と検証schemaの二重管理はずれを招く。
- **Tradeoffs / risks**: アダプターと独自の形式説明が必要。未知版・未知種別はMVPでは読み取り拒否とし、
  自動変換しない。将来の移行は新ADRと旧版fixtureを伴う明示的な変換として追加する。
- **Test policy**: 20件以上×10往復、JSON値の深い比較、未知キー・未知版・重複ID・不正階層の拒否。
- **Sources**: [TypeScript strict](https://www.typescriptlang.org/tsconfig/strict),
  [Zod basics](https://zod.dev/basics), [Zod object validation](https://zod.dev/api#objects)

## ADR-003: Tiptapの編集機構と独立したドメイン操作

- **Decision**: Tiptap 3系とそのProseMirrorを利用し、MVPに必要なnodeだけを明示的に登録する。
  StarterKitを無設定で導入しない。独自ID・metadata属性、制約付きlistItem、plain text貼り付けを設ける。
  ドメインの純粋操作とeditor adapterの契約はcontracts/editor.mdに定義する。
- **Rationale**: IME、selection、入力、履歴を既存の編集基盤に任せ、意味の規則をエディタから分離する。
  Reactはツールバー等を担当し、編集中のDOMをReactの再描画で置換しない。
- **Alternatives considered**: ProseMirror直利用は可能だがReact統合を自作する範囲が増える。
  contenteditableの自作はIMEと履歴のリスクが大きい。Lexical/Slateは指定スタック外。
- **Tradeoffs / risks**: モデルとエディタの二重の独立更新経路を作らない。入力transactionを候補として
  ドメイン検証後に受理し、React stateから毎回setContentする方式は禁止する。
  IDのsplit/join/Undo動作、空文書、listItemの内部paragraph、改行変換が主な破綻点。
- **Test policy**: 双方向変換の同等性、ドメイン操作単体、UI操作結果と純粋操作結果の一致、
  IDの維持、Japanese IME実機、貼り付け、全構造操作のUndo/Redoを検証する。
- **Sources**: [Tiptap Node API](https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/node),
  [Extension API](https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/extension),
  [React DOM ownership](https://react.dev/learn/manipulating-the-dom-with-refs)

## ADR-004: 履歴は単一の編集transaction履歴

- **Decision**: Tiptap UndoRedo / ProseMirror historyでdepth=100以上。構造操作は個別イベント、
  連続入力は自然な単位でまとめる。ID割当も同じ履歴イベントで戻す。保存、名前変更は本文履歴に追加しない。
- **Rationale**: selectionとIMEを含めた履歴を二重実装しない。Undo/Redo結果も正規モデル検証を通す。
- **Alternatives considered**: 全文snapshotの独自Undoは編集基盤の履歴と競合し、selection維持が複雑。
  CRDT履歴は共同編集が対象外のため導入しない。
- **Tradeoffs / risks**: 文書切り替えで履歴を破棄。保存時のeditor再生成は履歴を壊すので行わない。
  metadataやID補正を履歴外に分離するとUndo時に崩れるため、統合試験を必須にする。
- **Test policy**: 100イベントのUndo/Redo、保存を挟むUndo、別文書への非干渉、新規編集でRedo消去。
- **Source**: [Tiptap UndoRedo](https://tiptap.dev/docs/editor/extensions/functionality/undo-redo)

## ADR-005: IndexedDB repositoryと原子的なrevision検査

- **Decision**: 小さなDocumentRepositoryをapplication層に置き、IndexedDB実装だけがbrowser APIを扱う。
  全文書を一レコードに格納し、読取・revision比較・更新を同じreadwrite transactionで完結させる。
  strict durabilityを指定し、transaction complete後にのみ成功とする。作成はadd、更新は存在必須。
- **Rationale**: 一部保存や競合上書きを防ぎ、将来の保存先変更を一つの境界に限定できる。
- **Alternatives considered**: localStorageは同期処理でtransactionがなく、複数レコード分割は原子性管理が増える。
  汎用ORM、汎用repository基底クラス、別DBサーバーは不要。
- **Tradeoffs / risks**: transaction中に無関係な非同期処理を挟まない。保存前に検証・シリアライズする。
  persist()は許可が保証されないため状態を知らせ、取り出し操作を常設する。
  実行中に更新されたsnapshotを保存済みと誤表示しないよう編集世代を管理する。
- **Test policy**: 実ブラウザで同時CAS、delete後の古いsave、失敗注入時の前回データ保持、
  保存中の追加編集、ID衝突と再起動を検証する。偽DBだけで原子性を判定しない。
- **Sources**: [IndexedDB transactions](https://www.w3.org/TR/IndexedDB/#transaction-concept),
  [Storage Standard](https://storage.spec.whatwg.org/)

## ADR-006: 段階的な検証と開発環境

- **Decision**: Node.js 22系の22.12以上を開発基準とする。TypeScript strict、React、Vite、Zod 4系、
  Tiptap 3系、Vitest、Playwrightの互換性を初回導入時に確認しexact版をlockfileへ記録する。
  Workboxはbuild時に全app shellのmanifestを生成する。CDN、外部フォント、analyticsは使わない。
- **Rationale**: 指定ツールで、純粋モデルから実ブラウザまで検証を分担できる。
- **Alternatives considered**: E2Eのみではモデルの境界条件が追いにくく、単体のみではIME・保存・SWが検証できない。
- **Tradeoffs / risks**: 調査環境のnodeは20.18.0で、採用する開発基準未満。計画では更新・インストールを行わない。
  npm版照会はsandbox内のEPERMで取得できなかった。依存導入・実行試験は実装フェーズで行う。
  自動compositionイベント試験だけでは日本語IMEの実機保証としない。
- **Test policy**: Vitestのunit/contractとPlaywrightの統合・E2Eを分離し、production buildでSWを有効にする。
  初心者5名評価と実IME試験は手動結果を記録する。未実施を成功扱いにしない。
- **Sources**: [Vite requirements](https://vite.dev/guide/), [Vitest guide](https://vitest.dev/guide/),
  [Playwright service workers](https://playwright.dev/docs/service-workers)

## 将来機能への影響

AI編集は独自モデルの操作契約を利用できるがAPIは作らない。文書間リンクは安定IDを利用できる。
外部形式変換はadapter追加で扱う。共同編集はrevision CASをCRDTに置き換えるだけでは成立せず、
操作・履歴・競合規則の再設計を必要とする。OSS公開時には依存ライセンスの確認が必要であり、
本計画はプロジェクト自体のライセンスを決定しない。
