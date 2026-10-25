# Implementation Plan: DocSymbi 構造化ドキュメントエディタ初期MVP

**Branch**: `main`（setup resolverのfeature識別値: `001-structured-editor-mvp`） | **Date**: 2026-10-25 | **Spec**: [spec.md](spec.md)

**Input**: `specs/001-structured-editor-mvp/spec.md`とユーザー指定の技術・アーキテクチャ要件。

## Summary

独自の版付きドキュメントモデルを正規データとする、ローカルファーストのデスクトップPWAを作る。
TypeScript strict + ZodのドメインをReact/Tiptapから分離し、明示的な双方向adapterで編集基盤へ接続する。
IndexedDBはrepository経由で原子的に保存する。本文の構造とmetadataを保持した往復、
基本的なビジュアル編集、保存失敗と競合の保護を先に完成させる。
本計画はPhase 1まで。アプリ実装、依存導入、tasks.mdの生成は含まない。

## Technical Context

**Language/Version**: TypeScript strict（noUncheckedIndexedAccess、exactOptionalPropertyTypesも有効）、
ES2022。開発Node.jsは22系22.12以上。実装開始時に互換性を確認してpatch版を固定する。

**Primary Dependencies**: React、Vite、Tiptap 3系 / ProseMirror、Zod 4系。
Workbox build/precachingでPWA資産を管理。Tiptapは必要なnodeとUndoRedoのみを明示登録。

**Storage**: IndexedDB database `docsymbi`。DocumentRepositoryを介した全文レコードとrevision CAS。
独自UTF-8 JSON（schemaVersion=1）の取り出し・読み込みを提供。

**Testing**: Vitestでdomain/application/adapterの単体・契約試験、Playwrightで実IndexedDB統合とE2E。
日本語IMEと初心者5名のUX評価は手動検証を併用。

**Target Platform**: Windows 11、通常プロファイルのデスクトップChrome/Edge。
実装受け入れ時のstable版と正確なバージョンを検証記録へ残す。HTTPSまたは固定localhost origin。

**Project Type**: 単一の静的Webアプリ/PWA。バックエンド・クラウド・AI API・マイクロサービスなし。

**Performance Goals**: 1文書1,000ブロック・10万文字、20回中19回以上で表示2秒以内、
見出し移動1秒以内、入力反映100ms以内。基準端末はWindows 11、Intel Core i5-1135G7、
16GB RAM、SSD、1920×1080、AC電源・省電力無効。実測機が異なる場合は条件差を明記し、
基準端末達成と同一視しない。

**Constraints**: オフライン準備後にサーバー停止でも再起動可能。文書の外部送信なし。
未知版・未知構造は拒否。編集状態と最後の正常保存を失敗時に保護。形式版とDB版を分離。

**Scale/Scope**: 単一利用者、5種類のブロック、見出し6段階、混在入れ子リスト、100履歴イベント。
最低20fixtureを10往復。性能保証範囲と入力安全上限はdata-model.mdで区別する。

## Constitution Check

Phase 0前: 指定スタックと仕様に原則違反なし。詳細設計で確認すべき項目を下表へ割り当てた。
Phase 1後: 下表すべて設計適合。これは動作試験の合格を示すものではない。

| 原則 | 設計証拠・検証 | Gate |
| --- | --- | --- |
| I 人間とAIの共生 | ビジュアル操作と独自JSON; editor/format契約、SC-002/004 | PASS |
| II 構造化ドキュメント | schemaVersion=1、内部JSON直接保存禁止、ADR-002/003 | PASS |
| III 意味と構造の整合性 | ID/metadata規則、全往復と失敗時不変性、SC-001/007 | PASS |
| IV ローカルファースト | IndexedDB + SW + 取り出し/復元、SC-003/004 | PASS |
| V モジュール性 | domain/application/editor/infrastructure/uiの依存方向 | PASS |
| VI コード品質 | strict、Zod、境界import制限、単一プロジェクト | PASS |
| VII テスト | Vitest/Playwrightと実IME、各FRとの対応をquickstartに記載 | PASS |
| VIII UX | 名前付き操作、状態表示、アウトライン、5名評価 | PASS |
| IX 段階的開発 | 下記実装順序、性能は計測後に最適化 | PASS |
| X 将来互換性 | 独自形式版、repository port、ADRの将来影響記録 | PASS |

