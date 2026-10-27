import { expect, test } from 'vitest';
import { documents } from '../fixtures/documents';
import { readFileSync } from 'node:fs';
// Independent format reader: no imports from domain, application or editor.
function read(text: string) {
  const document = JSON.parse(text) as Record<string, unknown>;
  if (document.format !== 'docsymbi' || ![1, 2].includes(Number(document.schemaVersion)) || !Array.isArray(document.blocks)) throw new Error('Unsupported document');
  const rows: { kind: string; id: string; text: string | null; depth: number; metadata: unknown; level: unknown; style: unknown; image: unknown }[] = [];
  function visit(value: unknown, depth: number, item = false) {
    if (!value || typeof value !== 'object') throw new Error('Invalid element');
    const node = value as Record<string, unknown>;
    const kind = item ? 'item' : node.kind;
    if (!['paragraph', 'heading', 'code', 'list', 'item', 'image'].includes(String(kind)) || typeof node.id !== 'string') throw new Error('Invalid kind/id');
    if (kind === 'heading' && (!Number.isInteger(node.level) || Number(node.level) < 1 || Number(node.level) > 6)) throw new Error('Invalid heading level');
    if (kind === 'image' && document.schemaVersion !== 2) throw new Error('Image requires v2');
    rows.push({ kind: String(kind), id: node.id, text: kind === 'list' || kind === 'image' ? null : String(node.text), depth, metadata: node.metadata,
      level: node.level, style: node.style, image: kind === 'image' ? { file: node.file, caption: node.caption, alt: node.alt, semantics: node.semantics } : undefined });
    if (kind === 'list') {
      if (!['bullet', 'ordered'].includes(String(node.style)) || !Array.isArray(node.items)) throw new Error('Invalid list');
      node.items.forEach(child => visit(child, depth + 1, true));
    }
    if (item) { if (!Array.isArray(node.children)) throw new Error('Invalid item'); node.children.forEach(child => visit(child, depth + 1)); }
  }
  document.blocks.forEach(block => visit(block, 0));
  return { title: document.title, metadata: document.metadata, id: document.id, createdAt: document.createdAt, updatedAt: document.updatedAt, rows };
}
test.each(documents.map((value, i) => [i, value] as const))('format-only reader understands fixture %i', (index, document) => {
  const result = read(JSON.stringify(document));
  expect(result.title).toBe(document.title); expect(result.metadata).toEqual(document.metadata);
  expect(result.id).toBe(document.id); expect(result.createdAt).toBe(document.createdAt); expect(result.updatedAt).toBe(document.updatedAt);
  expect(result.rows[0]).toMatchObject({ id: document.blocks[0]!.id, kind: 'paragraph', depth: 0, metadata: document.blocks[0]!.metadata });
  if (index > 0) {
    expect(result.rows.map(row => row.kind)).toEqual(['paragraph', 'heading', 'code', 'list', 'item', 'list', 'item', 'list', 'item', 'item']);
    expect(result.rows[8]).toMatchObject({ text: '第三階層', depth: 5 });
    expect(result.rows[1]!.level).toBe(index % 6 + 1);
    expect(result.rows.filter(row => row.kind === 'list').map(row => row.style)).toEqual([index % 2 ? 'ordered' : 'bullet', 'ordered', 'bullet']);
  }
});

test('format-only v2 reader preserves every image byte and semantic field', () => {
  const text = readFileSync('docs/azure-sql-hyperscale.docsymbi.json', 'utf8');
  const original = JSON.parse(text) as { blocks: { kind: string; id: string; metadata: unknown; file: unknown; caption: string; alt: string; semantics: unknown }[] };
  const images = original.blocks.filter(block => block.kind === 'image');
  const result = read(text).rows.filter(row => row.kind === 'image');
  expect(result).toHaveLength(images.length);
  result.forEach((row, index) => {
    const block = images[index]!;
    expect(row).toMatchObject({ id: block.id, metadata: block.metadata, image: { file: block.file, caption: block.caption, alt: block.alt, semantics: block.semantics } });
  });
});
