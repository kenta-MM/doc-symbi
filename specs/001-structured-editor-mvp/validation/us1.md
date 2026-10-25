# US1 — 2026-10-25

- Unit: 61 passed. Contract: 50 passed (24 documents × 10 codec cycles and
  24 × 10 editor-adapter cycles, plus rejection cases).
- Chromium integration: 10 passed, including 240 real editor → IndexedDB save → get
  cycles; two independent pages racing one revision; quota and transaction abort;
  unknown DB version preserving a sentinel; corrupt stored records rejected.
- `blocked` lifecycle uses an injected blocked event on a real IDB open request.
  DB v1 has no upgrade from an older nonzero schema, so this is handler coverage,
  not a naturally occurring upgrade-blocked scenario.
- Native paragraph split keeps the first ID and clones metadata to the new ID.
  Plain text paste normalizes CRLF; HTML is not imported; metadata is absent from DOM.
- Synthetic composition events passed. Real Windows Japanese IME remains T060.
- 100 individual editor transactions undo/redo to exact canonical bodies including metadata/IDs.
- UI E2E: create/edit Japanese+emoji/save/reload; injected quota failure retains
  current edit and last successful save. Both passed.
- Typecheck, lint and production build passed. Build warns about a >500 kB chunk;
  performance acceptance has not been measured yet.

Fixed during validation: the code block Enter shortcut initially handled all
nodes; restricted it to active code blocks and reran the native input regression.

All browser tests use isolated profiles and bundled production-mode assets.
The separate `.test-build` contains the test harness; normal `dist` does not.
This increment does not establish offline, import/export, real IME, or UX acceptance.
