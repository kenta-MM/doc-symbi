import { expect, test } from 'vitest';
import { fixtureDocument } from '../fixtures/documents';
import { validateDocument } from '../../src/domain/validate';
import { fromEditor, toEditor } from '../../src/editor/adapter';
import { deserialize, serialize } from '../../src/domain/codec';
import { applyCommand } from '../../src/domain/block-operations';
import { bodyVersion } from '../../src/domain/rich-text';
import { bodyText } from '../../src/domain/catalog';

const question = { prompt: '日本の首都は？', options: ['東京', '大阪'], correctIndex: 0, explanation: '日本の首都は東京です。' };
const quiz = () => ({ kind: 'quiz' as const, id: crypto.randomUUID(), metadata: { original: true }, questions: [structuredClone(question)] });

test('quiz upgrades version, round trips and preserves identity when edited', () => {
  const base = validateDocument(fixtureDocument()), block = quiz();
  const environment = { id: () => crypto.randomUUID(), clock: () => base.updatedAt };
  const inserted = applyCommand(base, { type: 'insertBlock', index: 0, block }, environment);
  expect(inserted.schemaVersion).toBe(4);
  expect(deserialize(serialize(fromEditor(toEditor(inserted), inserted)))).toEqual(inserted);
  const updated = applyCommand(inserted, { type: 'updateQuiz', id: block.id, questions: [{ ...question, explanation: '変更した解説' }] }, environment);
  expect(updated.blocks[0]).toEqual({ ...block, questions: [{ ...question, explanation: '変更した解説' }] });
  expect(bodyText(updated)).toContain('変更した解説');
  expect(bodyText(updated)).toContain('大阪');
  expect(bodyVersion([{ kind: 'quiz' }, { kind: 'table' }], 3)).toBe(4);
});

test('invalid question definitions and quiz in an old document version are rejected', () => {
  const base = fixtureDocument(), block = quiz();
  for (const questions of [[], [{ ...question, prompt: ' ' }], [{ ...question, options: ['only'] }], [{ ...question, correctIndex: 2 }], [{ ...question, correctIndex: -1 }], [{ ...question, explanation: '' }], [{ ...question, answer: 0 }]]) {
    expect(() => validateDocument({ ...base, schemaVersion: 4, blocks: [{ ...block, questions }] })).toThrow();
  }
  expect(() => validateDocument({ ...base, schemaVersion: 3, blocks: [block] })).toThrow();
});
