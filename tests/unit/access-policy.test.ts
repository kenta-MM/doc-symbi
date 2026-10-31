import { describe, it, expect } from 'vitest';
import { AccessPolicy, type LockState } from '../../src/application/access-policy';
import { quizQuestionSchema } from '../../src/domain/quiz';
import { DocumentSession } from '../../src/application/document-session';
import { applyAiDocument, aiDocumentVersion } from '../../src/application/apply-ai-document';
import type { DocumentRepository } from '../../src/application/ports/document-repository';

describe('user controlled locks', () => {
  function policy() { let state: LockState = { documents: [], folders: [] }; return new AccessPolicy(() => structuredClone(state), value => { state = value; }); }
  it('inherits folder locks and protects parents containing locked documents', () => {
    const access = policy(); access.paths.set('doc', 'parent/child'); access.toggle('folders', 'parent');
    expect(() => access.assertDocument('doc')).toThrow(); expect(() => access.assertFolder('parent/child')).toThrow();
    expect(() => access.assertFolder('parent2')).not.toThrow(); access.toggle('folders', 'parent'); access.toggle('documents', 'doc');
    expect(() => access.assertFolder('parent', true)).toThrow(); expect(() => access.assertFolder('parent')).not.toThrow();
  });
  it('rejects edits and AI creation before changing the session', () => {
    const access = policy(); const session = new DocumentSession({} as DocumentRepository, { id: () => crypto.randomUUID(), clock: () => new Date().toISOString() }, access);
    session.create('test'); const document = session.state.document!; access.toggle('documents', document.id);
    expect(() => session.accept({ ...document, title: 'changed' })).toThrow();
    expect(() => session.setTitleDraft('changed')).toThrow();
    expect(() => applyAiDocument(session, { type: 'update', documentId: document.id, title: 'changed', operations: [] }, aiDocumentVersion(session), [''], null)).toThrow('読み取り専用');
    access.toggle('folders', 'locked'); expect(() => session.create('AI', 'locked')).toThrow(); expect(session.state.document).toBe(document);
  });
});
it('accepts legacy quizzes and validates all multiple choice correct indices', () => {
  const question = { prompt: 'q', options: ['a', 'b'], correctIndex: 0, explanation: 'why' };
  expect(quizQuestionSchema.safeParse(question).success).toBe(true);
  expect(quizQuestionSchema.safeParse({ ...question, multiple: true, correctIndices: [0, 1] }).success).toBe(true);
  for (const correctIndices of [[], [0, 0], [2]]) expect(quizQuestionSchema.safeParse({ ...question, multiple: true, correctIndices }).success).toBe(false);
});
