import { expect, test } from 'vitest';
import { applyCommand } from '../../src/domain/block-operations';
import { createDocument } from '../../src/domain/document';
import { fixedIds, fixedTime } from '../helpers/deterministic';

test.each([
  ['\nsecond', 3, ['', 'second']],
  ['first\n', 2, ['first', '']],
  ['\n\nsecond\n\n', 4, ['\n', 'second', '\n']],
  ['first\nsecond\nthird', 8, ['first', 'second', 'third']],
] as const)('cursor heading retains unselected blank lines: %s', (text, offset, expected) => {
  const environment = { id: fixedIds(), clock: () => fixedTime };
  const document = createDocument('heading', environment);
  document.blocks[0] = { ...document.blocks[0]!, kind: 'paragraph', text, metadata: { source: '保持' } };
  const before = structuredClone(document);
  const result = applyCommand(document, { type: 'applyHeading', cursor: true, ranges: [{ id: document.blocks[0]!.id, from: offset, to: offset }] }, environment);
  expect(result.blocks.map(block => 'text' in block ? block.text : null)).toEqual(expected);
  expect(result.blocks[0]!.id).toBe(document.blocks[0]!.id);
  expect(new Set(result.blocks.map(block => block.id)).size).toBe(result.blocks.length);
  expect(result.blocks.every(block => JSON.stringify(block.metadata) === JSON.stringify({ source: '保持' }))).toBe(true);
  expect(document).toEqual(before);
});

test('partial Unicode selection preserves surrounding text, heading level and rejects surrogate splits', () => {
  const environment = { id: fixedIds(), clock: () => fixedTime };
  const document = createDocument('heading', environment);
  const id = document.blocks[0]!.id;
  document.blocks[0] = { id, kind: 'heading', level: 4, metadata: { source: true }, text: '前😀見出し後' };
  const result = applyCommand(document, { type: 'applyHeading', cursor: false, ranges: [{ id, from: 1, to: 6 }] }, environment);
  expect(result.blocks.map(block => 'text' in block ? block.text : null)).toEqual(['前', '😀見出し', '後']);
  expect(result.blocks[1]).toMatchObject({ kind: 'heading', level: 4 });
  expect(() => applyCommand(document, { type: 'applyHeading', cursor: false, ranges: [{ id, from: 2, to: 6 }] }, environment)).toThrow();
});
