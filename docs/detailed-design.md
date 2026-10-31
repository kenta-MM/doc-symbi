# DocSymbi 詳細設計書

更新日: 2026-10-30。現行ワークスペースのソースを基準とする。[基本設計書](basic-design.md)と[文書形式](document-format.md)を併読する。

## 1. モジュールの責務

| ソース | 責務 |
| --- | --- |
| `src/domain/schema.ts`, `validate.ts`, `codec.ts` | strictスキーマ、上限・一意性検証、JSON入出力 |
| `src/domain/rich-text.ts`, `image.ts`, `quiz.ts` | 書式・版判定、画像・意味データ、クイズの制約 |
| `src/domain/*-operations.ts`, `accept-body-change.ts` | ID・metadataを保持する純粋編集操作と本文変更受理 |
| `src/domain/catalog.ts`, `outline.ts` | 一覧用派生データ、パス検証、見出しアウトライン |
| `src/application/document-session.ts` | 編集状態、保存キュー、読み込み要求の競合制御 |
| `src/application/document-management.ts`, `document-transfer.ts` | 文書管理、import/export、同一ID更新 |
| `src/application/ports/` | repository、folder storage、editorの境界 |
| `src/editor/adapter.ts`, `transaction-bridge.ts`, `identity.ts` | 正規モデルとの変換、transaction検証、ID保持 |
| `src/editor/editor-controller.ts`, `input*.ts` | カーソル操作、履歴、入力支援、貼り付け |
| `src/infrastructure/files/` | ファイル探索・保存・移動・改名、ディレクトリー複写 |
| `src/infrastructure/indexeddb/` | ブラウザー内repository |
| `src/ui/App.tsx`, `EditorPane.tsx` | 画面・選択・モード管理、sessionとeditorの接続 |
| `src/ui/use-ai-chat.ts`, `src/platform/ai-chat.ts` | 会話状態、HTTP/NDJSON通信、中断 |
| `server/ai-plugin.ts`, `server/codex-client.ts` | ローカルAPI、CLI子プロセスとのstdio通信 |
| `src/offline/`, `scripts/build-service-worker.mjs` | オフライン準備検査・更新・キャッシュ生成 |

## 2. セッションと保存

`SessionState`は`document`、`baseRevision`、`savedSnapshot`、`generation`、`loadVersion`、`draftTitle`、`dirty`、`saveState`、`error`を持つ。履歴と選択範囲はeditor側に持ち、保存しない。

| 操作 | 処理と遷移 |
| --- | --- |
| `create(title, folderPath)` | 空段落を持つv1文書を作り、revision=null、dirty=true。保存待ちがあれば拒否 |
| `accept(document)` | 全文検証と現在ID照合後、generationを増やし保存snapshotとの同等性からdirtyを計算 |
| `setTitleDraft(title)` | 未確定タイトルを保持しgenerationを更新。保存時のrenameで名前を検証・確定 |
| `load(id, expectedState?)` | 保存キューを待ち、要求番号と世代を取得前後で確認。古い要求を破棄。同IDでもloadVersion更新 |
| `save()` | キューで直列化。実行開始時に文書・generation・revisionを固定し、初回create／以後save |
| 保存成功 | revisionと保存snapshot更新。保存中の追加編集・未確定タイトルがあればdirtyを保持 |
| 保存失敗 | saveState=error、エラーを通知。編集中の本文・baseRevisionを維持し再試行可能 |
| `close()` | 保存待ちがなければ文書をクリアしloadVersion更新 |

`navigation-guard.ts`はdirty・saving・errorを確認対象にする。保存を選択しても保存中に編集が進みガード条件が残れば移動を止める。保存中の破棄も拒否する。UIのモード切替はsessionの保存状態や履歴をリセットしない。

## 3. Repositoryとフォルダー操作

| API | 契約 |
| --- | --- |
| `list()` | 更新日時降順、同値ID順のsummary。createdAt・folderPath・type・tags・status・searchTextも提供 |
| `get(id)` | 検証済み文書とrevision。未検出はNotFound |
| `create(document, folderPath?)` | 未登録IDのみ。空パスは保存先ルート |
| `save(document, expectedRevision)` | 同IDの存在とrevision一致を要求。外部削除された記事を再作成しない |
| `rename?(document, expectedRevision)` | 実ファイル名変更を伴う更新。未接続時はブラウザー内save |
| `move?(id, folderPath, expectedRevision)` | 既存フォルダーへ記事を移動。同名ファイル・外部変更は拒否 |
| `delete(id, expectedRevision)` | revision一致時のみ対象ファイルを削除 |

