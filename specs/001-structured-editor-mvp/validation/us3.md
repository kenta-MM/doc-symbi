# US3 — automated evidence

- Unit: nearest preceding shallower parent, level jumps, duplicate names, empty placeholder and input immutability.
- UI: heading insertion, label update, correct focus, removal and empty state passed.
- Offline full-story test used outline navigation without network.
- The 1,000-block test exposed a missing viewport movement for distant headings.
  Explicit node scrolling after focus fixed it; all 20 navigation measurements then passed.
  No synthetic heading text is written to the canonical document.
