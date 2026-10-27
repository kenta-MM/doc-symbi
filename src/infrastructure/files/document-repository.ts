import type { DocumentRepository, StoredDocument } from '../../application/ports/document-repository';
import type { FolderStorage } from '../../application/ports/folder-storage';
import { RepositoryError } from '../../application/errors';
import type { Document } from '../../domain/schema';
import { deserialize, serialize } from '../../domain/codec';
import { limits } from '../../domain/validate';
import { fileRepositoryError } from './errors';

export interface Directory extends FileSystemDirectoryHandle {
  values(): AsyncIterableIterator<FileSystemFileHandle | Directory>;
  queryPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
}
type PickerWindow = Window & { showDirectoryPicker?: (options: { mode: 'readwrite'; id: string }) => Promise<Directory> };
const suffix = '.docsymbi.json';
async function revision(text: string): Promise<number> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return bytes.slice(0, 6).reduce((value, byte) => value * 256 + byte, 0) + 1;
}
async function remembered(write?: Directory): Promise<Directory | null> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('docsymbi-folder', 1);
    let blocked = false;
    request.onblocked = () => {
      blocked = true;
      reject(new Error('保存先の記憶が別の画面でブロックされています。他のDocSymbi画面を閉じて再試行してください'));
    };
    request.onupgradeneeded = () => request.result.createObjectStore('settings');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) { db.close(); return; }
      db.onversionchange = () => db.close();
      try {
        const transaction = db.transaction('settings', write ? 'readwrite' : 'readonly');
        transaction.onabort = () => { db.close(); reject(transaction.error); };
        const store = transaction.objectStore('settings');
        const operation = write ? store.put(write, 'directory') : store.get('directory');
        transaction.oncomplete = () => { db.close(); resolve(write ?? (operation.result as Directory | undefined) ?? null); };
      } catch (error) {
        // Exceptions thrown inside an IDB event handler do not reject the outer
        // promise automatically (e.g. a handle that cannot be cloned).
        db.close();
        reject(error);
      }
    };
  });
}

