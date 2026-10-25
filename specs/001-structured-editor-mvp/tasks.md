# Tasks: DocSymbi 構造化ドキュメントエディタ初期MVP

**Input**: `specs/001-structured-editor-mvp/` のspec.md、plan.md、research.md、data-model.md、contracts/、quickstart.md
**Prerequisites**: 上記設計と憲章v1.0.0。技術構成はユーザー指定を維持する。
**Tests**: ユーザーの自動テスト要求と憲章に基づき必須。各storyのテストを先に作成し、未実装による失敗を確認して実装する。
**Organization**: モデル→保存→エディタ→UIを基本とし、P1のUS1/US2/US5、P2のUS3/US4の順に増分を作る。

## Format: `[ID] [P?] [Story] Description`

全タスクに対象ファイル、依存、完了条件を記載する。[P]は明記した前提が完了した後、同じbatch内で並行可能。
未実装のテスト作成タスクの完了は意図した失敗の確認まで。storyのcheckpointではすべて成功させる。
人による評価は実施結果が必要であり、参加者や実機がなければ未完了のまま理由を記録する。

## Path Conventions

パスはリポジトリルート基準。単一npmプロジェクトの`src/`、`tests/`を使用する。
`specs/001-structured-editor-mvp/validation/`は実装時の実測結果の保存先である。
以下は作業指示であり、ファイルや機能が既に存在することを意味しない。

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 再現可能な開発・テスト環境を用意する。アプリ機能は追加しない。

- [ ] T001 Node.js 22系22.12以上の利用環境を確認・準備し、`.node-version`と`specs/001-structured-editor-mvp/validation/environment.md`に実バージョンを記録する。依存: なし。完了: node/npmが動作し、現在の20.18.0のまま進めていない。権限が必要な環境変更は承認経路を使う。
- [ ] T002 `package.json`、`package-lock.json`、`index.html`、`src/main.tsx`、`vite.config.ts`でReact/Vite/TypeScript、Tiptap 3系、Zod 4系、Vitest、Playwright、Workboxを互換性確認のうえ固定する。依存: T001。完了: 最小画面のbuild成功、バックエンド/CDN/外部AI依存なし、dev/previewとquickstartの全script名を定義。
- [ ] T003 [P] `tsconfig.json`と`eslint.config.js`にstrict、noUncheckedIndexedAccess、exactOptionalPropertyTypes、層間import制限・循環依存検査を設定する。依存: T002。完了: typecheck/lintが成功し、domain→React/editor/browser APIの禁止違反を検出できる。
- [ ] T004 [P] `vitest.config.ts`と`tests/helpers/deterministic.ts`にunit/contract分離、固定clock/ID、深い不変性比較の補助を用意する。依存: T002。完了: 最小の検証用テストが実行でき、ブラウザ不要でdomainを試験可能。
- [ ] T005 [P] `playwright.config.ts`と`tests/helpers/browser-environment.ts`にproduction preview、専用origin/profile、integration/e2e/performance区分、SW有効構成を用意する。依存: T002。完了: Chromiumの起動・終了と専用profileの分離を確認し、通常利用データを変更しない。
- [ ] T006 `README.md`と`.gitignore`に起動・検査コマンド、Node要件、テスト結果/ローカルprofileの扱いを記載する。依存: T003〜T005。完了: quickstartとscript名が一致し、生成物・利用者データを追跡しない。

**Checkpoint**: typecheck/lint/buildとテストrunnerが利用可能。以降はモデルの検証を最初に行う。

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 全storyが共有する独自モデルと境界を確定する。エディタ内部JSONを正規形式にしない。

