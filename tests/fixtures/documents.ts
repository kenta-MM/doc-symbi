import { fixedIds, fixedTime } from '../helpers/deterministic';

// Fixtures deliberately do not import the implementation under test.
export function fixtureDocument(index = 0) {
  const id = fixedIds();
  const metadata = { source: '日本語', nested: { values: [null, true, 1.5, '😀'] } };
  const base = { format: 'docsymbi', schemaVersion: 1, id: id(), title: ` 文書 ${index} `,
    createdAt: fixedTime, updatedAt: fixedTime, metadata };
  const paragraph = { kind: 'paragraph', id: id(), metadata, text: index === 0 ? '' : ' 日本語😀\n  本文 ' };
  const heading = { kind: 'heading', id: id(), metadata, text: index % 2 ? '見出し' : '', level: index % 6 + 1 };
  const code = { kind: 'code', id: id(), metadata, text: '  const 日本語 = "😀";\n\n\t終わり  ' };
  const child = { kind: 'list', id: id(), metadata, style: 'bullet', items: [
    { id: id(), metadata, text: '第三階層', children: [] },
  ] };
  const middle = { kind: 'list', id: id(), metadata, style: 'ordered', items: [
    { id: id(), metadata, text: '第二階層', children: [child] },
  ] };
  const list = { kind: 'list', id: id(), metadata, style: index % 2 ? 'ordered' : 'bullet', items: [
    { id: id(), metadata, text: '第一階層\n😀', children: [middle] },
    { id: id(), metadata: {}, text: '', children: [] },
  ] };
  return { ...base, blocks: index === 0 ? [paragraph] : [paragraph, heading, code, list] };
}
export const documents = Array.from({ length: 24 }, (_, index) => fixtureDocument(index));
