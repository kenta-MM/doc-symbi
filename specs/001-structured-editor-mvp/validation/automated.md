# Automated validation — 2026-10-27

| Check | Result |
| --- | --- |
| TypeScript strict | PASS (production build includes tsc --noEmit) |
| ESLint + dependency/cycle checks | PASS; 53 source files |
| Unit | 75 passed |
| Contract | 108 passed |
| Chromium integration | 22 passed |
| Chromium E2E | 59 passed across online/offline projects |
| Performance | 1 passed; 20 samples per metric |
| Production build + SW injection | PASS; 5 assets precached |

265 automatic tests passed across the listed suites. The suite uses isolated storage and Chromium 156.0.8078.4; it does not certify ordinary Chrome/Edge profiles or OS folder permissions. FileRepository tests use actual OPFS handles in place of the OS picker. Legacy IndexedDB tests remain as compatibility evidence.

Current coverage includes 24 documents × 10 editor/file save/read cycles, two-page file CAS, stale delete/save, quota/abort preservation, malformed-file errors, all 24 portable files restored with deep equality, and independent v1/v2 semantic reading (heading level, list style, image bytes and descriptions). Selection tests cover partial/reverse/multi-block headings, surrounding empty lines, Japanese/emoji, cursor lines and history. Lifecycle regressions cover late load/delete/save, title drafts, same-ID reload, view switching and unavailable history feedback.

The e2e-offline fixture waits for Service Worker preparation, disconnects, then reloads before each test. True browser/server shutdown and waiting Service Worker updates have dedicated tests. See acceptance.md for the 24 acceptance-scenario mapping. Synthetic composition evidence is not real Windows IME acceptance.

Performance on Core Ultra 7 155H / 31.52 GiB / Windows 11 Pro: display 20/20 within 2000 ms (max 344.4), navigation 20/20 within 1000 ms (max 158.3), input 19/20 within 100 ms (max 101.9). All samples are retained in performance.json; no outlier was removed. This meets the numerical 19/20 criterion on this machine only. The specified i5-1135G7/16GB machine and power settings remain unverified.

Build emits a chunk-size advisory: JS 701.75 kB minified / 214.85 kB gzip. No speculative splitting was introduced. Initial failures from obsolete UI assertions, nondeterministic keyboard selection setup and a recursive Playwright TypeScript payload were corrected and rerun; they were not marked as successful runs.