export class FileDocumentRepository implements DocumentRepository, FolderStorage {
  private directory: Directory | null = null;
  private restoring: Promise<void> | null = null;
  warning: string | null = null;
  constructor(private readonly legacy?: DocumentRepository) {}
  private async operation<T>(action: () => Promise<T>, id?: string): Promise<T> {
    try { return await action(); } catch (error) { throw fileRepositoryError(error, id); }
  }
  get name() { return this.directory?.name ?? null; }
  get supported() { return typeof (window as PickerWindow).showDirectoryPicker === 'function'; }
  async restore(): Promise<void> {
    // A repository can be used before the UI's startup effect completes.
    // Share the pending read and never replace a selection made while it ran.
    if (this.directory) return;
    if (!this.restoring) {
      this.restoring = remembered().then(directory => {
        if (!this.directory) this.directory = directory;
      }).finally(() => { this.restoring = null; });
    }
    await this.restoring;
  }
  async choose() {
    const picker = (window as PickerWindow).showDirectoryPicker;
    if (!picker) throw new Error('フォルダー保存にはデスクトップ版ChromeまたはEdgeを使用してください');
    const directory = await picker.call(window, { mode: 'readwrite', id: 'docsymbi-articles' });
    this.directory = directory;
    this.warning = null;
    try { await remembered(directory); }
    catch (error) {
      this.warning = `このフォルダーには保存できますが、次回用の保存先を記憶できませんでした。次回起動時には保存先を選び直してください。詳細: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`;
    }
  }
  async reconnect() {
    await this.restore();
    if (!this.directory || await this.directory.requestPermission({ mode: 'readwrite' }) !== 'granted') {
      throw new Error('保存フォルダーへのアクセスを許可してください');
    }
  }
  private async root() {
    await this.restore();
    if (!this.directory) throw new Error('記事の保存フォルダーを選択してください');
    if (await this.directory.queryPermission({ mode: 'readwrite' }) !== 'granted') throw new Error('「保存先に再接続」でフォルダーへのアクセスを許可してください');
    return this.directory;
  }
  private async scan() {
    const directory = await this.root();
    const entries = new Map<string, StoredDocument & { name: string }>();
    for await (const handle of directory.values()) {
      if (handle.kind !== 'file' || !handle.name.endsWith(suffix)) continue;
      try {
        const file = await handle.getFile();
        if (file.size > limits.fileBytes) throw new RepositoryError('ValidationFailed', 'ファイルは10 MiB以内にしてください');
        const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
        const document = deserialize(text);
        if (entries.has(document.id)) throw new RepositoryError('ValidationFailed', '記事IDが重複しています', document.id);
        entries.set(document.id, { document, revision: await revision(text), name: handle.name });
      } catch (error) {
        const failure = fileRepositoryError(error);
        const code = error instanceof TypeError ? 'ValidationFailed' : failure.code;
        throw new RepositoryError(code, `${handle.name}: ${failure.message}`, failure.documentId, { cause: error });
      }
    }
    return entries;
  }
  async list() {
    return this.operation(async () => {
    await this.restore();
    if (!this.directory) return [];
    return [...(await this.scan()).values()].map(({ document, revision }) => ({ id: document.id, title: document.title, updatedAt: document.updatedAt, revision }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
    });
  }
  async get(id: string): Promise<StoredDocument> {
    return this.operation(async () => {
    const item = (await this.scan()).get(id);
    if (!item) throw new RepositoryError('NotFound', '記事ファイルが見つかりません', id);
    return { document: item.document, revision: item.revision };
    }, id);
  }
  private async write(document: Document, expected?: number): Promise<StoredDocument> {
    const text = serialize(document);
    deserialize(text); // Enforce the same size limit on writes and reads.
    return navigator.locks.request('docsymbi-file-write', async () => {
      const directory = await this.root();
      const existing = (await this.scan()).get(document.id);
      if (expected === undefined && existing) throw new RepositoryError('Conflict', '同じIDの記事が存在します');
      if (expected !== undefined && !existing) throw new RepositoryError('NotFound', '記事ファイルが移動または削除されています');
      if (expected !== undefined && existing?.revision !== expected) throw new RepositoryError('Conflict', 'ファイルが外部で変更されています。編集中の記事を取り出してから開き直してください');
      const title = Array.from(document.title, character => character.charCodeAt(0) < 32 || /[<>:"/\\|?*]/.test(character) ? '_' : character).join('').slice(0, 60).replace(/[. ]+$/g, '') || '記事';
      const name = existing?.name ?? `${title}--${crypto.randomUUID()}${suffix}`;
      if (!existing) {
        try { await directory.getFileHandle(name); throw new RepositoryError('Conflict', '同名ファイルが存在します'); }
        catch (error) { if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error; }
      }
      const handle = await directory.getFileHandle(name, { create: !existing });
      let stream: FileSystemWritableFileStream | undefined;
      try { stream = await handle.createWritable(); await stream.write(text); await stream.close(); }
      catch (error) {
        await stream?.abort().catch(() => undefined);
        // A failed first save can leave the newly created empty file behind.
        if (!existing) {
          try { if ((await handle.getFile()).size === 0) await directory.removeEntry(name); }
          catch { /* Preserve the original write failure. */ }
        }
        throw error;
      }
      return { document: deserialize(text), revision: await revision(text) };
    });
  }
  create(document: Document) { return this.operation(() => this.write(document), document.id); }
  save(document: Document, expectedRevision: number) { return this.operation(() => this.write(document, expectedRevision), document.id); }
  async delete(id: string, expectedRevision: number) {
    await this.operation(() => navigator.locks.request('docsymbi-file-write', async () => {
      const item = (await this.scan()).get(id);
      if (!item) throw new RepositoryError('NotFound', '記事ファイルが見つかりません');
      if (item.revision !== expectedRevision) throw new RepositoryError('Conflict', 'ファイルが外部で変更されています');
      await (await this.root()).removeEntry(item.name);
    }), id);
  }
  async migrate() {
    let count = 0;
    const existing = await this.scan();
    for (const summary of await this.legacy?.list() ?? []) {
      if (existing.has(summary.id)) continue;
      await this.create((await this.legacy!.get(summary.id)).document);
      count++;
    }
    return count;
  }
}
