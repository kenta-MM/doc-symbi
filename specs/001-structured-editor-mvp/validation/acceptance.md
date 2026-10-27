# Acceptance status — 2026-10-27, manual acceptance pending

T001–T058 are implemented and automatically validated. T059–T064 remain open:
reference-device performance, real Windows Japanese IME, five first-use participants,
ordinary Chrome/Edge profiles, and the final acceptance sign-off that depends on those results.
README/quickstart and this matrix have been updated now; their final task markers
remain open until the preceding acceptance results can be incorporated.

## Functional requirements

| Requirement | Evidence | Status |
| --- | --- | --- |
| FR-001 create/open | edit-save-reopen E2E, repository integration | Auto PASS |
| FR-002 management | document-management unit/integration/E2E | Auto PASS |
| FR-003 five block types | schema fixtures, adapter, toolbar, full-mvp E2E | Auto PASS |
| FR-004 structure editing | block/list unit, editor-commands integration | Auto PASS |
| FR-005 canonical model | strict schema, independent reader, portable contract | Auto PASS |
| FR-006 preservation | 24×10 cycles, full-field restoration, mixed history | Auto PASS |
| FR-007 explicit save/state | session tests, save/reload E2E | Auto PASS |
| FR-008 failure protection | quota/abort, navigation guard, deletion cancellation | Auto PASS; actual browser close in T062 |
| FR-009 outline | outline unit/E2E, long-document navigation | Auto PASS |
| FR-010 history | 100 mixed operations, undo-redo E2E | Auto PASS |
| FR-011 offline/privacy | cold start, update, full-mvp, network-privacy E2E | Auto PASS; ordinary profiles in T062 |
| FR-012 portability | 24 actual UI exports/restores, format-only reader | Auto PASS |
| FR-013 validation | invalid fixtures, limits, collisions, DB corruption | Auto PASS |
| FR-014 conflicts | two-page CAS and stale delete/save | Auto PASS |
| FR-015 Japanese/code/paste | native/synthetic input, fixtures, plain-text paste | Auto PASS; real IME pending T060 |

## Success criteria

| Criterion | Evidence | Status |
| --- | --- | --- |
| SC-001 | 24 documents × 10 real editor/save/read cycles | PASS |
| SC-002 | five participants | NOT RUN, T061 |
| SC-003 | cold start + all-story offline UI + waiting update | Auto PASS; ordinary browser acceptance pending |
| SC-004 | all 24 fixtures restored into separate empty context | PASS |
| SC-005 | 100 mixed edits undo/redo, save/title/document isolation | PASS |
| SC-006 | Ultra 7: display/navigation 20/20, input 19/20 | Reference machine NOT RUN, T059/T079 |
| SC-007 | failure, corruption, unknown version, collision and CAS | PASS |
| SC-008 | management/outline/cancellation regressions | PASS |

## Constitution and architecture

| Principle | Assessment |
| --- | --- |
| I Human/AI coexistence | Visual editing and independently readable canonical JSON |
| II Structured documents | Zod-derived model; editor JSON never stored as canonical |
| III Semantic integrity | IDs/metadata retained, lossful joins rejected, atomic saves |
| IV Local first | Folder files, legacy IndexedDB migration, app-shell SW, no document upload |
| V Modularity | Domain/application ports/editor/infrastructure/UI boundaries checked |
| VI Quality | Strict TypeScript, typed failures, lint/cycle checks passed |
| VII Tests | 265 automated tests; real IME and browser acceptance explicitly pending |
| VIII UX | Named controls, failure/save state, navigation guard; five-person evaluation pending |
| IX Incremental delivery | Setup→model→save/editor→management→offline→outline/history |
| X Compatibility | v1/v2, strict unknown-version rejection, image contract and migration documentation |

