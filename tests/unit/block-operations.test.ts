import { expect, test } from 'vitest';
import { createDocument } from '../../src/domain/document';
import { applyCommand } from '../../src/domain/block-operations';
import { deepFreeze, fixedIds, fixedTime } from '../helpers/deterministic';

test('split, join, conversion, move and last deletion preserve unaffected data', () => {
  const environment = { id: fixedIds(), clock: () => fixedTime };
  let document = createDocument('test', environment);
  const firstId = document.blocks[0]!.id;
  document = applyCommand(deepFreeze(document), { type: 'replaceText', id: firstId, text: '日本😀語' }, environment);
  expect(() => applyCommand(document, { type: 'split', id: firstId, offset: 3 }, environment)).toThrow();
  const split = applyCommand(document, { type: 'split', id: firstId, offset: 2 }, environment);
  expect(split.blocks[0]).toMatchObject({ id: firstId, text: '日本' });
  expect(split.blocks[1]).toMatchObject({ text: '😀語' });
  expect(split.blocks[1]!.id).not.toBe(firstId);
  expect(applyCommand(split, { type: 'join', id: firstId }, environment)).toEqual(document);
  const heading = applyCommand(split, { type: 'convertParagraphHeading', id: firstId, kind: 'heading' }, environment);
  expect(heading.blocks[0]).toMatchObject({ id: firstId, kind: 'heading', level: 1 });
  const level = applyCommand(heading, { type: 'setHeadingLevel', id: firstId, level: 6 }, environment);
  expect(level.blocks[0]).toMatchObject({ level: 6 });
  const moved = applyCommand(level, { type: 'moveBlock', id: firstId, index: 1 }, environment);
  expect(moved.blocks[1]!.id).toBe(firstId);
  const removed = applyCommand(document, { type: 'deleteBlock', id: firstId }, environment);
  expect(removed.blocks).toHaveLength(1);
  expect(removed.blocks[0]).toMatchObject({ kind: 'paragraph', text: '' });
});
test('joins cannot discard metadata; insertion leaves source unchanged', () => {
  const environment = { id: fixedIds(), clock: () => fixedTime };
  const document = deepFreeze(createDocument('test', environment));
  const block = { kind: 'paragraph' as const, id: environment.id(), text: 'other', metadata: { custom: true } };
  const inserted = applyCommand(document, { type: 'insertBlock', index: 1, block }, environment);
  expect(document.blocks).toHaveLength(1);
  expect(inserted.blocks[0]).toEqual(document.blocks[0]);
  expect(() => applyCommand(inserted, { type: 'join', id: document.blocks[0]!.id }, environment)).toThrow();
});
