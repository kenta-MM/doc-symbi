# Windows Japanese IME acceptance — 未実施

T060 は未完了。自動 compositionstart/compositionend と日本語・絵文字入力の
回帰試験は成功したが、実際の日本語 IME の変換候補・再変換を操作した結果ではない。

通常 Chrome/Edge、Windows 日本語 IME で段落、見出し、listItem、code を各々確認する。
変換候補、確定、再変換、Enter、Undo/Redo、保存→再読込を実行し、欠落/二重入力を記録する。
記録欄: 実施日時、OS/ブラウザ/IME版、対象、操作、期待値、実際、欠落/二重入力件数。
すべて0件の場合のみ完了とする。
