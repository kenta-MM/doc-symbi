# Contract: DocumentRepository

application/portsに置くUI非依存インターフェース。IndexedDB実装はinfrastructureに置く。
汎用CRUD基底クラスは設けない。下記はTypeScriptで実装する契約記法でありHTTP APIではない。

| Method | Result / semantics |
| --- | --- |
| list() | DocumentSummary[]: id/title/updatedAt/revision; updatedAt降順、同値はid順 |
| get(id) | StoredDocumentまたはNotFound。保存値も再検証 |
| create(document) | revision=1のStoredDocument。存在するidはConflict |
| save(document, expectedRevision) | revisionを1増やしたStoredDocument。存在必須、revision一致必須 |
| delete(id, expectedRevision) | 成功またはNotFound/Conflict。読み取りと削除を同一transactionで実行 |

名前変更もDocumentをドメインで更新してsaveする。同名タイトルは許可する。
DocumentSummaryは正規データと別に独立更新せず、同一レコードまたはそのindexから読む。

## Atomicity

- database=`docsymbi`、DB structure version=1、object store=`documents`、keyPath=`document.id`。
  document.updatedAtに非unique index。format schemaVersionとは別の版である。
- 書込前にschema検証とsnapshot固定。readwrite transaction内でget→存在/revision検査→add/put/delete。
  DB外のawaitやネットワーク処理を入れない。durability=`strict`を要求する。
- request successでは未完了。transaction complete後だけPromiseを成功させ、UIの保存状態を更新する。
- 例外・abort・容量不足は全変更を失敗とし、直前の正常保存を維持する。
- delete後の古いsaveはNotFound。新規createに切り替えて文書を復活させない。
- application側で文書ごとのsaveを直列化。revision検査が真の競合防止であり、
  BroadcastChannel等の通知が届くことを正しさの前提にしない。
- 同一revisionへの並行saveは1件のみ成功。別タブのrename/deleteにも同じ規則を適用する。

## Errors and lifecycle

型付き失敗: NotFound、Conflict、ValidationFailed、QuotaExceeded、StorageUnavailable、Aborted。
失敗で編集メモリを消去しない。list中に破損レコードがあれば対象IDを知らせ、黙って削除しない。
永続化要求persist()の結果と保存成功は別。容量推定値だけで保存可能と断定しない。
DB upgradeがblockedなら既存画面を閉じる案内を出し、DB削除で解決しない。
未知のDB構造版は破壊せずStorageUnavailableとして開けない理由を示す。

## Contract tests

in-memory実装はapplicationテスト用に限定し、本番IndexedDBに同じ契約試験を実行する。
並行更新、更新対削除、abort、quota失敗注入、保存中の追加編集、import衝突、
process再起動後の読み込み、破損レコードの拒否を実ブラウザで検証する。
