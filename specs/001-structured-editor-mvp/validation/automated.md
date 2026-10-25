# Automated validation — 2026-10-25

| Check | Result |
| --- | --- |
| TypeScript strict | PASS |
| ESLint + dependency/cycle checks | PASS |
| Unit | 64 passed |
| Contract | 98 passed |
| Chromium integration | 12 passed |
| Chromium E2E | 13 passed |
| Performance | 1 passed; 20 runs per metric |
| Production build + SW injection | PASS; 5 app assets precached |
| Whitespace / diff check | PASS |

188 automatic tests passed. No skipped tests or focused-only suites.

Evidence includes 24 × 10 codec cycles, 24 × 10 editor-adapter cycles,
24 × 10 real editor/IndexedDB save/read cycles, all 24 files exported and restored
through UI in a separate empty browser context with full deep equality,
100 mixed text/heading/order/list history events, native split/paste/composition,
metadata-mismatched native list join rejection, two-page CAS, quota/abort,
corrupt records, unknown DB version, unsaved navigation and deletion cancellation,
offline reload, true browser/server shutdown cold start, waiting SW update protection,
outline and history offline, and no external document requests.

Visual QA: inspected `test-results/editor-review.png` (generated, untracked),
including toolbar, title, save state, outline, code, mixed lists and footer.

Performance (actual Core Ultra 7 155H, ~32 GiB, Windows 11 Pro, headless Chromium
156.0.8078.4): all 20 runs within thresholds; max display 400.9 ms, navigation
124.4 ms, input 98.1 ms. This does NOT certify the specified i5-1135G7/16GB
reference machine. See performance.md/json. Initial timings are retained in
performance-initial.json; input measurement was corrected to beforeinput→paint,
excluding automation transport delay. No failing samples were dropped.

Build warning: the app JS chunk is approximately 677 kB minified (~207 kB gzip).
Measured display target passed on this machine; no speculative code-splitting was introduced.

The blocked-IDB notification is injected on a real open request (DB v1 has no
older nonzero version to upgrade). Real IME, ordinary browser profiles and
first-use participants remain untested; see acceptance.md.
