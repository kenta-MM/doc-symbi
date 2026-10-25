import { expect, test } from 'vitest';
import { documents } from '../fixtures/documents';
// Independent format reader: no imports from domain, application or editor.
function read(text: string) {
  const document = JSON.parse(text) as Record<string, unknown>;
  if (document.format !== 'docsymbi' || document.schemaVersion !== 1 || !Array.isArray(document.blocks)) throw new Error('Unsupported document');
  const rows: { kind: string; id: string; text: string | null; depth: number; metadata: unknown }[] = [];
  function visit(value: unknown, depth: number, item = false) {
    if (!value || typeof value !== 'object') throw new Error('Invalid element');
    const node = value as Record<string, unknown>;
    const kind = item ? 'item' : node.kind;
    if (!['paragraph', 'heading', 'code', 'list', 'item'].includes(String(kind)) || typeof node.id !== 'string') throw new Error('Invalid kind/id');
    rows.push({ kind: String(kind), id: node.id, text: kind === 'list' ? null : String(node.text), depth, metadata: node.metadata });
    if (kind === 'list') {
      if (!['bullet', 'ordered'].includes(String(node.style)) || !Array.isArray(node.items)) throw new Error('Invalid list');
      node.items.forEach(child => visit(child, depth + 1, true));
    }
    if (item) { if (!Array.isArray(node.children)) throw new Error('Invalid item'); node.children.forEach(child => visit(child, depth + 1)); }
  }
  document.blocks.forEach(block => visit(block, 0));
  return { title: document.title, metadata: document.metadata, rows };
}
test.each(documents.map((value, i) => [i, value] as const))('format-only reader understands fixture %i', (index, document) => {
  const result = read(JSON.stringify(document));
  expect(result.title).toBe(document.title); expect(result.metadata).toEqual(document.metadata);
  expect(result.rows[0]).toMatchObject({ id: document.blocks[0]!.id, kind: 'paragraph', depth: 0, metadata: document.blocks[0]!.metadata });
  if (index > 0) {
    expect(result.rows.map(row => row.kind)).toEqual(['paragraph', 'heading', 'code', 'list', 'item', 'list', 'item', 'list', 'item', 'item']);
    expect(result.rows[8]).toMatchObject({ text: '第三階層', depth: 5 });
  }
});
