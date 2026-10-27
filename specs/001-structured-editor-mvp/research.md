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

## ADR-007: 利用者指定のフォルダーを主保存先にする（2026-10-27）

- **背景・決定**: 2026-10-26の利用者指定を文書化し、ADR-005の主保存先をFile System Accessの選択フォルダーへ置換する。1文書1UTF-8 JSON、ハンドルのみIndexedDB `docsymbi-folder` に記憶する。DocumentRepository境界は維持する。これは実装済み変更の追従記録であり、過去の事前レビューを実施済みとはしない。
- **代替・理由**: IndexedDBだけでは利用者がファイルを直接管理できない。ダウンロードだけでは同じ保存先へ更新できない。デスクトップアプリ化は配布・プロセス管理を増やすため採用しない。
- **契約・リスク**: revisionは正整数の不透明な内容ハッシュであり連番ではない。同一originのWeb Locks内で読取・比較・書込を直列化し、close成功後だけ保存完了とする。外部アプリ/別originとの検査後競合は完全には排除できず同時編集は非対応。型付きエラーと編集中/最後の正常保存データを保持する。
- **移行・復旧**: 旧 `docsymbi` DBは削除せず、利用者操作でコピーする。同じIDはスキップ。記憶失敗でも今回選択した保存先を使える。権限再確認は利用者操作、フォルダー移動/削除では選び直す。失敗した初回保存の空ファイルだけを除去し、既存正常ファイルは保持する。
- **persist**: 本文は利用者のフォルダーにあるためpersistの許可は保存成功条件ではない。旧IndexedDB用のpersist表示は主UIから除外する。app shellのキャッシュ/ハンドル記憶はorigin/profile依存で、サイトデータ削除後は準備・保存先選択をやり直す。
- **検証・憲法**: III/IV/V/VI/VII/Xに対応し、実ファイルAPIの往復、同一origin二画面CAS、abort/quota/権限/削除競合を検証する。OPFS代替ではOSピッカー・実フォルダー権限を保証せずT076で確認する。通常ブラウザ/基準端末は未受け入れ。

## ADR-008: 画像を含む形式v2（2026-10-27）

- **背景・決定**: 利用者が保持する画像と説明を本文と一緒に移植できるよう、画像ブロックを含む文書はschemaVersion 2とする。ADR-002の独自モデル・strict検証を維持し、対応版を1/2に広げる。画像schemaの詳細は `docs/document-format.md` を正規のfield説明として契約から参照する。
- **代替・理由**: 外部URLだけではオフライン/移植を保証できず、別ファイル添付は欠落と原子保存の管理を増やすため、base64を同じJSONに格納する。AI向け意味データは明示入力で、自動推測/外部送信しない。
- **互換性・復旧**: v1は無変換で読み書き可能。画像挿入という明示操作でv2になり、画像削除/Undo後もv2を維持する。旧v1専用アプリはv2を拒否する。downgradeで画像を黙って捨てない。利用者は保存前のv1ファイルのコピーへ戻せる。本文/画像/意味データを含むexportを常に提供する。
- **制約・検証**: PNG/JPEG/WebP/SVG、画像ごと3MiB、文書10MiB。SVGはimgのdata URLとして表示しDOMへ注入しない。意味グラフの参照・ID・バイト長を検証する。v1/v2往復、未知版拒否、意味fieldの独立読取、Undo/Redo・オフライン画像表示を試験する。
- **憲法・将来影響**: I/II/III/IV/V/VI/VII/Xに対応。新しい版の追加は独立ADRと互換性試験を必要とし、AIサービス/同期/共同編集は追加しない。既存変更への追従レビューであり、事前レビューの履歴を捏造しない。

## ADR-009: 選択範囲の見出しと簡潔な操作表示（2026-10-27）

- **決定・理由**: 利用者指定に従いUndo/Redoはキー操作のみとしボタンを置かない。履歴なしで操作した場合は文章で案内する。閲覧時は上部文書名と保存済みボタンを隠し、保存状態は非ボタンで表示する。ボタン削除と状態の隠蔽を混同しない。
- **見出し**: 選択があれば対象の文字、なければカーソルの論理行を変換する。前後の空行をブロックとして保持し、既存見出しのlevelを保つ。文字offset/IDへ変換した後domainで期待結果を求め、adapterで照合する。リスト項目内に見出しは埋め込めないため適用不能を通知する。
- **代替・影響**: 空見出しの追加だけでは選択文字へ適用する期待を満たさない。本文を毎回再設定する方式はIMEと履歴を壊すため採用しない。明示loadだけloadVersionを進め、同じIDの再読込でもeditorを更新する。保存/通常入力/モード切替は履歴を保つ。
- **検証・憲法**: I/II/III/V/VII/VIIIに対応。部分/複数/逆向き選択、空行、絵文字、Undo/Redo、保存状態、同一ID再読込、タイトル未確定時の終了保護を検証する。新仕様が過去のT053/T056のボタン記述に優先する。

## ADR-010: 既存の補助操作を採用範囲に明記（2026-10-27）

- **決定・理由**: 検索/並び替え、ヘルプ、前回記事の自動再表示、閲覧/編集切替、明示ファイル更新を現行MVPの補助機能として採用する。利用者指定で既に存在する操作を削除せず、その範囲を明示する。
- **受け入れ境界**: 検索・並び替えは開いている文書を変えない。自動再表示は前回ID→最新の順とし、現在の編集/下書きを置換しない。閲覧時の本文は変更不可。モード切替は自動保存しない。ファイル更新は現在IDとrevision一致が必要で、通常importの同ID拒否は維持する。読取/保存待ち中に編集が進んだ場合は現在の編集を保持して通知する。ヘルプを閉じても本文は不変。
- **代替・制約**: 補助機能の撤去は操作の後退となる。別のデータモデルやサービス化は不要。検索は文書名のみ、サブフォルダー探索・全内容検索・AI解析・同期は追加しない。
- **検証・憲法**: I–Xのうち新しい外部依存はなく、III/VII/VIII/IXを特に確認する。layout/resume/view-mode/image/file-transfer試験と遅延操作の回帰試験で判定し、最終の手動受け入れは未完了のまま残す。