- [ ] T007 [P] `tests/fixtures/documents.ts`と`tests/fixtures/invalid-documents.ts`に20件以上の正常fixtureと境界違反を作成する。依存: Phase 1。完了: 全5種別、空文書、6見出しレベル、3階層混在リスト、日本語/絵文字/空白/LF、各階層metadata、未知版/キー/重複ID/制限超過を網羅。
- [ ] T008 [P] `tests/unit/schema.test.ts`にdata-model.mdの全field制約・ID一意性・型拒否の試験を作成する。依存: Phase 1。完了: fixture未完成でもローカル入力で正常/不正を列挙し、未実装による失敗を確認。
- [ ] T009 `src/domain/schema.ts`にZod strict schemaと導出型を実装する。依存: T007/T008。完了: 「format=`docsymbi`; schemaVersion=1; blocksは1個以上」「kind=`paragraph`; textは空文字も可」「kind=`heading`; levelは整数1〜6」「kind=`code`; 空白・改行をそのまま保持; 実行不可」「kind=`list`; style=`bullet`または`ordered`; itemsは1個以上」「childrenは0個以上のList; 任意の混在・入れ子」を満たし、余剰キーを削除せず拒否する。
- [ ] T010 `src/domain/validate.ts`に文書全体の整合性と安全上限を実装する。依存: T009。完了: 「IDはUUID文字列。文書内の全ブロック・全listItem IDは一意。」「見出しはトップレベルのみ。listItemはtextと子listだけを持ち、任意のブロック埋め込みは扱わない。」「データ量制限はUTF-8ファイル10MiB、本文合計100万Unicodeコードポイント、全要素1万、リスト深さ32、metadata深さ16とする。」を検証し、上限と上限+1の試験に成功。
- [ ] T011 `src/domain/metadata.ts`と`src/domain/text.ts`でmetadataと文字列検証を実装する。依存: T010。完了: 「metadataは文字列キーのJSON object。値はnull/boolean/有限number/string/array/objectのみ。」「本文の文字列はUnicodeの正規化やtrimをしない。」を満たし、未知metadata保持、prototype汚染防止、モデルLF限定/CR拒否、UTF-16操作でsurrogate pair非分断を検証。
- [ ] T012 `src/domain/document.ts`と`tests/unit/document.test.ts`にcreateDocument、renameDocument、時刻更新を実装する。依存: T011。完了: 「titleはtrim後に1文字以上。名前変更時だけ前後空白を除去して確定。同名文書は許可。」「createdAt/updatedAtはUTCのISO 8601文字列。」「空文書は空paragraph一つ。」を満たす。createdAt不変、編集時のみupdatedAt更新、時計巻戻り保護、import時無変換、clock/ID注入と引数不変の試験に成功。
- [ ] T013 [P] `src/application/ports/document-repository.ts`と`src/application/errors.ts`にlist/get/create/save/deleteと型付き失敗を定義する。依存: T012。完了: StoredDocumentは「repository内部のみ; revisionは正整数、exportしない」、list順序、expectedRevision、NotFound/Conflict/ValidationFailed/QuotaExceeded/StorageUnavailable/Abortedがcontracts/repository.mdと一致。
- [ ] T014 [P] `src/application/ports/editor.ts`にEditorPortと独立したcommand型を定義する。依存: T012。完了: mount/execute/focusHeading/undo/redo/canUndo/canRedo/onAcceptedChange/disposeを備え、Tiptap JSON/instance/DOM位置型を外部へ公開しない。

**Checkpoint**: スキーマ・文書生成・制約の単体試験が成功し、domainはReact/Tiptap/IndexedDBをimportしない。以降のstoryはこの段階の完了が必須。

## Phase 3: User Story 1 - 文書を書き、保存して再び開く (Priority: P1) 🎯 First increment

**Goal**: 全対応ブロックを作成・編集し、情報を保って保存・再読込する。
**Independent Test**: 空環境から全5種別・入れ子・日本語・コードを作成、保存、ブラウザ再起動。全内容/ID/metadata一致と保存失敗時の保護を確認する。

### Tests for User Story 1

- [ ] T015 [P] [US1] `tests/contract/document-codec.test.ts`と`tests/unit/block-operations.test.ts`に10往復の同等性と純粋編集の試験を作成する。依存: Phase 2。完了: 20fixture、split/join/insert/delete/move/種類変更、対象外不変、空文書を検証する失敗テストが揃う。
- [ ] T016 [P] [US1] `tests/integration/repository.spec.ts`と`tests/unit/document-session.test.ts`に保存契約・状態遷移の試験を作成する。依存: Phase 2。完了: create/get/CAS、二画面同時save、quota/abort、保存中編集、retry、正常保存保護を実DBと注入portで検証できる。
- [ ] T017 [P] [US1] `tests/contract/editor-adapter.test.ts`と`tests/e2e/edit-save-reopen.spec.ts`に双方向変換とUI往復の試験を作成する。依存: Phase 2。完了: metadata、ID、list内部paragraph、LF、未知node拒否、文字入力/貼付/保存失敗の受け入れ試験が揃う。

