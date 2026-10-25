# Acceptance status — implementation complete, manual acceptance pending

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
| SC-006 | 20/20 each on actual Ultra 7 machine | Reference machine NOT RUN, T059 |
| SC-007 | failure, corruption, unknown version, collision and CAS | PASS |
| SC-008 | management/outline/cancellation regressions | PASS |

## Constitution and architecture

| Principle | Assessment |
| --- | --- |
| I Human/AI coexistence | Visual editing and independently readable canonical JSON |
| II Structured documents | Zod-derived model; editor JSON never stored as canonical |
| III Semantic integrity | IDs/metadata retained, lossful joins rejected, atomic saves |
| IV Local first | IndexedDB, app-shell SW, portable files, no document upload |
| V Modularity | Domain/application ports/editor/infrastructure/UI boundaries checked |
| VI Quality | Strict TypeScript, typed failures, lint/cycle checks passed |
| VII Tests | 188 automated tests; real IME and browser acceptance explicitly pending |
| VIII UX | Named controls, failure/save state, navigation guard; five-person evaluation pending |
| IX Incremental delivery | Setup→model→save/editor→management→offline→outline/history |
| X Compatibility | Format v1, strict unknown-version rejection, format documentation |

ADR-001–006 preserved: React/Vite desktop PWA, Zod canonical boundary, Tiptap adapter,
single ProseMirror history, IndexedDB atomic revisions, exact-version toolchain.
Native list joins were strengthened to prevent metadata loss. Long-document focus
adds explicit element scrolling. No architecture or persistent-format change required.

Some test coverage is consolidated in editor-commands.spec.ts rather than separate
editor-history.spec.ts files; behavior and evidence are described in us1/us3/us4.md.
Service Worker test harness exists only in `.test-build`; normal `dist` excludes it.

## Next actions

1. T059: rerun on the specified i5-1135G7/16GB/SSD reference machine, record power mode.
2. T060: execute actual Japanese IME cases in ime.md.
3. T061: collect five participant observations in usability.md.
4. T062: execute ordinary Chrome/Edge matrix, including persist and close warnings.
5. T063/T064: incorporate results and mark MVP complete only when no failed/unrun criteria remain.

No extension hooks: `.specify/extensions.yml` was absent in both pre/post checks.
No commit, merge, deployment or external publication was performed.
