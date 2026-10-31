import { expect, test } from 'vitest';
import { createDocument } from '../../src/domain/document';
import { instantiateTemplate } from '../../src/domain/document-template';
import { summarize } from '../../src/domain/catalog';
import { fixedIds, fixedTime, deepFreeze } from '../helpers/deterministic';

test('template copies have independent identities and preserve rich content and metadata', () => {
  const id = fixedIds();
  const source = createDocument('ひな形', { id, clock: () => fixedTime });
  source.schemaVersion = 4;
  source.metadata = { isTemplate: true, type: 'basic-design', tags: ['API'], status: 'published', custom: { id: 'keep-me' } };
  source.blocks = [
    { kind: 'list', id: id(), metadata: {}, style: 'bullet', items: [{ id: id(), metadata: {}, text: '親', children: [{ kind: 'list', id: id(), metadata: {}, style: 'ordered', items: [{ id: id(), metadata: {}, text: '子', children: [] }] }] }] },
    { kind: 'table', id: id(), metadata: {}, rows: [[{ id: id(), metadata: {}, text: '太字', header: true, formatting: [{ from: 0, to: 2, bold: true }] }]] },
    { kind: 'quiz', id: id(), metadata: {}, questions: [{ prompt: '問題', options: ['A', 'B'], correctIndex: 0, explanation: '解説' }] },
  ];
  deepFreeze(source);
  const copy = instantiateTemplate(source, '新しい文書', { id, clock: () => '2026-10-30T00:00:00.000Z' });
  expect(copy.id).not.toBe(source.id);
  expect(copy.metadata).toEqual({ type: 'document', tags: ['API'], status: 'draft', custom: { id: 'keep-me' } });
  expect(copy.createdAt).toBe('2026-10-30T00:00:00.000Z');
  const ids = (value: unknown): string[] => JSON.stringify(value).match(/00000000-0000-4000-8000-\d{12}/g) ?? [];
  expect(ids(copy.blocks).every(value => !ids(source.blocks).includes(value))).toBe(true);
  const stripIds = (value: unknown) => JSON.stringify(value).replace(/00000000-0000-4000-8000-\d{12}/g, 'ID');
  expect(JSON.parse(stripIds(copy.blocks))).toEqual(JSON.parse(stripIds(source.blocks)));
  expect(summarize(source, 1).isTemplate).toBe(true);
  expect(summarize(copy, 1).isTemplate).toBe(false);
  copy.blocks[0]!.metadata.changed = true;
  expect(source.blocks[0]!.metadata).toEqual({});
});

test('invalid template copies fail before they can be saved', () => {
  const id = fixedIds();
  const source = createDocument('ひな形', { id, clock: () => fixedTime });
  expect(() => instantiateTemplate(source, '  ', { id, clock: () => fixedTime })).toThrow();
});
