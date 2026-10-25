# Browser acceptance matrix

| 環境 | 版 | 実施状態 |
| --- | --- | --- |
| Playwright Chromium、専用profile、headless | 156.0.8078.4 | 自動統合/E2E/性能を実施 |
| 通常 Chrome profile | 未確認 | T062 未実施 |
| 通常 Edge profile | 未確認 | T062 未実施 |

実測OS: Windows 11 Pro 10.0.26300。通常profileの結果を自動profileの結果で代替しない。
両ブラウザで主要操作、キーボード、persist許可/拒否、タブ終了の標準警告、SW更新を確認し、
正確なブラウザ版、日時、期待値、実際の結果を記録する。
利用者の既存データを削除して試験準備しない。