### Implementation for User Story 1

- [ ] T018 [US1] `src/domain/codec.ts`にserialize/deserializeと型付きImportErrorを実装する。依存: T015。完了: UTF-8構文→format/version→構造→一意IDの順に検証し、「schemaVersionが1以外はUnsupportedVersion。」と全field同等性を保証。未知キー/CR/上限超過を拒否しT015のcodec試験成功。
- [ ] T019 [US1] `src/domain/block-operations.ts`にreplaceText/insertBlock/deleteBlock/moveBlock/setHeadingLevel/convertParagraphHeadingとsplit/joinを実装する。依存: T018。完了: 対象ID/metadata保持、split後半のみ新ID、metadata不一致join拒否、最後の削除で空paragraph維持、heading化既定1、引数不変がT015で確認できる。
- [ ] T020 [US1] `src/domain/list-operations.ts`と`tests/unit/list-operations.test.ts`に項目追加/削除/indent/outdentを実装する。依存: T019。完了: 3階層混在、親なしindent/最上位outdentの無操作、空List除去、metadata非損失、各List番号1始まりとID保持を検証する。
- [ ] T021 [US1] `src/infrastructure/indexeddb/database.ts`と`src/infrastructure/indexeddb/document-repository.ts`にcreate/get/saveを実装する。依存: T016/T020。完了: docsymbi DB v1/documents/document.id、updatedAt index、strict transaction内のread/compare/write、complete後成功、破損/blocked/未知DB版の非破壊エラーを実DB試験で確認。
- [ ] T022 [US1] `src/application/document-session.ts`と`tests/helpers/memory-repository.ts`に新規/load/save/retry/dirty状態とテスト用repositoryを実装する。依存: T021。完了: 新規baseRevision=null、snapshot/generation固定、保存直列化、途中編集でdirty維持、失敗時本文/baseRevision保持、Conflictで再作成しないことをT016で確認。
- [ ] T023 [US1] `src/editor/schema.ts`と`src/editor/adapter.ts`に必要nodeのみと双方向mappingを実装する。依存: T017/T022。完了: 全5種別とlistItem(paragraph,list*)、内部paragraph独立IDなし、LF↔hardBreak、envelope保持、未知marks/node拒否、正規JSON20件×10往復一致。
- [ ] T024 [US1] `src/domain/accept-body-change.ts`と`src/editor/transaction-bridge.ts`に候補検証と構造command変換を実装する。依存: T023。完了: domain純粋操作の期待結果と最小transactionの結果が一致し、不正候補を履歴にも残さず拒否。入力ごとのsetContent/再mountを使わない。
- [ ] T025 [US1] `src/editor/identity.ts`と`src/editor/input.ts`にID保持、plain text貼付、composition対応を実装する。依存: T024。完了: 移動/種類変更ID維持、外部paste新ID、CRLF→LF、code空白保持、IME中の全再設定なし、metadata非DOM出力、コード非実行を自動試験で確認。
- [ ] T026 [US1] `src/editor/editor-controller.ts`にEditorPortのmount/execute/change/disposeを実装する。依存: T025。完了: sessionの正規モデルだけを受け渡し、selection/IMEを内部管理。後続focus/history機能の未接続状態は無効化し、実装済みと誤表示しない。
- [ ] T027 [US1] `src/ui/EditorPane.tsx`と`src/ui/BlockToolbar.tsx`に本文と全ブロック/level/移動/リスト操作UIを実装する。依存: T026。完了: マークアップ不要、操作名と無効状態が分かり、Reactがeditor管理DOMを置換せず全US1編集シナリオを実行可能。
- [ ] T028 [US1] `src/ui/SaveStatus.tsx`と`src/ui/App.tsx`に新規・明示保存・Ctrl+S・文書選択用の最小表示・失敗/retry表示を実装する。依存: T027。完了: 未保存/保存中/保存済み/失敗を区別し、再起動時に保存済み文書をgetして開ける。完全な一覧/名前変更/削除はUS2で追加。
- [ ] T029 [US1] `src/main.tsx`でrepository/session/editor/UIを組み立て、`tests/integration/editor-commands.spec.ts`でUI結果とdomain操作結果を照合する。依存: T028。完了: composition root以外に具象依存を漏らさず、無関係な内容とmetadataの保持、空文書の保存往復を確認。
- [ ] T030 [US1] `specs/001-structured-editor-mvp/validation/us1.md`にUS1試験結果を記録する。依存: T029。完了: T015〜T017/T020/T029の全試験、typecheck/lint/buildが成功し、20文書×10往復と保存失敗の証拠を記載。

