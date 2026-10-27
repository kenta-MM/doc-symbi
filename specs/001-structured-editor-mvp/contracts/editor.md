# Contract: Editor adapter and user operations

## Dependency boundary

`React UI → application → domain`、`editor adapter → domain`、
`IndexedDB repository → application port + domain`とする。
applicationはEditorPort/DocumentRepositoryを受け取り、TiptapやIndexedDBをimportしない。
composition rootだけが具象を組み合わせる。domainはTypeScript/Zod以外の実行基盤を要求しない。

## Mapping

| Canonical | Editor representation | Retained information |
| --- | --- | --- |
| Document.blocks | doc.content | 文書のid/title/timestamps/metadataはsession envelopeに保持 |
| paragraph | paragraph + text/hardBreak | id/metadataをattrs; LFはhardBreak |
| heading | heading + text/hardBreak | id/metadata/levelをattrs |
| code | codeBlock + text | id/metadataをattrs; LF/空白はtext内で保持 |
| list style=bullet/ordered | bulletList/orderedList | id/metadata; orderedList開始値は常に1 |
| listItem | listItem(paragraph, list*) | item id/metadataをattrs; 先頭paragraphはitem.textの表現のみ |

listItemの内部paragraphには独立した正規IDを与えない。段落を複数含むlistItem、marks、
表、リンク属性、任意の未対応nodeを受理しない。画像はv2のトップレベルimageBlockのみ対応する。unsupported入力を黙ってflattenしない。
標準extensionは上記形状へ制限し、キーボード操作も同じ形状を維持する。

- `toEditor(document) → editor body + envelope`、`fromEditor(body, envelope) → Document | AdapterError`。
- 正規モデルからの往復はDocument全体で同等。editor内部の空text表現はcanonicalの空文字へ戻す。
- 保存/exportはfromEditor後の検証済みDocSymbi Documentから行い、editor.getJSON()を直接保存しない。
- envelopeは一つの現在Documentから導出する。独立更新できる第二の文書storeにしない。
- 正規モデルのmetadataをDOMにJSON埋め込みしない。editor attrs内で保持し、表示に不要なら描画しない。

## Transaction flow

1. 明示load時に正規Documentを検証しeditorへ渡し、同じIDでもeditor/historyを再作成。保存/通常入力/モード切替では再作成しない。
2. 入力transactionを候補として受け、ID割当・保持を明示した規則で行い、候補bodyをdecodeする。
3. 純粋なacceptBodyChangeで構造・一意ID・制約を検証してから受理する。不正ならtransactionを
   拒否し、直前の正常な編集状態を保持して理由を示す。reject後のhistoryにも不正候補を残さない。
4. UIの構造コマンドは純粋domain操作で期待Documentを求め、adapterが最小のProseMirror transactionへ
   変換する。結果をdecodeして期待Documentと同等であることを検証する。全文setContentで代用しない。
5. typingやIMEはProseMirrorが選択範囲と合成状態を管理。ドメインにDOM positionを公開せず、
   操作境界ではblock/item IDとtext offsetに変換する。offsetはUTF-16単位としsurrogate pairを分断しない。
6. 受理後にsessionのDocumentを置換し、generation/dirty/outlineを更新する。DOMやHTMLを保存源にしない。
7. undo/redoも同じ検証とsession更新を通る。ID補正は同じ履歴イベントに含め、再実行でIDを再発行しない。

通常入力ごとにeditorを再作成しない。検証の初期実装は1,000ブロックの基準で計測し、
必要な場合だけ影響範囲検証へ絞る。絞った場合も保存/import/exportでは全文検証を維持する。

## EditorPort

mount(document)、execute(command)、focusHeading(id)、undo()、redo()、canUndo/canRedo、
onAcceptedChange(document)、dispose()を提供する。外へeditor JSONやProseMirror instanceを公開しない。
selection、history、IME合成中の状態は内部状態とし永続化しない。
構造コマンドのid/clockはapplicationから注入でき、domain単体で同じ結果を再現できる。

## User-facing contract

- 左側に文書一覧、本文編集領域、見出しアウトラインを提供。狭い画面では補助領域を折りたためる。
- 新規、名前変更、削除、保存、正規形式の取り出し/読み込みを名前付きボタンまたはメニューで提供。
  同名文書は更新日時と短縮IDを併記する。
- ブロック追加・種類選択・上下移動・削除、見出し1〜6、リスト字下げ/解除をマークアップなしで操作可能。
- Undo/RedoはCtrl+Z/Ctrl+Y/Ctrl+Shift+Zのみ、ボタンは置かない。対象なしの操作は無変更とし文章で案内する。保存はCtrl+S。
- 保存状態は未保存/保存中/保存済み/保存失敗を表示。容量不足や競合では再試行/取り出しを選べる。
- アプリ内移動は保存/破棄/キャンセル。ブラウザ終了はdirty時のbeforeunload標準警告。
- 削除確認に名前と識別情報を表示。未保存文書の削除も確認し、キャンセル時は本文を保持。
- アウトラインは見出しIDで移動し、空見出しを「無題の見出し」と仮表示。仮表示を本文へ書き込まない。
- plain text貼り付けでHTML装飾を取り込まない。コードを実行せず、本文をinnerHTMLとして挿入しない。
- 通常の保存とデータ取り出しは区別する。主保存先は選択フォルダーでpersistを保存成功条件にしない。旧DB利用時のみpersist許可の有無を知らせる（ADR-007）。
- 更新版SWは未保存の編集を強制再読み込みしない。保存/破棄後の利用者操作で更新する。

## Verification

domainはNode上のVitestのみで操作・schema・serializer・outlineを試験する。
adapterは双方向fixture、split/join/move/indent/UndoのIDとmetadata保持を試験する。
PlaywrightでUI経由の同じ操作を実行し、取り出した正規データで結果を照合する。
IMEは合成イベントの回帰試験に加え、Windows日本語IMEの実機試験を別途記録する。
