import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { deserialize, serialize } from '../../src/domain/codec';
import { toEditor, fromEditor } from '../../src/editor/adapter';
import { imageSemanticsSchema } from '../../src/domain/image';
import { applyCommand } from '../../src/domain/block-operations';
import { updateDocumentFromFile } from '../../src/application/document-transfer';
import { MemoryRepository } from '../helpers/memory-repository';

const document = deserialize(readFileSync('docs/azure-sql-hyperscale.docsymbi.json', 'utf8'));
test('SVG bytes, image identities and semantic graph survive portable and editor round trips', () => {
  let actual = document;
  for (let i = 0; i < 3; i++) actual = deserialize(serialize(fromEditor(toEditor(actual), actual)));
  expect(actual).toEqual(document);
  const images = actual.blocks.filter(block => block.kind === 'image');
  expect(images).toHaveLength(4);
  for (const image of images) {
    expect(Buffer.from(image.file.data, 'base64').toString('utf8')).toBe(readFileSync(`docs/hyperscale-figures/${image.file.fileName}`, 'utf8'));
    expect(image.semantics.entities.length).toBeGreaterThan(0);
  }
});
test('invalid graph references, duplicate entities, byte counts and version mismatch are rejected', () => {
  const image = document.blocks.find(block => block.kind === 'image')!;
  expect(() => imageSemanticsSchema.parse({ ...image.semantics, readingOrder: ['missing'] })).toThrow();
  expect(() => imageSemanticsSchema.parse({ ...image.semantics, relationships: [{ from: 'missing', to: 'missing', meaning: 'broken' }] })).toThrow();
  expect(() => imageSemanticsSchema.parse({ ...image.semantics, entities: [image.semantics.entities[0], image.semantics.entities[0]] })).toThrow();
  expect(() => deserialize(JSON.stringify({ ...document, schemaVersion: 1 }))).toThrow();
  expect(() => deserialize(JSON.stringify({ ...document, blocks: [{ ...image, file: { ...image.file, byteLength: 1 } }] }))).toThrow();
  expect(() => deserialize(JSON.stringify({ ...document, blocks: [{ ...image, file: { ...image.file, mimeType: 'text/html' } }] }))).toThrow();
});
test('images cannot be silently split or joined as text', () => {
  const image = document.blocks.find(block => block.kind === 'image')!;
  const environment = { id: () => crypto.randomUUID(), clock: () => document.updatedAt };
  expect(() => applyCommand(document, { type: 'split', id: image.id, offset: 0 }, environment)).toThrow();
  expect(() => applyCommand(document, { type: 'replaceText', id: image.id, text: 'oops' }, environment)).toThrow();
});
test('explicit file update keeps identity and rejects other documents and stale revisions', async () => {
  const repository = new MemoryRepository();
  const stored = await repository.create(document);
  await expect(updateDocumentFromFile(serialize(document), repository, crypto.randomUUID(), stored.revision)).rejects.toThrow('ID');
  await updateDocumentFromFile(serialize(document), repository, document.id, stored.revision);
  await expect(updateDocumentFromFile(serialize(document), repository, document.id, stored.revision)).rejects.toThrow();
});

test('images above the former 3 MiB cap survive export, import and editor conversion', () => {
  const image = document.blocks.find(block => block.kind === 'image')!;
  const bytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><!--' + 'x'.repeat(4 * 1024 * 1024) + '--></svg>');
  const large = { ...document, blocks: [{ ...image, file: { ...image.file, mimeType: 'image/svg+xml' as const, data: bytes.toString('base64'), byteLength: bytes.length, width: 1, height: 1 } }] };
  const restored = deserialize(serialize(large));
  expect(restored).toEqual(large);
  expect(fromEditor(toEditor(restored), restored)).toEqual(large);
  for (const data of ['A===', 'AAA', 'AA=A', '!!!!']) expect(() => deserialize(JSON.stringify({ ...large, blocks: [{ ...large.blocks[0], file: { ...large.blocks[0]!.file, data } }] }))).toThrow();
});
