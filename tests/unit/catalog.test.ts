import { describe, expect, it } from 'vitest';
import { bodyText, documentProperties, folderContains, pathParts, summarize } from '../../src/domain/catalog';
import { validateDocument } from '../../src/domain/validate';
import { fixtureDocument } from '../fixtures/documents';

describe('document catalog', () => {
  it('keeps legacy metadata and supplies defaults without modifying the document', () => {
    const document = validateDocument(fixtureDocument()); const original = structuredClone(document);
    expect(documentProperties(document)).toEqual({ type: 'document', status: 'draft', tags: [] });
    expect(summarize(document, 1, 'EC/詳細設計書').folderPath).toBe('EC/詳細設計書');
    expect(document).toEqual(original);
  });
  it('distinguishes root-relative paths and sibling prefixes', () => {
    expect(folderContains('EC/設計', 'EC/設計/認証')).toBe(true);
    expect(folderContains('EC/設計', 'EC/設計書')).toBe(false);
    expect(folderContains('EC/設計', '別/設計')).toBe(false);
    expect(folderContains('EC/設計', 'EC/設計/認証', false)).toBe(false);
    expect(folderContains('', 'EC/設計')).toBe(true);
  });
  it('rejects path traversal and invalid names', () => {
    for (const path of ['../outside', '/absolute', 'a//b', 'a/../b', 'a\\b', 'a.', 'a/ ']) expect(() => pathParts(path)).toThrow();
    expect(pathParts('EC/認証')).toEqual(['EC', '認証']);
  });
  it('indexes body text but does not search IDs or embedded image data', () => {
    const document = validateDocument(fixtureDocument());
    document.blocks = [{ id: document.blocks[0]!.id, metadata: { hidden: 'not-searchable' }, kind: 'paragraph', text: '本文検索 😀' }];
    expect(bodyText(document)).toBe('本文検索 😀');
  });
});