**Checkpoint**: 最初のデモ可能な縦断増分。US1単独で編集・永続化を検証可能だが、全MVP完成とは呼ばない。

## Phase 4: User Story 2 - ローカルの文書を管理する (Priority: P1)

**Goal**: 一覧、名前変更、確認付き削除、未保存保護。
**Independent Test**: 2件の同名文書を用意し、一方の名前変更・削除を実行。キャンセルと再起動後の結果、他方の不変性を確認する。

### Tests for User Story 2

- [ ] T031 [P] [US2] `tests/integration/document-management.spec.ts`にlist順序、rename/delete CAS、削除後saveの試験を作成する。依存: US1。完了: stale更新による文書復活防止、他文書非干渉、破損一覧の通知を検証する失敗テストが揃う。
- [ ] T032 [P] [US2] `tests/e2e/document-management.spec.ts`に一覧/同名/空白名拒否/削除確認/未保存切替・終了の試験を作成する。依存: US1。完了: 保存/破棄/キャンセルと保存中待機を区別して期待結果を定義。

### Implementation for User Story 2

- [ ] T033 [US2] `src/infrastructure/indexeddb/document-repository.ts`にlist/deleteを追加する。依存: T031/T032。完了: updatedAt降順・同値id順、同一transactionのrevision検査、delete後のsaveはNotFound、破損レコードを削除せず通知しT031成功。
- [ ] T034 [US2] `src/application/document-management.ts`と`src/application/navigation-guard.ts`にrename/delete/switch/closeの調整を実装する。依存: T033。完了: renameで本文/ID維持、削除の期待revision一致、dirty/error/savingの保存・破棄・中止、保存失敗時の移動中止を単体試験で確認。
- [ ] T035 [US2] `src/ui/DocumentList.tsx`と`src/ui/DocumentDialogs.tsx`を実装する。依存: T034。完了: 名前/更新日時/短縮IDで同名識別、空名エラー、削除対象確認、未保存選択が画面上で操作可能。
- [ ] T036 [US2] `src/ui/App.tsx`と`src/ui/use-unsaved-warning.ts`に一覧とguardを接続する。依存: T035。完了: dirty時beforeunload標準警告、削除済み文書から一覧へ移動、キャンセル時編集保持、名前変更が本文履歴へ入らない設計を維持。
- [ ] T037 [US2] `specs/001-structured-editor-mvp/validation/us2.md`へT031/T032とUS1回帰の成功結果を記録する。依存: T036。完了: 再起動後の名前/削除保持と同名他文書不変性を確認。

## Phase 5: User Story 5 - オフラインで使い、構造化データを持ち出す (Priority: P1)

**Goal**: 準備済みPWAのオフライン再起動と正規データ移植。
**Independent Test**: fixture文書をexportして空profileへimport、全field一致。サーバー停止とブラウザ終了後、同じprofileで起動して編集・保存可能。

### Tests for User Story 5

- [ ] T038 [P] [US5] `tests/contract/portable-document.test.ts`と`tests/e2e/document-transfer.spec.ts`にexport/importの契約試験を作成する。依存: US2。完了: 20fixture、日時/metadata/ID保持、未知版/キー/CR/衝突/上限拒否と既存データ不変を検証可能。
- [ ] T039 [P] [US5] `tests/e2e/offline-restart.spec.ts`と`tests/e2e/offline-update.spec.ts`にcold startとSW更新の試験を作成する。依存: US2。完了: 専用persistent profile再起動、サーバー停止、SW有効、保存準備/未保存更新保護を検証し、未実装機能を合格扱いにしない。

### Implementation for User Story 5

