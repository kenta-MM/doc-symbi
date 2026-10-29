import { expect, test } from 'vitest';
import { fixtureDocument } from '../fixtures/documents';
import { validateDocument } from '../../src/domain/validate';
import { fromEditor, toEditor } from '../../src/editor/adapter';
import { deserialize, serialize } from '../../src/domain/codec';
import { applyCommand } from '../../src/domain/block-operations';
import { bodyVersion, safeLink } from '../../src/domain/rich-text';

test('rich text, nested list formatting, table and language survive file and editor round trips', () => {
  const base = fixtureDocument();
  const common = () => ({ id: crypto.randomUUID(), metadata: {} });
  const rich = { text: 'hello\nworld', formatting: [{ from: 0, to: 5, bold: true, href: 'https://example.com' }, { from: 6, to: 11, href: '#article=' + base.id }] };
  const document = validateDocument({ ...base, schemaVersion: 3, blocks: [
    { ...common(), kind: 'paragraph', ...rich },
    { ...common(), kind: 'list', style: 'bullet', items: [{ ...common(), ...rich, children: [] }] },
    { ...common(), kind: 'table', rows: [[{ ...common(), header: true, ...rich }], [{ ...common(), header: false, text: 'cell' }]] },
    { ...common(), kind: 'code', text: 'const x = 1', language: 'typescript' },
  ] });
  let actual = document;
  for (let i = 0; i < 10; i++) actual = deserialize(serialize(fromEditor(toEditor(actual), actual)));
  expect(actual).toEqual(document);
});

test('selected heading and split keep formatting within their new text boundaries', () => {
  const base = fixtureDocument();
  const document = validateDocument({ ...base, schemaVersion: 3, blocks: [{ kind: 'paragraph', id: base.blocks[0]!.id, metadata: {}, text: 'before selected after', formatting: [{ from: 0, to: 21, bold: true }] }] });
  const environment = { id: () => crypto.randomUUID(), clock: () => base.updatedAt };
  const heading = applyCommand(document, { type: 'applyHeading', cursor: false, ranges: [{ id: document.blocks[0]!.id, from: 7, to: 15 }] }, environment);
  expect(heading.blocks.map(block => 'formatting' in block ? block.formatting : undefined)).toEqual([[{ from: 0, to: 7, bold: true }], [{ from: 0, to: 8, bold: true }], [{ from: 0, to: 6, bold: true }]]);
  const split = applyCommand(document, { type: 'split', id: document.blocks[0]!.id, offset: 7 }, environment);
  expect(fromEditor(toEditor(split), split)).toEqual(split);
});

test('unsafe links, overlong ranges, malformed tables and duplicate cell IDs are rejected', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,test', 'https://example.com\nattack']) expect(safeLink(value)).toBe(false);
  const base = fixtureDocument();
  const paragraph = { kind: 'paragraph', id: base.blocks[0]!.id, metadata: {}, text: 'x', formatting: [{ from: 0, to: 2, bold: true }] };
  expect(() => validateDocument({ ...base, schemaVersion: 3, blocks: [paragraph] })).toThrow();
  const cell = { id: crypto.randomUUID(), metadata: {}, text: 'x', header: false };
  expect(() => validateDocument({ ...base, schemaVersion: 3, blocks: [{ kind: 'table', id: crypto.randomUUID(), metadata: {}, rows: [[cell, cell]] }] })).toThrow();
  expect(bodyVersion([{ kind: 'paragraph', metadata: { language: 'ja', formatting: 'original' } }], 1)).toBe(1);
});
