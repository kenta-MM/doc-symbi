import { IndexedDbRepository } from '../../src/infrastructure/indexeddb/document-repository';
import { createDocument } from '../../src/domain/document';
import { fixedIds, fixedTime } from './deterministic';
export function createRepositoryTest() { return new IndexedDbRepository(); }
export async function checkBlockedOpen() {
  const original = IDBFactory.prototype.open;
  IDBFactory.prototype.open = function (name: string, version?: number) {
    const request = version === undefined ? original.call(this, name) : original.call(this, name, version);
    // Version 1 has no migration from an older nonzero DB version. Inject the
    // blocked notification on a real open request to exercise lifecycle cleanup.
    queueMicrotask(() => request.dispatchEvent(new Event('blocked')));
    return request;
  };
  try {
    try { await new IndexedDbRepository().list(); return 'unexpected success'; }
    catch (error) { return (error as { code: string }).code; }
  } finally { IDBFactory.prototype.open = original; }
}

export async function checkRepository() {
  const repository = new IndexedDbRepository();
  const document = createDocument('保存試験', { id: fixedIds(), clock: () => fixedTime });
  const created = await repository.create(document);
  const read = await repository.get(document.id);
  const results = await Promise.allSettled([
    repository.save({ ...document, title: 'first' }, 1),
    repository.save({ ...document, title: 'second' }, 1),
  ]);
  const latest = await repository.get(document.id);
  await repository.delete(document.id, latest.revision);
  let staleCode = '';
  try { await repository.save(document, latest.revision); } catch (error) { staleCode = (error as { code: string }).code; }
  repository.close();
  return { created, read, successCount: results.filter(result => result.status === 'fulfilled').length,
    failureCode: results.find(result => result.status === 'rejected')?.reason.code as string,
    latestRevision: latest.revision, staleCode };
}

export async function checkRepositoryFailures() {
  const repository = new IndexedDbRepository();
  const document = createDocument('正常保存', { id: fixedIds(), clock: () => fixedTime });
  await repository.create(document);
  const original = IDBObjectStore.prototype.put;
  const codes: string[] = [];
  try {
    IDBObjectStore.prototype.put = function () { throw new DOMException('Injected full storage', 'QuotaExceededError'); };
    try { await repository.save({ ...document, title: '失敗' }, 1); } catch (error) { codes.push((error as { code: string }).code); }
    IDBObjectStore.prototype.put = function (value: unknown) {
      const request = original.call(this, value); this.transaction.abort(); return request;
    };
    try { await repository.save({ ...document, title: '中断' }, 1); } catch (error) { codes.push((error as { code: string }).code); }
  } finally { IDBObjectStore.prototype.put = original; }
  const stored = await repository.get(document.id);
  await repository.delete(document.id, 1); repository.close();
  return { codes, stored, document };
}
