import { expect, test } from 'vitest';
import { createDocument, renameDocument } from '../../src/domain/document';
import { deepFreeze, fixedIds, fixedTime } from '../helpers/deterministic';

test('new document has one stable empty paragraph and injected identity/time', () => {
  const document = createDocument('新しい文書', { id: fixedIds(), clock: () => fixedTime });
  expect(document.title).toBe('新しい文書');
  expect(document.createdAt).toBe(fixedTime);
  expect(document.blocks).toEqual([{ kind: 'paragraph', id: '00000000-0000-4000-8000-000000000002', metadata: {}, text: '' }]);
});
test('rename trims only its input, preserves creation and guards clock rollback', () => {
  const document = deepFreeze(createDocument(' 元の名前 ', { id: fixedIds(), clock: () => fixedTime }));
  const renamed = renameDocument(document, ' 新しい名前 ', () => '2020-01-01T00:00:00.000Z');
  expect(renamed.title).toBe('新しい名前');
  expect(renamed.createdAt).toBe(fixedTime);
  expect(renamed.updatedAt).toBe(fixedTime);
  expect(renamed.blocks).toEqual(document.blocks);
  expect(document.title).toBe(' 元の名前 ');
  expect(() => renameDocument(document, '  ', () => fixedTime)).toThrow();
});
test('no-op rename does not update time; meaningful rename does', () => {
  const document = createDocument('same', { id: fixedIds(), clock: () => fixedTime });
  expect(renameDocument(document, ' same ', () => '2027-01-01T00:00:00Z')).toEqual(document);
  expect(renameDocument(document, 'different', () => '2027-01-01T00:00:00Z').updatedAt).toBe('2027-01-01T00:00:00Z');
});