- [ ] T040 [US5] `src/application/document-transfer.ts`と`src/ui/FileTransfer.tsx`に現在の有効snapshot exportと全件検証後createによるimportを実装する。依存: T038/T039。完了: `.docsymbi.json`/UTF-8、exportでdirty維持、ID衝突で上書きせず拒否、現在の未保存文書はnavigation guardで保護。
- [ ] T041 [US5] `src/offline/storage-status.ts`と`src/ui/StorageStatus.tsx`にpersist要求/結果と取り出し導線を実装する。依存: T040。完了: 許可/拒否を保存成否と区別し、容量推定だけで成功扱いにせず拒否時も基本操作可能。
- [ ] T042 [US5] `scripts/build-service-worker.mjs`、`src/offline/service-worker.ts`、`public/manifest.webmanifest`、`public/icon.svg`で全app shellの事前cacheとnavigation fallbackを実装し`package.json`のbuildへ接続する。依存: T041。完了: HTML/JS/CSS/iconを同梱、固定originでネットなしに開き、文書をcacheや外部へ送らない。
- [ ] T043 [US5] `src/offline/register.ts`と`src/ui/OfflineStatus.tsx`に準備完了・更新制御を実装する。依存: T042。完了: SW制御とcache完了後だけ準備完了、未保存中の強制reloadなし、利用者が保存/破棄後に更新可能。
- [ ] T044 [US5] `src/ui/App.tsx`に転送/保存持続性/オフライン表示を接続し`tests/e2e/network-privacy.spec.ts`を追加する。依存: T043。完了: CDN/外部font/analyticsなし、文書送信0件、SW確認通信失敗でも編集可能。
- [ ] T045 [US5] `docs/document-format.md`にv1形式・版・各field・検証/失敗規則をcontractsから記述し、`tests/contract/independent-reader.test.ts`でdomain/editorをimportしない読み取り検証器を作る。依存: T044。完了: 形式説明だけで全fixtureの内容/階層/metadataを判別し、Tiptap JSONを正規形式として要求しない。
- [ ] T046 [US5] `specs/001-structured-editor-mvp/validation/us5.md`に移植とcold start結果を記録する。依存: T045。完了: US1/US2のオフライン操作と20文書復元成功。US3/US4込みのSC-003最終判定はT058に明示的に残す。

## Phase 6: User Story 3 - 見出しを使って目的の箇所へ移動する (Priority: P2)

**Goal**: 階層アウトラインと対応見出しへの移動。
**Independent Test**: 同名・空・レベル飛びのfixtureで順序/階層/移動先を照合し、編集・削除後に更新されることを確認。

### Tests for User Story 3

- [ ] T047 [P] [US3] `tests/unit/outline.test.ts`にoutline導出の試験を作成する。依存: US1（標準実行順ではUS5後）。完了: 親は直前の浅い見出し、同名別ID、空ラベル、見出しなし、本文非変更を検証する失敗テストが揃う。
- [ ] T048 [P] [US3] `tests/e2e/outline.spec.ts`に移動・変更反映・空状態の試験を作成する。依存: US1。完了: 見出しIDによる正しい対象移動と更新を検証可能。

### Implementation for User Story 3

- [ ] T049 [US3] `src/domain/outline.ts`と`src/editor/focus-heading.ts`に導出とID→位置移動を実装する。依存: T047/T048。完了: OutlineEntryの「documentから派生。保存しない」を満たし、本文に架空見出しを追加せず、対象が画面内へ移動。
- [ ] T050 [US3] `src/ui/Outline.tsx`と`src/ui/App.tsx`にoutlineと折りたたみを接続する。依存: T049。完了: 変更後に再読込不要、空見出しは「無題の見出し」と仮表示、編集本文には書き戻さない。
- [ ] T051 [US3] `specs/001-structured-editor-mvp/validation/us3.md`へT047/T048の成功とオフラインの移動結果を記録する。依存: T050/US5。完了: 全US3シナリオで誤移動0件、既存編集・保存が正常。

## Phase 7: User Story 4 - 編集を取り消し、やり直す (Priority: P2)

**Goal**: 本文・構造の単一履歴と保存を越えるUndo/Redo。
**Independent Test**: 100個の編集イベントをUndo/RedoしID/metadataを含む初期/最終本文へ戻る。保存後履歴、Redo無効化、文書間分離を確認。

### Tests for User Story 4

- [ ] T052 [P] [US4] `tests/integration/editor-history.spec.ts`に100イベント、split/join/indent/移動、metadata/ID復元の試験を作成する。依存: US1（標準実行順ではUS3後）。完了: 保存で履歴を消さず、不正候補をUndoで復活させない期待を定義。
- [ ] T053 [P] [US4] `tests/e2e/undo-redo.spec.ts`にボタン/キー/disabled/新規編集によるRedo消去と別文書分離の試験を作成する。依存: US2。完了: 名前変更は巻き戻らず、保存後Undoはdirty、履歴なしは無操作を検証可能。

