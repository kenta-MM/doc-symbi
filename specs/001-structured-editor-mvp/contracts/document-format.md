# Contract: Portable DocSymbi document

## Format

UTF-8 JSON、推奨拡張子`.docsymbi.json`、media type `application/json`。
[data-model.md](../data-model.md)を正規仕様とする。エディタJSONを入れ子に保存してはならない。
全required fieldを明示し、metadata/childrenも省略せず空object/arrayで表す。

```json
{
  "format": "docsymbi",
  "schemaVersion": 1,
  "id": "11111111-1111-4111-8111-111111111111",
  "title": "はじめての文書",
  "createdAt": "2026-10-25T00:00:00.000Z",
  "updatedAt": "2026-10-25T00:00:00.000Z",
  "metadata": {},
  "blocks": [
    {
      "kind": "paragraph",
      "id": "22222222-2222-4222-8222-222222222222",
      "metadata": {},
      "text": "こんにちは"
    }
  ]
}
```

## Operations

- `serialize(document) → UTF-8 JSON`: validation成功後のみ出力。内容、ID、時刻、metadataを変更しない。
- `deserialize(text) → Document | ImportError`: unknown inputを厳密検証。parse時の自動削除・補完はしない。
- exportは現在の有効な編集snapshotを取り出す。ローカルDB保存状態は変更せず、未保存表示も消さない。
- importはファイル全体を検証してからrepository.createを実行する。既存文書IDとの衝突は拒否し、
  自動上書きやID再発行はしない。別の空環境への復元では全IDと時刻を保持する。
- 型付き失敗: InvalidJson、InvalidFormat、UnsupportedVersion、InvalidStructure、DuplicateElementId、
  LimitExceeded、DocumentIdConflict。利用者向けには理由と対象fieldを表示し、生データを外部送信しない。
- 保存形式の拡張はschemaVersion変更と移行ADRを伴う。バージョンのないデータをv1とみなさない。

## Acceptance

20件以上のfixtureでserialize→deserialize、空環境へのimport→exportの深い同等性を保証する。
未対応版・node・余剰キー・破損・制限超過は元ファイルと既存保存を一切変更せず拒否する。
形式説明だけを使う検証器で全種別、順序、階層、metadataを取得できることを確認する。
