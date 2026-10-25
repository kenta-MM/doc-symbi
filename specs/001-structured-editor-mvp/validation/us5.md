# US5 — automated evidence

- Portable contract: all 24 fixtures import/export with every field retained; duplicate IDs rejected.
- Independent reader: all 24 fixtures interpreted without importing domain/application/editor modules.
- `docs/document-format.md` specifies all v1 fields, constraints, limits and failures.
- Service Worker precaches bundled app assets only. No document runtime cache or external upload.
- Real cold start: prepared persistent profile closed, test server stopped, browser relaunched
  offline with the same profile; app opened, document read, edited and saved successfully.
- Waiting SW update preserved unsaved content; cancel preserved edits; save then update preserved saved text.
- Offline integration UI exercised edit, rename, save, outline, history, delete cancellation and portable restoration.
- Registration failure does not prevent editing/saving. Persist status is distinct from save status.

Fixed: library-mode bundling initially left `process.env.NODE_ENV` references in the worker.
Build now defines production mode explicitly; offline/update tests passed after the fix.
Final exact test counts are recorded in automated.md.
