import type { DocumentRepository, DocumentSummary, StoredDocument } from '../../application/ports/document-repository';
import { RepositoryError } from '../../application/errors';
import type { Document } from '../../domain/schema';
import { validateDocument } from '../../domain/validate';
import { openDatabase, storageError } from './database';
import { summarize } from '../../domain/catalog';

function checkedDocument(input: unknown): Document {
  try { return validateDocument(input); }
  catch (error) { throw new RepositoryError('ValidationFailed', error instanceof Error ? error.message : '不正な文書'); }
}
function checkedRecord(input: unknown, id?: string): StoredDocument {
  if (!input || typeof input !== 'object' || !('revision' in input) || !('document' in input)
    || typeof input.revision !== 'number' || !Number.isSafeInteger(input.revision) || input.revision < 1) {
    throw new RepositoryError('ValidationFailed', '保存レコードが破損しています', id);
  }
  return { document: checkedDocument(input.document), revision: input.revision };
}
export class IndexedDbRepository implements DocumentRepository {
  private database: Promise<IDBDatabase> | undefined;
  private open(): Promise<IDBDatabase> {
    return this.database ??= openDatabase().catch(error => { this.database = undefined; throw error; });
  }
  close(): void { void this.database?.then(database => database.close()); this.database = undefined; }

  private async transaction<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore, done: (value: T) => void, fail: (error: unknown) => void) => void): Promise<T> {
    const database = await this.open();
    return new Promise<T>((resolve, reject) => {
      let transaction: IDBTransaction;
      try { transaction = database.transaction('documents', mode, { durability: 'strict' }); }
      catch (error) { reject(storageError(error)); return; }
      let result: T;
      let failure: unknown;
      const fail = (error: unknown) => { failure = error; try { transaction.abort(); } catch { reject(storageError(error)); } };
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () => reject(storageError(failure ?? transaction.error ?? new DOMException('保存が中断されました', 'AbortError')));
      transaction.onerror = () => { failure ??= transaction.error; };
      try { operation(transaction.objectStore('documents'), value => { result = value; }, fail); }
      catch (error) { fail(error); }
    });
  }
  async list(): Promise<DocumentSummary[]> {
    return this.transaction('readonly', (store, done, fail) => {
      const request = store.getAll();
      request.onsuccess = () => {
        try {
          const rows = request.result.map(value => {
            const { document, revision } = checkedRecord(value);
            return summarize(document, revision);
          });
          rows.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.id.localeCompare(b.id));
          done(rows);
        } catch (error) { fail(error); }
      };
    });
  }
  async get(id: string): Promise<StoredDocument> {
    return this.transaction('readonly', (store, done, fail) => {
      const request = store.get(id);
      request.onsuccess = () => {
        try {
          if (request.result === undefined) throw new RepositoryError('NotFound', '文書が見つかりません', id);
          done(checkedRecord(request.result, id));
        } catch (error) { fail(error); }
      };
    });
  }
  create(document: Document): Promise<StoredDocument> { return this.write(document, null); }
  save(document: Document, expectedRevision: number): Promise<StoredDocument> { return this.write(document, expectedRevision); }
  private async write(document: Document, expectedRevision: number | null): Promise<StoredDocument> {
    const snapshot = structuredClone(checkedDocument(document));
    return this.transaction('readwrite', (store, done, fail) => {
      const request = store.get(snapshot.id);
      request.onsuccess = () => {
        try {
          if (expectedRevision === null) {
            if (request.result !== undefined) throw new RepositoryError('Conflict', '同じ ID の文書が存在します', snapshot.id);
          } else {
            if (request.result === undefined) throw new RepositoryError('NotFound', '文書が削除されています', snapshot.id);
            if (checkedRecord(request.result, snapshot.id).revision !== expectedRevision) throw new RepositoryError('Conflict', '他の画面で文書が更新されました', snapshot.id);
          }
          const record = { document: snapshot, revision: expectedRevision === null ? 1 : expectedRevision + 1 };
          if (!Number.isSafeInteger(record.revision)) throw new RepositoryError('ValidationFailed', 'Revision の上限を超えました');
          if (expectedRevision === null) store.add(record); else store.put(record);
          done(record);
        } catch (error) { fail(error); }
      };
    });
  }
  async delete(id: string, expectedRevision: number): Promise<void> {
    return this.transaction('readwrite', (store, done, fail) => {
      const request = store.get(id);
      request.onsuccess = () => {
        try {
          if (request.result === undefined) throw new RepositoryError('NotFound', '文書が見つかりません', id);
          if (checkedRecord(request.result, id).revision !== expectedRevision) throw new RepositoryError('Conflict', '他の画面で文書が更新されました', id);
          store.delete(id); done(undefined);
        } catch (error) { fail(error); }
      };
    });
  }
}
