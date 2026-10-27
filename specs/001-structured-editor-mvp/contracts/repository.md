# Contract: DocumentRepository

2026-10-27: ADR-007により主保存先を利用者の選択フォルダーへ変更する。旧IndexedDB実装は移行元として保持する。
application/portsにUI非依存のインターフェースを置き、実装はinfrastructureに置く。

| Method | Result / semantics |
| --- | --- |
| list() | id/title/updatedAt/revision。更新日時降順、同値ID順。破損ファイルは対象名を示して拒否 |
| get(id) | 検証済みStoredDocumentまたはNotFound |
| create(document) | 未登録IDのみ作成、既存IDはConflict |
| save(document, expectedRevision) | 存在必須、revision一致必須。存在しなければNotFound |
| delete(id, expectedRevision) | revision一致時のみ削除。存在しなければNotFound |

revisionは正整数の不透明な比較トークンであり連番を要求しない。exportには含めない。
通常importはcreateのみ。同一IDの明示ファイル更新はsaveを使用する。

## File storage

- 選択フォルダー直下の `.docsymbi.json` が本文の正規保存先。ハンドルだけをIndexedDB `docsymbi-folder` に記憶する。
- UTF-8を厳密にdecodeし、版/構造/ID/上限を検証する。破損や重複IDを黙って無視しない。
- 同一originのWeb Locks内で読取→内容ハッシュ比較→書込/削除を直列化する。
- createWritableのclose完了後だけ成功。write/close失敗時はabortし既存正常ファイルを保持する。
- 初回失敗で作成された空ファイルは除去して再試行可能にする。外部の非空ファイルを勝手に削除しない。
- 同じrevisionから内容の異なる並行保存は1件のみ成功。内容が変わらない保存は同じトークンでもよい。
- 外部アプリ/別originはWeb Locksに参加しないため検査後競合を完全には防げない。同時編集は対象外。
- 選択の確定とハンドル記憶を分離し、記憶に失敗しても今回の保存先は利用できる。
- 権限失効では再接続を案内。フォルダーの移動/削除は選び直す。サブフォルダーを探索しない。
- 旧DBからのコピーは明示操作で行い、元を保持し、同IDをスキップする。

## Errors and lifecycle

RepositoryErrorのcodeはNotFound/Conflict/ValidationFailed/QuotaExceeded/StorageUnavailable/Aborted。
原因をcauseに、判明している対象IDをdocumentIdに、ファイル名をmessageに保持する。
形式不正/不正UTF-8はValidationFailed、アクセス拒否はStorageUnavailableとし回復方法を表示する。
失敗で編集中のメモリや最後の正常保存データを消去しない。

saveはsnapshot/generationを固定する。待機中に編集が進めばdirtyを維持し、移動を続行しない。
loadは要求順と編集世代を検査し、古い結果を破棄する。同IDの明示loadも本文/履歴を再生成する。
削除完了時に別の文書が開かれていても、その文書を閉じない。
persistの許可は選択フォルダーへの保存成功条件ではない。サイトデータが消えたら保存先を再選択する。

## Legacy IndexedDB

旧DBは `docsymbi` v1、storeは `documents`、keyPathは `document.id`、updatedAt index。
同一readwrite transactionで検査/更新しdurability=strict、complete後成功。旧実装のrevisionは連番。
未知DB版/blocked/破損は非破壊エラー。旧データのコピー後もDBを削除しない。

## Verification

実ファイルAPIで20件以上×10回の編集/保存/読取、二画面CAS、stale delete/save、quota/abort、
形式不正、権限失効と再接続を試験する。旧DBにも既存契約試験を維持する。
OPFS代替による自動試験と、通常Chrome/Edge・OSピッカー・実フォルダーの手動検証を区別する。
