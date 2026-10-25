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
