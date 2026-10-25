import { describe, expect, test } from 'vitest';
import { documentSchema } from '../../src/domain/schema';
import { validateDocument } from '../../src/domain/validate';
import { documents, fixtureDocument } from '../fixtures/documents';
import { invalidDocuments } from '../fixtures/invalid-documents';
import { deepFreeze, fixedIds } from '../helpers/deterministic';

describe('canonical v1 document', () => {
  test.each(documents.map((document, index) => [index, document] as const))('preserves fixture %i', (_, document) => {
    expect(validateDocument(deepFreeze(document))).toEqual(document);
    expect(documentSchema.parse(document)).toEqual(document);
  });
  test.each(invalidDocuments)('rejects %s without mutation', (_, input) => {
    const before = structuredClone(input);
    expect(() => validateDocument(input)).toThrow();
    expect(input).toEqual(before);
  });
  test('requires every document field', () => {
    for (const key of Object.keys(fixtureDocument())) {
      const input: Record<string, unknown> = { ...fixtureDocument() };
      delete input[key];
      expect(() => validateDocument(input)).toThrow();
    }
  });
  test('rejects malformed lists and nested unsupported fields', () => {
    const id = fixedIds();
    const item = { id: id(), metadata: {}, text: '', children: [] };
    const list = { kind: 'list', id: id(), metadata: {}, style: 'bullet', items: [item] };
    for (const bad of [{ ...list, items: [] }, { ...list, style: 'check' },
      { ...list, items: [{ ...item, blocks: [] }] }, { ...list, items: [{ ...item, children: [fixtureDocument().blocks[0]] }] }]) {
      expect(() => validateDocument({ ...fixtureDocument(), blocks: [bad] })).toThrow();
    }
  });
});
