# Windows Japanese IME acceptance — 未実施

T060 は未完了。自動 compositionstart/compositionend と日本語・絵文字入力の
回帰試験は成功したが、実際の日本語 IME の変換候補・再変換を操作した結果ではない。

通常 Chrome/Edge、Windows 日本語 IME で段落、見出し、listItem、code を各々確認する。
変換候補、確定、再変換、Enter、Undo/Redo、保存→再読込を実行し、欠落/二重入力を記録する。
記録欄: 実施日時、OS/ブラウザ/IME版、対象、操作、期待値、実際、欠落/二重入力件数。
すべて0件の場合のみ完了とする。

## Chrome の変換中削除（2026-10-31）

本文の入力中に Backspace を押すと確定されるとの報告あり（Chrome / Microsoft IME）。
修正後、同じ利用者から「治った」との確認を受領。この報告症状の解消は確認済み。
ただし、以下の全ブロック種別・再変換等を含む受け入れ全体の完了を意味しない。
`tests/integration/ime-deletion.spec.ts` で Chromium の CDP `Input.imeSetComposition`
を使い、選択された「にほんご」を「にほん」へ短縮し、「日本語」へ変換を続けても
compositionend が発生せず、明示的な確定時だけ発生することを確認した。
さらにカーソルを末尾に置くケースを追加したところ、修正前は削除後の変換結果が
「にほん日本語」と重複する問題を再現。DOM の削除検出が Backspace のキーマップを
照会した際、Tiptap が送る変更のない transaction によって未同期の IME DOM が
再描画されることが原因。変換中だけ、文書・選択・マーク・スクロール・メタデータを
変更しない transaction を無視することで、両ケースが成功した。
編集コマンドと入力補助を含む integration 11 件も成功。
これは Windows IME が実際の Backspace 操作で送るイベント列の完全な再現ではない。
実機では未変換の読み・変換候補表示中の両方で Backspace による削除、続けて入力、
確定を確認する。T060 の実機受け入れは引き続き未完了。
