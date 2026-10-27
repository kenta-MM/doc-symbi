# Data Model: DocSymbi v1 / v2

正規モデルはsrc/domainに置く。React、Tiptap、ProseMirror、IndexedDBをimportしない。
Zod strict schemaから型を導出する。以下は保存・変換・操作の規範である。

## Entities

| Entity | Fields | Constraints / relationships |
| --- | --- | --- |
| Document | format, schemaVersion, id, title, createdAt, updatedAt, metadata, blocks | format=`docsymbi`; schemaVersion=1/2; blocksは1個以上 |
| Paragraph | kind, id, metadata, text | kind=`paragraph`; textは空文字も可 |
| Heading | kind, id, metadata, text, level | kind=`heading`; levelは整数1〜6 |
| CodeBlock | kind, id, metadata, text | kind=`code`; 空白・改行をそのまま保持; 実行不可 |
| List | kind, id, metadata, style, items | kind=`list`; style=`bullet`または`ordered`; itemsは1個以上 |
| ListItem | id, metadata, text, children | childrenは0個以上のList; 任意の混在・入れ子 |
| StoredDocument | document, revision | repository内部のみ; revisionは正整数、exportしない |
| EditorSession | document, baseRevision, savedSnapshot, generation, loadVersion, draftTitle, saveState | applicationの揮発状態; 履歴とselectionはeditor adapterが保持 |
| OutlineEntry | headingId, label, level, parentHeadingId | documentから派生。保存しない |

- IDはUUID文字列。文書内の全ブロック・全listItem IDは一意。参照は文書IDと要素IDの組で識別する。
- titleはtrim後に1文字以上。名前変更時だけ前後空白を除去して確定。同名文書は許可。
  importは空白だけの名前を拒否するが、妥当な名前を勝手にtrimし直さない。
- createdAt/updatedAtはUTCのISO 8601文字列。createdAtは不変、updatedAtは意味的編集で更新し、
  保存・export・importだけでは変更しない。時計巻き戻り時は直前updatedAtとの最大値を使う。
- metadataは文字列キーのJSON object。値はnull/boolean/有限number/string/array/objectのみ。
  domain/editor adapterは解釈しない値も保持する。未知の構造キーをmetadataへ移して受理することは禁止。
- 全objectは既知キー以外を拒否。危険なキーによるprototype操作を避け、metadataをDOM/HTMLや設定へ展開しない。
- 本文の文字列はUnicodeの正規化やtrimをしない。改行はモデル上LFを使用し、importにCRがある場合は
  自動変換せず不正形式とする。clipboardのCRLF/CRは新規入力としてLFへ変換する。
- 見出しはトップレベルのみ。listItemはtextと子listだけを持ち、任意のブロック埋め込みは扱わない。
- 空文書は空paragraph一つ。最後のブロック削除は空paragraph一つへの置換であり、blocks=[]は不正。
  空paragraphのIDも永続化し、無操作の読み込みで再発行しない。
- リスト番号は各Listのitems順で1から導出し、開始番号やDOM上の番号は保存しない。
- ツリー包含で順序と親子関係を表す。見出しの論理的な親は直前のより浅い見出しから導く。
  セクション本文を別の階層にも重複保存しない。

## Identity and editing rules

| Operation | Identity / semantics |
| --- | --- |
| text/level/style change, move | 対象IDとmetadataを維持。無関係な要素は深い意味的同等性を維持 |
| insert / external paste | 新しいUUID。貼り付け元のIDは採用しない |
| split | 前半は旧IDとmetadata、後半は新IDとmetadataの複製 |
| join | 先頭のIDを保持。metadataが異なる2要素の結合はMVPでは拒否し、黙って片側を失わない |
| delete | 対象とその子孫だけ削除。Undoで元のIDとmetadataを復元 |
| paragraph ↔ heading | ID/text/metadataを保持。heading化の既定levelは1 |
| indent item | 直前の同階層item配下へ移動。親候補がなければ無操作 |
| outdent item | 親item直後の上位Listへ移動。最上位itemには無操作 |
| undo / redo | 本文のID・構造・metadataを復元。文書の名前変更は巻き戻さない |

リスト操作後に空になったListは削除する。移動先の末尾子Listが同じstyleならそこへ移し、
異なる場合は新Listを生成する。既存Listのmetadataが失われる統合は行わず別Listとして保持する。
削除する空Listのmetadataは当該削除操作の対象であり、Undoで復元する。

## Pure domain operations

画像のfile/caption/alt/semanticsと制約は `../../docs/document-format.md` のv2定義に従う。画像はトップレベルのみ。
revisionは不透明な正整数で連番を要求しない。draftTitleは確定前の作業状態で、保存前に名前の規則で検証する。
見出し選択はblock ID/UTF-16 offsetで指定する。隣接LFをブロック境界に変換しても空の前後断片を残す。
最初の断片は元ID、追加断片は新ID、metadataは複製し既存見出しlevelを保持する。
子Listの種類変更はList ID/metadataと全項目を保持する。

createDocument、renameDocument、replaceText、insertBlock、deleteBlock、moveBlock、
setHeadingLevel、convertParagraphHeading、insertListItem、deleteListItem、indentListItem、
outdentListItem、acceptBodyChange、deriveOutline、serialize、deserializeを純粋関数として定義する。
clock/IDは値または関数引数で注入。結果は新Documentまたは型付きエラーで、引数を変更しない。
不正な対象・階層・metadata損失は失敗させる。acceptBodyChangeはeditorが提案する本文を検証し、
文書のID/title/createdAt/metadataを変更せず受理する境界であり、保存を実行しない。

## Validation and equivalence

1. decodeはUTF-8 JSON構文→format/version→Zod構造→ID一意性・階層制約の順に検証。
2. schemaVersionは1/2に対応、それ以外はUnsupportedVersion。v1は無変換、画像の明示挿入でv2へ移行し画像削除後もv2を保持する（ADR-008）。
3. serialize/deserializeはDocument全体の深い同等性を保証する。JSONキー順・空白は問わない。
4. 編集での同等性は明示した変更箇所とupdatedAt以外について検証する。
5. editor往復も全Documentが等しいことを検証し、保存用revision、selection、履歴は比較対象外。
6. データ量制限はUTF-8ファイル10MiB、本文合計100万Unicodeコードポイント、全要素1万、
   リスト深さ32、metadata深さ16とする。超過時は拒否理由を表示し一部だけ読み込まない。
   これは性能保証範囲（1,000ブロック/10万文字）より広い安全な入力境界である。

## Session transitions

- 新規作成: 有効な空Document→dirty、baseRevision=null。初回保存はcreate。
- load: 検証済みDocumentとrevision→clean。loadVersionを進め同IDでも履歴を新規生成する。待機中に編集が進んだ結果は受理しない。
- edit/rename/undo/redo: generationを増加し、savedSnapshotと意味的比較してdirtyを判定する。
- save: 有効なsnapshot・generationを固定→saving。完了後baseRevisionを更新。
  現在snapshotが保存対象と同等ならclean、保存中に編集が進んでいればdirty。
- save failure: error表示、本文とbaseRevisionを維持。retry可能。並列saveは直列化する。
- conflict/not found: 自動上書き・再作成しない。ローカル編集の取り出しまたは確認付き再読込を案内する。
- delete: expectedRevision一致時のみ削除。開いていた文書なら一覧へ戻り履歴破棄。
- switch/close: dirty/error/savingでは保存完了待ち・破棄・キャンセルを扱う。
  ブラウザのタブ終了にはbeforeunloadの標準警告を使う。強制終了で未保存分は保証しない。
