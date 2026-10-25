# Model and port validation — 2026-10-25

T007–T014 implemented. 24 independent fixtures cover empty content, all five user-facing
block types, heading levels 1–6, mixed three-level lists, Japanese/emoji/LF/whitespace,
and metadata at document/block/item/list levels.

- Initial schema test run failed because domain/schema did not exist (red phase).
- Initial document lifecycle test failed because domain/document did not exist (red phase).
- Final `test:unit`: 54 passed across 4 files.
- `typecheck`, `lint`, `build`: passed.
- Boundary and boundary+1 checks: 1,000,000 code points, 10,000 elements,
  32 list levels, 16 metadata containers, 10 MiB serialized UTF-8.
- Unknown fields/types, duplicate IDs, invalid dates, CR, cyclic metadata,
  non-JSON values and malformed list containment are rejected.
- Prototype-like metadata keys remain data; Object.prototype is unchanged.
- New documents and rename preserve identity/content/creation time; no-op and clock rollback tested.
- Repository and editor ports expose canonical data, independent commands, revisions,
  and typed repository errors without browser/editor implementation dependencies.

Recursive schema getter annotations follow the [Zod recursive object guidance](https://zod.dev/api#recursive-objects).
Canonical types are inferred from schema rather than maintained as a second model.
This is model validation only, not evidence of editor, persistence, or MVP acceptance.
