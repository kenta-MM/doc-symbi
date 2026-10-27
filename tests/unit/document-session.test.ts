import { expect, test } from 'vitest';
import { DocumentSession } from '../../src/application/document-session';
import { MemoryRepository } from '../helpers/memory-repository';
import { fixedIds, fixedTime } from '../helpers/deterministic';
import { RepositoryError } from '../../src/application/errors';

test('new, edit during save, serialized retry and clean transitions', async () => {
  const repository = new MemoryRepository();
  const session = new DocumentSession(repository, { id: fixedIds(), clock: () => fixedTime });
  session.create('test');
  expect(session.state.dirty).toBe(true);
  let release!: () => void;
  repository.beforeWrite = () => new Promise<void>(resolve => { release = resolve; });
  const saving = session.save();
  await Promise.resolve();
  session.rename('edited during save');
  release();
  await saving;
  expect(session.state.dirty).toBe(true);
  expect(session.state.baseRevision).toBe(1);
  repository.beforeWrite = undefined;
  await session.save();
  expect(session.state.dirty).toBe(false);
  expect(session.state.baseRevision).toBe(2);
});
test('failure keeps current data, revision and last successful save; retry works', async () => {
  const repository = new MemoryRepository();
  const session = new DocumentSession(repository, { id: fixedIds(), clock: () => fixedTime });
  session.create('test'); await session.save();
  session.rename('new');
  const snapshot = structuredClone(session.state.document);
  repository.beforeWrite = () => { throw new RepositoryError('QuotaExceeded', 'full'); };
  await expect(session.save()).rejects.toHaveProperty('code', 'QuotaExceeded');
  expect(session.state.document).toEqual(snapshot);
  expect(session.state.baseRevision).toBe(1);
  expect(session.state.saveState).toBe('error');
  expect((await repository.get(snapshot!.id)).document.title).toBe('test');
  repository.beforeWrite = undefined;
  await session.save();
  expect(session.state.saveState).toBe('saved');
});
test('deleted document is never recreated by stale save', async () => {
  const repository = new MemoryRepository();
  const session = new DocumentSession(repository, { id: fixedIds(), clock: () => fixedTime });
  session.create('test'); await session.save();
  await repository.delete(session.state.document!.id, 1);
  session.rename('stale');
  await expect(session.save()).rejects.toHaveProperty('code', 'NotFound');
  expect(await repository.list()).toEqual([]);
});

test('automatic resume never overwrites a draft created while the read is pending', async () => {
  const repository = new MemoryRepository();
  const session = new DocumentSession(repository, { id: fixedIds(), clock: () => fixedTime });
  session.create('saved'); await session.save();
  const stored = await repository.get(session.state.document!.id);
  session.close();
  let release!: () => void;
  repository.get = () => new Promise(resolve => { release = () => resolve(stored); });
  const loading = session.load(stored.document.id, session.state);
  await Promise.resolve();
  session.create('new draft');
  release(); await loading;
  expect(session.state.document!.title).toBe('new draft');
  expect(session.state.dirty).toBe(true);
});

test('manual load rejects edits made while reading and latest load wins', async () => {
  const repository = new MemoryRepository();
  const session = new DocumentSession(repository, { id: fixedIds(), clock: () => fixedTime });
  session.create('saved'); await session.save();
  const stored = await repository.get(session.state.document!.id);
  const releases: ((value: typeof stored) => void)[] = [];
  repository.get = () => new Promise(resolve => releases.push(resolve));
  const loading = session.load(stored.document.id);
  await Promise.resolve(); session.rename('keep this edit');
  releases[0]!(stored);
  await expect(loading).rejects.toThrow('変更');
  expect(session.state.document!.title).toBe('keep this edit');
  const first = session.load(stored.document.id);
  await Promise.resolve();
  const second = session.load(stored.document.id);
  await Promise.resolve();
  releases[2]!({ ...stored, document: { ...stored.document, title: 'latest request' } });
  await second;
  releases[1]!(stored); await first;
  expect(session.state.document!.title).toBe('latest request');
});

test('uncommitted title is dirty and is included in saves and asynchronous guards', async () => {
  const repository = new MemoryRepository();
  const session = new DocumentSession(repository, { id: fixedIds(), clock: () => fixedTime });
  session.create('title'); await session.save();
  session.setTitleDraft('draft title');
  expect(session.state.dirty).toBe(true);
  expect(session.state.document!.title).toBe('title');
  await session.save();
  expect((await repository.get(session.state.document!.id)).document.title).toBe('draft title');
  session.setTitleDraft('   ');
  await expect(session.save()).rejects.toThrow();
  expect(session.state.document!.title).toBe('draft title');
  expect(session.state.dirty).toBe(true);
});
