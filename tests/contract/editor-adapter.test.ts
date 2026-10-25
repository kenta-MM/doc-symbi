import { expect, test } from 'vitest';
import { toEditor, fromEditor } from '../../src/editor/adapter';
import { documents } from '../fixtures/documents';
import { validateDocument } from '../../src/domain/validate';

test.each(documents.map((value, i) => [i, value] as const))('editor fixture %i survives ten round trips', (_, value) => {
  let document = validateDocument(value);
  for (let round = 0; round < 10; round++) document = fromEditor(toEditor(document), document);
  expect(document).toEqual(value);
});
test('unknown nodes, marks, attributes and extra item paragraphs are rejected', () => {
  const document = validateDocument(documents[1]);
  for (const body of [
    { type: 'doc', content: [{ type: 'image' }] },
    { type: 'doc', content: [{ type: 'paragraph', attrs: { id: document.blocks[0]!.id, metadata: {}, extra: 1 } }] },
    { type: 'doc', content: [{ type: 'paragraph', attrs: { id: document.blocks[0]!.id, metadata: {} }, content: [{ type: 'text', text: 'a', marks: [{ type: 'bold' }] }] }] },
  ]) expect(() => fromEditor(body, document)).toThrow();
});
