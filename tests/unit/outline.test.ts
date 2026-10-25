import { expect, test } from 'vitest';
import { deriveOutline } from '../../src/domain/outline';
import { createDocument } from '../../src/domain/document';
import { fixedIds, fixedTime, deepFreeze } from '../helpers/deterministic';
test('nearest shallower heading, duplicate labels, empty labels and no mutation', () => {
  const id = fixedIds(); const document = createDocument('outline', { id, clock: () => fixedTime });
  document.blocks = [1, 3, 3, 2, 6].map((level, index) => ({ kind: 'heading', id: id(), metadata: {}, level, text: index === 4 ? '' : '同名' }));
  const before = structuredClone(document); const entries = deriveOutline(deepFreeze(document));
  expect(entries.map(entry => entry.parentHeadingId)).toEqual([null, document.blocks[0]!.id, document.blocks[0]!.id, document.blocks[0]!.id, document.blocks[3]!.id]);
  expect(entries[4]!.label).toBe('無題の見出し'); expect(document).toEqual(before);
  expect(deriveOutline(createDocument('empty', { id, clock: () => fixedTime }))).toEqual([]);
});