### Implementation for User Story 4

- [ ] T054 [US4] `src/editor/history.ts`と`src/editor/transaction-bridge.ts`にUndoRedo depth>=100と履歴境界を実装する。依存: T052/T053。完了: 構造変更を個別イベント、連続入力を自然な単位、ID割当を同イベントで復元し、独自snapshot履歴を重複実装しない。
- [ ] T055 [US4] `src/editor/editor-controller.ts`と`src/application/document-session.ts`へundo/redo能力と結果検証を接続する。依存: T054。完了: savedSnapshot比較とgeneration更新、本文以外のenvelope保持、保存でeditor再生成なし、切替時だけ履歴破棄。
- [ ] T056 [US4] `src/ui/HistoryToolbar.tsx`と`src/ui/App.tsx`にUndo/Redoボタン、Ctrl+Z/Y/Shift+Z、利用不能表示を実装する。依存: T055。完了: T053成功、IME合成中の標準入力処理を壊さない。
- [ ] T057 [US4] `specs/001-structured-editor-mvp/validation/us4.md`にT052/T053と既存story回帰結果を記録する。依存: T056。完了: 100回往復・保存後Undo・文書分離・ID/metadata保持すべて成功。

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 全MVPの受け入れを統合し、実測と未実施事項を正確に記録する。

- [ ] T058 全storyを含むオフラインcold start、移植、保存失敗/競合/削除競合、20件×10回編集保存往復を実行し、`tests/e2e/full-mvp.spec.ts`と`specs/001-structured-editor-mvp/validation/automated.md`へ集約する。依存: 全story。完了: SC-001/003/004/005/007/008合格、全FRの試験結果に参照可能。
- [ ] T059 [P] `tests/performance/editor.spec.ts`と`tests/fixtures/performance-document.ts`に1,000ブロック/10万文字の20回計測を実装する。依存: T058。完了: 基準端末・browser版・全生値を`specs/001-structured-editor-mvp/validation/performance.md`に記録し、表示2秒/移動1秒/入力100msを19回以上満たす。未達なら原因に限定した修正と回帰試験を行う。
- [ ] T060 [P] Windows日本語IMEで段落/見出し/listItem/codeの変換・確定・再変換・Enter・Undo/Redo・保存を実機検証し、`specs/001-structured-editor-mvp/validation/ime.md`に記録する。依存: T058。完了: 欠落/二重挿入0件。自動composition試験だけで合格にしない。
- [ ] T061 [P] 初回利用5人の作成/ブロック編集/保存/再読込を観察し、`specs/001-structured-editor-mvp/validation/usability.md`に個人識別不要の時間・完了・評価を記録する。依存: T058。完了: 口頭補助なしで4人以上が10分以内かつ5段階評価4以上。参加者未確保なら未完了とする。
- [ ] T062 [P] Chrome/Edgeの通常profileで主要操作・persist許可/拒否・タブ終了警告・SW更新を確認し、`specs/001-structured-editor-mvp/validation/browser-matrix.md`へ記録する。依存: T058。完了: 正確なOS/browser版を記載し、キーボード操作、状態表示、未保存保護が両browserで成功。
- [ ] T063 `README.md`と`specs/001-structured-editor-mvp/quickstart.md`を実装済みコマンド・保存場所・origin/profile制約・取り出し/復元手順で更新する。依存: T059〜T062。完了: 設計予定と実際の手順が一致し、不要な機能やバックエンドを要求しない。
- [ ] T064 typecheck/lint/unit/contract/build/integration/e2eと受け入れ結果を確認し、`specs/001-structured-editor-mvp/validation/acceptance.md`に全15 FR/8 SC・憲章10原則・ADR適合を記録する。依存: T063。完了: 失敗/未実施なしの場合のみMVP完了。未達時は該当タスクを未完了のまま根拠を残す。

## Dependencies & Execution Order

### Phase Dependencies

```text
Setup T001–T006
  → Model / ports T007–T014
    → US1 T015–T030
      → US2 T031–T037 → US5 T038–T046
      → US3 core T047–T050 ──(+US5)→ T051
      → US4 T052–T057 (UI試験はUS2も必要)
        [全story] → T058 → T059/T060/T061/T062 → T063 → T064
```