`FileDocumentRepository`は保存先ルート以下を再帰探索し、拡張子が`.docsymbi.json`のファイルをUTF-8 strict decodeして検証する。不正ファイル・重複文書IDはパス付きエラーとし、部分一覧で成功扱いにしない。

画像を含む文書の通常保存はv5参照形式。`external-images.ts`が画像バイト列と説明JSONを文書専用の`_docsymbi-assets/文書ID/画像ブロックID/`に分離し、読込時に従来の編集用モデルへ復元する。この管理フォルダーは一覧探索から除外する。詳細・上限・移行方法は[画像保存仕様](image-storage.md)を参照。

revisionはSHA-256先頭6バイトを整数化して1を加えた比較トークン。旧形式は文書テキスト、v5は文書テキストと説明JSON・画像のハッシュを比較対象とする。完全なSHA-256値や単調増加カウンターではない。書き込みは`docsymbi-file-write`というWeb Lock内で再走査・revision照合・書き込みを行い、一覧・文書読取は同名の共有ロックで素材整理と競合しないようにする。新規ファイル名は安全化したタイトル（最大60 UTF-16単位）とランダムUUIDから生成する。素材を先に書いて検証し、最後に文書本体を更新する。write/close失敗時はabortし、新規素材と初回作成で残った空文書を除去する。

記事移動は元データとコピーのrevisionを照合してから元を削除する。元削除に失敗したら検証済みコピーを残して両方の確認を案内する。フォルダー改名も全内容のコピーとfingerprint照合後に元を再帰削除する。途中失敗により二重配置が残った場合は、重複IDエラーの原因となるため利用者が確認する。

`FolderStorage`は`restore/choose/reconnect/migrate`と、任意の`folders/createFolder/renameFolder/deleteFolder`を提供する。`deleteFolder(path, recursive=false)`は既定で非再帰だが、UIは削除確認後にtrueを渡す。対象にはDocSymbi以外のファイルも含む。ルートの改名・削除は拒否する。

保存先ハンドルはIndexedDB `docsymbi-folder` v1の`settings` store、キー`directory`に保持する。未接続時の文書は`docsymbi` v1の`documents` storeに保存する。ハンドル記憶の失敗は今回選択した保存先を無効化せず警告にする。

## 4. 正規モデルとeditor変換

`deserialize`は入力バイト上限→JSON parse→format/version→`validateDocument`の順に処理する。`validateDocument`は再帰スキーマ評価に先立ち循環・要素数・ID・本文長・リスト深さを走査し、その後Zod strict schemaと出力JSONサイズを検査する。

| 正規表現 | Editor表現 |
| --- | --- |
| paragraph / heading | paragraph / heading、改行はhardBreak、id/metadata/levelはattrs |
| list / item | bulletListまたはorderedList / listItem内の先頭paragraphと子list |
| code | codeBlock、text内の改行・language属性 |
| image | imageBlockのfile/caption/alt/semantics/displaySize属性 |
| table | table→tableRow→tableCellまたはtableHeader→単一paragraph |
| quiz | quizBlockのquestions属性、回答はnode view内の揮発状態 |
| formatting | UTF-16範囲をbold/link marksに相互変換 |

listItem・表セル内の補助paragraphには独立した正規IDを与えない。未対応node/markや不正構造は黙って平坦化せず拒否する。本文候補をadapterでdecodeし、`acceptBodyChange`で検証してからsessionへ通知する。拒否時は正常な本文と履歴を保護する。

`EditorPort`はmount、setEditable、execute、focusHeading、applyHeading、undo/redo、onAcceptedChange、disposeを提供する。カーソル操作・挿入・リンク・選択通知・自動変換設定は任意メソッド。ポート外へProseMirror instanceや位置型を公開しない。

入力支援は段落先頭の見出し・リスト記号、コードフェンス、空段落のスラッシュメニュー、画像の貼り付け／ドロップを処理する。通常のテキスト貼り付けでは記号変換しない。詳細は[入力支援の検証資料](input-assistance-validation.md)に記載する。

## 5. 一覧・画面状態

