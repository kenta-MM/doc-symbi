# Setup validation — 2026-10-25

## Resume audit

The interrupted working tree contained a minimal React page and partially configured
test tooling. Only T001 was checked in tasks.md. No domain, repository, editor,
or application implementation was present. Existing staged/unstaged changes were retained.

## Verified

- Node 22.23.4 via `.tools/node-v22.23.4-win-x64`.
- `npm ls --depth=0`: all direct dependencies installed with exact versions; no invalid peers reported.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- Temporary negative probes: domain importing React, domain using `window`, and
  a two-file dependency cycle were each rejected; probes removed afterward.
- `npm run test:unit`: 1 helper test passed, Node environment without browser.
- `npm run build`: passed, Vite 8.3.5. This is the minimal page, not a PWA yet.
- All quickstart script names exist; app is private and has no publishing ignore requirement.
- `.gitignore` and ESLint ignores cover installed/build/test/local-tool artifacts.
  No Docker, Terraform, Helm, or Prettier configuration is present.

## Browser verification pending

The first integration run failed because Playwright Chromium was not installed.
An isolated persistent-profile test was added in `tests/integration/environment.spec.ts`.
The initial browser download failed with sandbox network `EACCES`; retried through
the escalation mechanism with install destination `.tools/playwright`.
T005 remains open until launch, navigation, isolation, and browser shutdown pass.
The failed runner was interrupted after it remained in teardown without exiting.

No domain/application behavior, contract suite, E2E suite, performance, real IME,
or participant acceptance has passed at this point.

## Browser verification completed

- Installed Chromium 156.0.8078.4 (Playwright revision 1248) under `.tools/playwright`.
- Integration test passed in sandbox, but runner teardown did not terminate.
- Re-executed the same command through escalation: **1 passed (2.6s), exit code 0**.
- Two fresh persistent profiles had isolated localStorage; both browser contexts closed.
- T005 and T006 completed. Phase 1 complete; next task T007/T008.