ADR-007–010 supersede the affected parts of ADR-001–006: folder primary storage,
opaque revisions, v2 images, selection-based headings, shortcut-only history and
the adopted ancillary UI scope. These are retrospective alignment records, not
claims of prior design review. React/Vite, Zod, Tiptap and one history remain.

Some test coverage is consolidated in editor-commands.spec.ts rather than separate
editor-history.spec.ts files; behavior and evidence are described in us1/us3/us4.md.
Service Worker test harness exists only in `.test-build`; normal `dist` excludes it.

## Next actions

1. T059: rerun on the specified i5-1135G7/16GB/SSD reference machine, record power mode.
2. T060: execute actual Japanese IME cases in ime.md.
3. T061: collect five participant observations in usability.md.
4. T062/T076: execute ordinary Chrome/Edge matrix, real folder permissions/reconnect and close warnings; persist applies only to the legacy browser store.
5. T063/T064: incorporate results and mark MVP complete only when no failed/unrun criteria remain.

No extension hooks: `.specify/extensions.yml` was absent in both pre/post checks.
No commit, merge, deployment or external publication was performed.

## All 24 acceptance scenarios: online / offline evidence

The following E2E files run in both e2e and e2e-offline projects (all PASS). Unit/contract/integration evidence supplements them where exact semantic equality or injected races cannot be assessed visually. This is automated Chromium evidence, with actual IME/OS permissions excluded.

| Scenario | E2E evidence (tests/e2e/) | Additional evidence / limit |
| --- | --- | --- |
| US1 AC1 new empty document | edit-save-reopen, empty-and-invalid | domain creation |
| US1 AC2 five block types | mixed-lists | editor-commands integration |
| US1 AC3 structural edits | mixed-lists, heading-selection, outline | block/list/heading unit; editor-commands |
| US1 AC4 save/reopen semantics | full-mvp, edit-save-reopen | file-contract 24×10 deep equality |
| US1 AC5 failed save retains data | folder-storage, edit-save-reopen | quota/abort file-contract |
| US1 AC6 empty save/reopen | empty-and-invalid | empty paragraph invariant |
| US2 AC1 identify same-name documents | document-management | repository IDs |
| US2 AC2 rename/reopen | document-management, folder-storage | session title draft |
| US2 AC3 reject blank title | document-management | session invalid-title preservation |
| US2 AC4 delete/cancel | document-management, full-mvp | stale delete integration |
| US2 AC5 unsaved navigation | document-management, lifecycle-safety | delayed load/save/delete unit; real close pending |
| US3 AC1 outline levels/order | outline | outline unit |
| US3 AC2 duplicate exact destination | outline | spatially separated headings, viewport check |
| US3 AC3 live outline updates | outline | text/level/order/delete |
| US3 AC4 no headings | empty-and-invalid | empty outline message |
| US4 AC1 undo/redo edits | heading-selection, mixed-lists, undo-redo | 100 mixed editor events |
| US4 AC2 new edit invalidates redo | undo-redo | actual Ctrl+Y + unchanged content |
| US4 AC3 unavailable feedback | undo-redo | actual keys + visible explanation |
| US4 AC4 history crosses save | undo-redo | session dirty state |
| US4 AC5 document isolation | undo-redo, lifecycle-safety | same-ID load resets history too |
| US5 AC1 offline operations | full-mvp and entire offline project | offline-restart dedicated cold start; normal profiles pending |
| US5 AC2 machine readable export | full-mvp, images | independent-reader v1/v2 levels/style/metadata/image fields |
| US5 AC3 restore other environment | full-mvp | 24 exact documents in isolated context, target also offline |
| US5 AC4 invalid/colliding input | empty-and-invalid, document-transfer | contracts and file errors, original bytes preserved |

Current automated evidence replaces the 2026-10-25 counts above. T065–T074, T078 and T082 are implemented; T075/T076/T079/T080 and dependent final documentation/acceptance gates remain open. README and quickstart have been aligned now; final measured manual outcomes cannot yet be incorporated.