`catalog.ts`はmetadataから表示用type/tags/statusを導出し、未設定ならdocument／空タグ／draftとする。本文検索文字列は段落・リスト・表セル・画像caption/alt・クイズ問題／選択肢／解説から生成する。読み込みのみで既存metadataを書き換えない。

`DocumentCatalog`の`selectedId`とsessionの開いた文書は別状態。行クリックは選択情報のみ、ダブルクリックまたはEnterでloadする。`App`は一覧選択文書の情報を読み取り専用で右パネルに渡す。開いた文書の情報変更はsession.acceptを通す。右パネルのタブ状態はchat／properties／閉で、本文の閲覧・編集状態とは独立する。

フォルダーパスはルート相対の`/`区切り。`pathParts`は空要素、`.`、`..`、予約名、不正文字、末尾ドット／空白などを拒否する。フォルダー所属と検索用summaryは派生状態であり、JSONへ書き戻さない。

## 6. ローカルAI API

以下は本リポジトリの実装契約であり、外部サービスの仕様保証ではない。

| API | 入出力 |
| --- | --- |
| `GET /api/ai/status` | connected、models（id/name/isDefault）、必要に応じerror |
| `POST /api/ai/chat` | JSON: conversationId(UUID)、message、context、任意model。応答はapplication/x-ndjson |
| deltaイベント | type=delta、text、itemId |
| 完了イベント | type=done、status、任意error |
| 失敗イベント | type=error、message |

要求はlocalhost／127.0.0.1／[::1]のHost、`x-docsymbi-ai: 1`、Originが存在する場合は`http://<Host>`一致、cross-siteでないことを検査する。要求本文は600,000バイト、messageはtrim後1〜20,000文字、contextは120,000文字、modelは200文字が上限。同会話の並行要求は409、100会話を超える新規会話は429。生成待ちは180秒で中断する。

会話IDとCLI thread IDの対応はサーバーメモリのみ。CLI切断で対応をクリアする。会話はephemeral・read-only・approvalPolicy=never、shell/multi-agent/Web検索を無効にして開始する。ブラウザー側のAbortControllerによる停止・切断はturn/interruptへ伝える。回答を本文保存に接続する処理はない。

UIの会話・下書きは文書IDとプロバイダー単位で保持する。送信コンテキストでは画像本体を除去し、意味データは保持する。認証はCLIの既存ログインを使用する。`integration`モード、`.test-build`を指定した起動、`DOCSYMBI_DISABLE_AI=1`では実接続を無効にする。

## 7. オフライン・検証対応

Workboxがビルド資産をprecacheし、navigationをindex.htmlへ解決する（tests配下を除外）。`CHECK_READY`は全manifest資産のキャッシュ存在を確認する。`SKIP_WAITING`は利用者の更新適用操作から送る。開発時はService Workerを登録しない。

| 設計対象 | 主な試験定義 |
| --- | --- |
| 形式・制限・互換性 | `tests/unit/schema.test.ts`, `validation-limits.test.ts`, `tests/contract/*document*.test.ts` |
| 保存世代・移動ガード | `tests/unit/document-session.test.ts`, `navigation-guard.test.ts`, `tests/e2e/lifecycle-safety.spec.ts` |
| ファイル・階層・移動 | `tests/integration/file-contract.spec.ts`, `nested-folders.spec.ts`, `folder-move.spec.ts`, `folder-lifecycle.spec.ts` |
| 選択・閲覧・管理 | `tests/e2e/catalog-selection.spec.ts`, `view-mode.spec.ts`, `document-management.spec.ts`, `context-menu.spec.ts` |
| 編集・画像・クイズ | `tests/contract/editor-adapter.test.ts`, `tests/e2e/input-assistance.spec.ts`, `images.spec.ts`, `quiz.spec.ts` |
| AI | `tests/unit/ai-chat.test.ts`, `codex-client.test.ts`, `tests/e2e/ai-chat.spec.ts`, `ai-connection.spec.ts` |
| オフライン・性能 | `tests/e2e/offline-restart.spec.ts`, `offline-update.spec.ts`, `tests/performance/editor.spec.ts` |

試験ファイルの存在は成功実績を意味しない。実OSピッカー・権限、日本語IME、実AI回答、指定端末性能、利用者評価は自動試験の代替対象外であり、実施記録を別途管理する。
