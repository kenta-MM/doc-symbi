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
