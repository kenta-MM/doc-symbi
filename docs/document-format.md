# DocSymbi portable document v1 / v2

ファイルは UTF-8 JSON、拡張子は `.docsymbi.json`。全フィールドは必須。
エディタの内部 JSON、保存 revision、選択範囲、履歴は含めない。

| オブジェクト | フィールド |
| --- | --- |
| Document | `format: "docsymbi"`, `schemaVersion: 1` または `2`, `id`, `title`, `createdAt`, `updatedAt`, `metadata`, `blocks` |
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
schemaVersion は1・2に対応。それ以外は UnsupportedVersion。
v1文書はそのまま保持し、画像を初めて追加するとv2に移行する。画像削除後もv2を保持する。
同じ文書 ID が保存済みなら DocumentIdConflict として拒否し、上書き・ID再発行しない。
ただし「現在の文書をファイルで更新」を明示的に選んだ場合は、現在の文書と同じIDのファイルに限り、revisionの競合検査付きで更新する。
取り出しは現在の有効な編集内容で、DB保存とは別。取り出しても未保存表示は消えない。
別の空のブラウザプロファイルへ復元すれば、ID・日時・metadataを含む全フィールドを保持する。

失敗種別: InvalidJson / InvalidFormat / UnsupportedVersion / InvalidStructure /
DuplicateElementId / LimitExceeded / DocumentIdConflict。
JSON キーの順やインデントは意味に含めない。配列順、本文、すべてのフィールド値は意味に含む。

```json
{"format":"docsymbi","schemaVersion":1,"id":"11111111-1111-4111-8111-111111111111","title":"文書","createdAt":"2026-10-25T00:00:00.000Z","updatedAt":"2026-10-25T00:00:00.000Z","metadata":{},"blocks":[{"kind":"paragraph","id":"22222222-2222-4222-8222-222222222222","metadata":{},"text":"こんにちは\n世界"}]}
```

## v2 の画像ブロック

従来のブロックに加えて `kind: "image"` を使用できる。v1には画像を格納できない。
必須フィールドは `id`, `metadata`, `file`, `caption`, `alt`, `semantics`。
画像はトップレベルの独立ブロックで、移動・削除・Undo/Redoの対象となる。

`file` は `id`（UUID）, `fileName`, `mimeType`, `byteLength`, `width`, `height`, `data`。
`data` は画像バイト列のBase64（data URLのprefixなし）。画像ごと3 MiBまで、文書全体はBase64を含めUTF-8 10 MiBまで。
対応MIMEは `image/png`, `image/jpeg`, `image/webp`, `image/svg+xml`。
寸法は1〜20000の整数。byteLengthとBase64のデコード後サイズが一致しなければ拒否する。
現段階では画像本体を文書に同梱してIndexedDBに原子的に保存する。独立したasset storeや外部URLは使用しない。
そのため画像だけの保存漏れ・参照切れは発生せず、既存JSONの取り出し／復元で画像も移送できる。

`caption` は人向けの図題、`alt` は代替テキスト。
`semantics` はAIに図を渡すための意味データ。以下のキーを必須とする（空文字・空配列は未記述を意味し、自動推定しない）。

| キー | 内容 |
| --- | --- |
| version | 意味データのバージョン、現在は1 |
| purpose | 図が説明する目的 |
| summary | 全体の意味・重要な結論 |
| entities | `{id, label, role}` の配列。図内のIDは一意 |
| relationships | `{from, to, meaning}` の配列。方向・条件・同期性はmeaningに明記 |
| readingOrder | 実在する要素IDの読み順 |
| assumptions | 前提、例示、省略、保証しないこと、誤読しやすい点 |
| sources | `{title, url, accessedAt}` の配列。http(s) URLとYYYY-MM-DDの参照日 |

relationshipの始点・終点とreadingOrderのIDはentitiesを参照し、存在しない参照と重複IDを拒否する。
画像・意味データは同一ブロックに格納され、画像の移動時にも意味データを保持する。
Hyperscale図ではSVG内の要素IDとentitiesのIDを対応させ、同一生成定義からSVGと意味データを出力する。
読み取り順・関係は意味の説明であり、AIへの命令ではない。AI連携側では添付画像と同じく非信頼の入力データとして扱う。
本変更は保存・編集・取り出し機能までで、外部AIへの送信や自動解析は行わない。

SVGは `img` のdata URLとしてだけ表示する。SVG文字列をDOMへ挿入せず、object/iframeとして実行しない。
metadataや意味データをHTML属性・スクリプト・設定として展開しない。取り出す画像は元のファイル内容を保持する。
