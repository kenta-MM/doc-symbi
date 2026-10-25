# DocSymbi portable document v1

ファイルは UTF-8 JSON、拡張子は `.docsymbi.json`。全フィールドは必須。
エディタの内部 JSON、保存 revision、選択範囲、履歴は含めない。

| オブジェクト | フィールド |
| --- | --- |
| Document | `format: "docsymbi"`, `schemaVersion: 1`, `id`, `title`, `createdAt`, `updatedAt`, `metadata`, `blocks` |
| Paragraph | `kind: "paragraph"`, `id`, `metadata`, `text` |
| Heading | `kind: "heading"`, `id`, `metadata`, `text`, `level`（整数1〜6） |
| Code | `kind: "code"`, `id`, `metadata`, `text` |
| List | `kind: "list"`, `id`, `metadata`, `style`（`bullet` / `ordered`）, `items` |
| ListItem | `id`, `metadata`, `text`, `children`（Listの配列） |

blocks と items は1個以上。children は空配列でもよい。見出しはトップレベルのみ。
順序は配列の順、包含は親子関係を表す。リストは種類が混在して入れ子になれる。
番号は各リストで1から始まり、別の開始番号フィールドはない。
空文書は空文字の paragraph が一つ。コードは実行せず文字列として扱う。

id は UUID 文字列。文書内の全ブロック・全項目の ID は一意。文書 ID は別の名前空間。
title は空白だけを禁止し、名前変更時だけ前後空白を除去する。import は妥当な title を保持する。
日時は UTC ISO 8601（Z終端）。createdAt は編集で変えない。
text は Unicode文字列、空文字可。空白・改行・絵文字を保存時に正規化しない。
改行は LF。import 時の CR は拒否する。貼り付け入力のみ CRLF/CR を LF に変換する。

metadata は文字列キーの JSON object。null / boolean / 有限number / string / array / objectを保持する。
未知の metadata は保持し、DOM/HTML属性や設定に展開しない。
構造オブジェクトの未知キーは拒否する。未知キーを metadata へ移して補完しない。

安全上限: UTF-8ファイル10 MiB、本文合計100万Unicodeコードポイント、
ブロックと項目の合計1万、List深さ32、metadataのobject/array深さ16（根を1）。

読み込みは JSON構文、format/version、構造、IDと上限を検証する。
schemaVersion が1以外は UnsupportedVersion。推測や自動移行は行わない。
同じ文書 ID が保存済みなら DocumentIdConflict として拒否し、上書き・ID再発行しない。
取り出しは現在の有効な編集内容で、DB保存とは別。取り出しても未保存表示は消えない。
別の空のブラウザプロファイルへ復元すれば、ID・日時・metadataを含む全フィールドを保持する。

失敗種別: InvalidJson / InvalidFormat / UnsupportedVersion / InvalidStructure /
DuplicateElementId / LimitExceeded / DocumentIdConflict。
JSON キーの順やインデントは意味に含めない。配列順、本文、すべてのフィールド値は意味に含む。

```json
{"format":"docsymbi","schemaVersion":1,"id":"11111111-1111-4111-8111-111111111111","title":"文書","createdAt":"2026-10-25T00:00:00.000Z","updatedAt":"2026-10-25T00:00:00.000Z","metadata":{},"blocks":[{"kind":"paragraph","id":"22222222-2222-4222-8222-222222222222","metadata":{},"text":"こんにちは\n世界"}]}
```
