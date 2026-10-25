import { expect, test } from 'vitest';
import { fixedIds, deepFreeze } from '../helpers/deterministic';
test('deterministic IDs and immutable input helper', () => { const id = fixedIds(); expect(id()).not.toBe(id()); const value = deepFreeze({ child: { text: 'a' } }); expect(Object.isFrozen(value.child)).toBe(true); });
