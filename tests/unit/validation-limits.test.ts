import { expect, test } from 'vitest';
import { validateDocument, limits } from '../../src/domain/validate';
import { assertTextOffset, normalizeClipboard, utf8Length } from '../../src/domain/text';
import { fixtureDocument } from '../fixtures/documents';
import { fixedIds } from '../helpers/deterministic';

test('one million Unicode code points, not UTF-16 units', () => {
  const base = fixtureDocument();
  const document = { ...base, blocks: [{ ...base.blocks[0]!, text: '😀'.repeat(limits.textPoints) }] };
  expect(() => validateDocument(document)).not.toThrow();
  document.blocks[0]!.text += 'a';
  expect(() => validateDocument(document)).toThrow('100万');
});
test('10000 elements and one above', () => {
  const id = fixedIds();
  const document = { ...fixtureDocument(), blocks: Array.from({ length: limits.elements }, () => ({ kind: 'paragraph', id: id(), metadata: {}, text: '' })) };
  expect(() => validateDocument(document)).not.toThrow();
  document.blocks.push({ kind: 'paragraph', id: id(), metadata: {}, text: '' });
  expect(() => validateDocument(document)).toThrow('10000');
});
function nestedList(depth: number): unknown {
  const id = fixedIds();
  let children: unknown[] = [];
  for (let i = 0; i < depth; i++) children = [{ kind: 'list', id: id(), metadata: {}, style: i % 2 ? 'bullet' : 'ordered', items: [{ id: id(), metadata: {}, text: '', children }] }];
  return children[0];
}
test('32 list levels and one above; hostile depth does not overflow stack', () => {
  expect(() => validateDocument({ ...fixtureDocument(), blocks: [nestedList(32)] })).not.toThrow();
  for (const depth of [33, 2000]) expect(() => validateDocument({ ...fixtureDocument(), blocks: [nestedList(depth)] })).toThrow('32');
});
function nestedMetadata(depth: number): unknown {
  let value: unknown = 'end';
  for (let i = 0; i < depth; i++) value = { child: value };
  return value;
}
test('16 metadata containers and one above', () => {
  expect(() => validateDocument({ ...fixtureDocument(), metadata: nestedMetadata(16) })).not.toThrow();
  expect(() => validateDocument({ ...fixtureDocument(), metadata: nestedMetadata(17) })).toThrow();
});
test('10 MiB serialized document and one byte above', () => {
  const document = { ...fixtureDocument(), metadata: { padding: '' } };
  const overhead = utf8Length(JSON.stringify(document));
  document.metadata.padding = 'a'.repeat(limits.fileBytes - overhead);
  expect(() => validateDocument(document)).not.toThrow();
  document.metadata.padding += 'a';
  expect(() => validateDocument(document)).toThrow('10 MiB');
});
test('unknown metadata including prototype-like keys is retained safely', () => {
  const metadata: unknown = JSON.parse('{"__proto__":{"polluted":true},"constructor":"data"}');
  expect(validateDocument({ ...fixtureDocument(), metadata }).metadata).toEqual(metadata);
  expect(Object.prototype).not.toHaveProperty('polluted');
  const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic;
  expect(() => validateDocument({ ...fixtureDocument(), metadata: cyclic })).toThrow();
  for (const value of [new Date(), undefined, () => 1, NaN]) expect(() => validateDocument({ ...fixtureDocument(), metadata: { value } })).toThrow();
});
test('UTF-16 offsets never split emoji and clipboard conversion is explicit', () => {
  expect(() => assertTextOffset('a😀b', 2)).toThrow();
  for (const offset of [0, 1, 3, 4]) expect(() => assertTextOffset('a😀b', offset)).not.toThrow();
  for (const offset of [-1, 5, 0.5]) expect(() => assertTextOffset('a😀b', offset)).toThrow();
  expect(normalizeClipboard(' a\r\nb\rc ')).toBe(' a\nb\nc ');
});
