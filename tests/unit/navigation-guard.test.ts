import { expect, test } from 'vitest';
import { DocumentSession } from '../../src/application/document-session';
import { resolveNavigation } from '../../src/application/navigation-guard';
import { deleteCurrentDocument } from '../../src/application/document-management';
import { MemoryRepository } from '../helpers/memory-repository';
import { fixedIds, fixedTime } from '../helpers/deterministic';
test('cancel preserves memory, failure cancels navigation, discard proceeds', async () => {
  const repository = new MemoryRepository();
  const session = new DocumentSession(repository, { id: fixedIds(), clock: () => fixedTime });
  session.create('A'); const original = structuredClone(session.state.document);
  let moved = false; const move = () => { moved = true; };
  await resolveNavigation('cancel', session, move); expect(moved).toBe(false);
  expect(session.state.document).toEqual(original);
  repository.beforeWrite = () => { throw new Error('full'); };
  await expect(resolveNavigation('save', session, move)).rejects.toThrow('full'); expect(moved).toBe(false);
  await resolveNavigation('discard', session, move); expect(moved).toBe(true);
});
test('confirmed delete returns to document list only after success', async () => {
  const repository = new MemoryRepository();
  const session = new DocumentSession(repository, { id: fixedIds(), clock: () => fixedTime });
  session.create('A'); await session.save(); await deleteCurrentDocument(session);
  expect(session.state.document).toBeNull(); expect(await repository.list()).toEqual([]);
});

test('save-and-move stays on the document if another edit occurs during saving', async () => {
  const repository = new MemoryRepository();
  const session = new DocumentSession(repository, { id: fixedIds(), clock: () => fixedTime });
  session.create('before');
  let release!: () => void;
  repository.beforeWrite = () => new Promise<void>(resolve => { release = resolve; });
  let moved = false;
  const navigation = resolveNavigation('save', session, () => { moved = true; session.close(); });
  await Promise.resolve(); session.rename('during save'); release();
  await expect(navigation).rejects.toThrow('変更');
  expect(moved).toBe(false);
  expect(session.state.document!.title).toBe('during save');
  expect(session.state.dirty).toBe(true);
});

test('deletion completing after a new draft does not close that draft', async () => {
  const repository = new MemoryRepository();
  const session = new DocumentSession(repository, { id: fixedIds(), clock: () => fixedTime });
  session.create('delete'); await session.save();
  let release!: () => void;
  const remove = repository.delete.bind(repository);
  repository.delete = async (id, revision) => { await new Promise<void>(resolve => { release = resolve; }); await remove(id, revision); };
  const deleting = deleteCurrentDocument(session);
  session.create('new draft'); release(); await deleting;
  expect(session.state.document!.title).toBe('new draft');
});