既定はID順。US3/US4のcoreはUS1後に先行できるが、`src/ui/App.tsx`、
`src/application/document-session.ts`、`src/editor/transaction-bridge.ts`、
`src/editor/editor-controller.ts`を触る統合タスクは直列化する。
US5の全機能オフライン受け入れはUS3/US4に依存するためT058で閉じる。
独立検証とは、準備済みfixtureを使ってそのstoryの結果を測定できることであり、基盤実装を不要とする意味ではない。

### Within Each User Story

テスト作成→実装（モデル/サービス→adapter→UI）→統合→成功結果記録。
同じファイルを編集するタスクは並列にしない。各タスクの依存欄が優先する。
後続機能の未接続portは無効状態を示し、黙って成功を返さない。

### Parallel Opportunities

前提完了後にのみ並行可能: T003/T004/T005、T007/T008、T013/T014、
T015/T016/T017、T031/T032、T038/T039、T047/T048、T052/T053、T059/T060/T061/T062。
現在のタスク生成では実装作業や並行エージェントは起動しない。

## Parallel Example: User Story 1

Phase 2完了後、T015(codec/domain試験)、T016(repository/session試験)、T017(adapter/UI試験)を別ファイルで作成可能。
その後はT018→T019→T020→T021のモデルから保存への順序を維持する。

## Parallel Example: User Story 2

US1完了後、T031(DB管理試験)とT032(UI管理試験)を並行作成し、T033以降は順に接続する。

## Parallel Example: User Story 5

US2完了後、T038(転送契約)とT039(cold start/更新)を並行作成する。App統合はT044一か所へ集約する。

## Parallel Example: User Story 3

US1完了後、T047(純粋outline)とT048(移動E2E)を並行作成する。オフライン結果記録T051はUS5完了を待つ。

## Parallel Example: User Story 4

US2完了後、T052(editor履歴)とT053(UI履歴)を並行作成する。bridge/session変更はT054→T055で直列化する。

## Implementation Strategy

### MVP First (User Story 1 Only)

最初の検証可能な増分はPhase 1〜3。モデル→codec/操作→repository/session→adapter→UIを通し、
文書編集・保存・再読込をデモする。この時点は全MVPの完成ではない。

### Incremental Delivery

US1→US2→US5→US3→US4の順で各checkpointを通過する。
最終MVPには5storyすべてとPhase 8の受け入れが必要。AI/同期/共同編集/アカウント/高度な文書間リンクを追加しない。
モデルの変更が必要になったらdata-model/contracts/ADRへの影響を記録し、既存fixtureの互換性を確認する。

### Parallel Team Strategy

[P]のbatchのみ前提完了後に分担可能。モデル・保存・editorの同一ファイルを跨ぐ統合は担当を一本化する。
UI開発の都合でモデルをTiptap内部JSONへ変更しない。

## Coverage

| Requirement / outcome | Tasks |
| --- | --- |
| FR-001 | T012, T021–T030 |
| FR-002 | T012, T031–T037 |
| FR-003/004 | T009–T011, T019/T020, T023–T029 |
| FR-005/006 | T007–T018, T023–T025, T038/T045/T058 |
| FR-007/008 | T016, T021/T022/T028, T032/T034/T036 |
| FR-009 | T047–T051 |
| FR-010 | T052–T057 |
| FR-011 | T039, T042–T046, T058/T062 |
| FR-012/013 | T010/T011/T018, T038/T040/T045 |
| FR-014 | T016/T021/T022/T031/T033/T058 |
| FR-015 | T011/T017/T023–T025/T060 |
| SC-001/004 | T015/T017/T030/T038/T045/T046/T058 |
| SC-002 | T061 |
| SC-003 | T039/T046/T058/T062 |
| SC-005 | T052–T057/T058 |
| SC-006 | T059 |
| SC-007/008 | T016/T031/T032/T037/T048/T051/T058 |

## Notes

全タスクは未着手。チェックは実行と完了条件の検証後に付ける。
実装中の障害を設計済みという理由で隠さない。OS/参加者/基準端末が必要な検証は明示的に残す。
本一覧はタスクの生成のみを行い、依存インストール・環境変更・アプリ実装は実行していない。
