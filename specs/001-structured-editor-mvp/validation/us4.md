# US4 — automated evidence

- One ProseMirror/Tiptap history, depth 200, explicit structural transaction boundaries.
- 100 individual changes include text, heading level, order and list indent/outdent;
  undo/redo restores exact canonical bodies including IDs and metadata.
- UI verifies history across save, renamed title preserved, undo marks dirty,
  redo cleared on a new edit and history isolated on document switch.
- Native text split/paste and metadata-mismatched joins are covered by integration regressions.
- Real IME interaction remains T060 and is not inferred from synthetic composition tests.