重要な判断はresearch.mdのADR-001〜006に記録済み。各ADRに理由、代替、トレードオフ、
リスク、テスト方針を記載。構造・データ・依存を大きく変える際は再レビューする。
例外・原則違反・未解決の技術確認事項はない。

## Project Structure

### Documentation (this feature)

```text
specs/001-structured-editor-mvp/
├── spec.md
├── plan.md
├── research.md                  # ADR-001〜006を含む
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── document-format.md
│   ├── repository.md
│   └── editor.md
└── checklists/requirements.md
```

### Source Code (repository root)

以下は実装フェーズで作成する配置であり、現在存在するコードではない。

```text
src/
├── domain/                     # Zodモデル、純粋操作、形式変換、outline
├── application/
│   ├── ports/                  # DocumentRepository / EditorPort
│   └── document-session.ts     # use cases、dirty/saving、世代・revision
├── editor/                     # Tiptap schema、双方向adapter、command/history
├── infrastructure/
│   └── indexeddb/              # repository実装、transaction/error対応
├── ui/                         # React一覧、toolbar、outline、dialogs
├── offline/                    # SW登録、準備状態、更新制御
└── main.tsx                    # composition root
public/                         # 同梱icon、manifest
scripts/                        # build後のSW生成
tests/
├── unit/                       # domain/application
├── contract/                   # serializer、adapter、repository
├── integration/                # 実IndexedDB・editor
├── e2e/                        # UI、offline restart、failure
├── fixtures/                   # 20件以上の正規データと不正データ
└── performance/                # 基準文書・計測
```

**Structure Decision**: 単一npmプロジェクト。domainはUI/editor/browser APIに依存しない。
applicationはportとdomainへ依存。editorとIndexedDB実装はportを満たし、mainのみで組み立てる。
ReactはapplicationとUI用stateへ依存する。循環依存とdomainから外側へのimportを静的検査で禁止する。
repositoryは保存先変更という明示要件のための一つの境界であり、汎用DI基盤や基底クラスは導入しない。

## Complexity Tracking

憲章違反なし。例外承認や追加の複雑性は不要。

## Phase 0 — Research outcome

[research.md](research.md)で技術選定と公式資料を記録した。
独自モデル、Tiptap bridge、IndexedDB原子保存、PWA準備、履歴、実機IMEのリスクを特定して解決方針を定めた。
現環境はNode 20.18.0で開発基準未満。実装開始時にNode更新と依存互換性確認を行う。

## Phase 1 — Design outcome

[data-model.md](data-model.md)と3契約に、型・検証・変換・保存・UIの振る舞いを定義した。
[quickstart.md](quickstart.md)は実装後に実行するコマンドと期待結果を定める。
設計検査として全15 FR、8 SCと指定の10アーキテクチャ要件の割当を確認した。

## Implementation sequence for task generation

1. 基盤とdomain: strict設定、Zod v1、純粋操作、fixture、serialize往復を完成させる。
2. repositoryとsession: IndexedDBの原子的保存、revision、失敗保護、移植ファイルを契約試験する。
3. 最小の編集縦断: Reactで新規paragraph→Tiptap→domain→保存→再読み込みを通す。
4. 全ブロック・リスト・IDとmetadata保持、Undo/Redo、アウトライン、文書管理を追加する。
5. PWA準備と更新、通信断再起動、失敗・競合・IME・性能・UXの受け入れ検証を完了する。

各段階で対応するテストを実施し、失敗を残して次の機能拡大へ進めない。
AI、共同編集、外部形式変換、汎用plugin基盤は追加しない。

