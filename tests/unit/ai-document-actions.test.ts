import { expect, test, vi } from 'vitest';
import { aiDocumentActionSchema, prepareAiDocument, type AiDocumentAction } from '../../src/application/ai-document-actions';
import { aiDocumentVersion, applyAiDocument } from '../../src/application/apply-ai-document';
import { DocumentSession } from '../../src/application/document-session';
import { MemoryRepository } from '../helpers/memory-repository';
import { fixedIds, fixedTime } from '../helpers/deterministic';

const environment = () => ({ id: fixedIds(), clock: () => fixedTime });
const create: AiDocumentAction = { type: 'create', folderPath: '', title: '導入ガイド', blocks: [{ kind: 'heading', level: 1, text: 'はじめに' }, { kind: 'paragraph', text: '説明\r\n本文' }] };

test('saves new documents to the AI-specified folder and rejects unknown or unsafe paths', async () => {
  const repository = new MemoryRepository();
  const save = vi.spyOn(repository, 'create');
  const session = new DocumentSession(repository, environment());
  for (const folderPath of ['Missing', '../Azure', 'C:\\Azure']) {
    expect(() => applyAiDocument(session, { ...create, folderPath }, aiDocumentVersion(session), ['', 'Azure'], null)).toThrow('作成先フォルダ');
    expect(session.state.document).toBeNull();
  }
  applyAiDocument(session, { ...create, folderPath: 'Azure' }, aiDocumentVersion(session), ['', 'Azure'], null);
  await session.save();
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ title: '導入ガイド' }), 'Azure');
});

test('creates a validated structured draft and saves through the repository', async () => {
  const session = new DocumentSession(new MemoryRepository(), environment());
  applyAiDocument(session, create, aiDocumentVersion(session), [''], null);
  expect(session.state.document?.title).toBe('導入ガイド');
  expect(session.state.document?.blocks[1]).toMatchObject({ text: '説明\n本文' });
  expect(session.state.dirty).toBe(true);
  await session.save();
  expect((await session.repository.get(session.state.document!.id)).document).toEqual(session.state.document);
});

test('updates only the named blocks and preserves other structures and metadata', () => {
  const env = environment();
  const document = prepareAiDocument(create, null, env);
  document.blocks[0]!.metadata = { note: 'keep' };
  const updated = prepareAiDocument({ type: 'update', documentId: document.id, title: null, operations: [{ type: 'replace', id: document.blocks[1]!.id, block: { kind: 'paragraph', text: '改訂版' } }] }, document, env);
  expect(updated.blocks[0]).toEqual(document.blocks[0]);
  expect(updated.blocks[1]).toMatchObject({ id: document.blocks[1]!.id, text: '改訂版' });
  expect(document.blocks[1]).toMatchObject({ text: '説明\n本文' });
});

test('rejects invalid targets, empty documents, and malformed tables without changing the source', () => {
  const env = environment(); const document = prepareAiDocument(create, null, env);
  const original = structuredClone(document);
  expect(() => prepareAiDocument({ type: 'update', documentId: env.id(), title: null, operations: [] }, document, env)).toThrow('修正対象');
  expect(() => prepareAiDocument({ type: 'update', documentId: document.id, title: null, operations: [{ type: 'delete', id: env.id() }] }, document, env)).toThrow('見つかりません');
  expect(() => prepareAiDocument({ type: 'update', documentId: document.id, title: null, operations: document.blocks.map(block => ({ type: 'delete', id: block.id })) }, document, env)).toThrow();
  expect(() => prepareAiDocument({ type: 'create', folderPath: '', title: 'table', blocks: [{ kind: 'table', rows: [['a'], ['b', 'c']] }] }, null, env)).toThrow('列数');
  expect(document).toEqual(original);
  expect(aiDocumentActionSchema.safeParse({ ...create, path: '../secret' }).success).toBe(false);
});

test('rejects stale proposals and never discards unsaved changes to create a document', () => {
  const session = new DocumentSession(new MemoryRepository(), environment());
  const version = aiDocumentVersion(session);
  session.create('手動の下書き');
  expect(() => applyAiDocument(session, create, version, [''], null)).toThrow('変更されました');
  expect(() => applyAiDocument(session, create, aiDocumentVersion(session), [''], null)).toThrow('現在の文書を保存');
  expect(session.state.document?.title).toBe('手動の下書き');
});
