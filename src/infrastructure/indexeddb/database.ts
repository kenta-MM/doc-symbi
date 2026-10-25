import { RepositoryError } from '../../application/errors';

export function storageError(error: unknown): RepositoryError {
  if (error instanceof RepositoryError) return error;
  const name = error instanceof DOMException ? error.name : '';
  const code = name === 'QuotaExceededError' ? 'QuotaExceeded' : name === 'AbortError' ? 'Aborted' : 'StorageUnavailable';
  return new RepositoryError(code, error instanceof Error ? error.message : '保存領域を利用できません');
}
export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    let rejected = false;
    try { request = indexedDB.open('docsymbi', 1); }
    catch (error) { reject(storageError(error)); return; }
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore('documents', { keyPath: 'document.id' });
      store.createIndex('updatedAt', 'document.updatedAt', { unique: false });
    };
    request.onblocked = () => { rejected = true; reject(new RepositoryError('StorageUnavailable', '他の DocSymbi 画面を閉じて再試行してください')); };
    request.onerror = () => reject(storageError(request.error));
    request.onsuccess = () => {
      const database = request.result;
      if (rejected) { database.close(); return; }
      database.onversionchange = () => database.close();
      resolve(database);
    };
  });
}
