import { copyDirectory, directoryFingerprint, type Directory } from './directory-operations';
import type { DocumentRepository, StoredDocument } from '../../application/ports/document-repository';
import type { FolderStorage } from '../../application/ports/folder-storage';
import { RepositoryError } from '../../application/errors';
import type { Document } from '../../domain/schema';
import { deserialize, serialize } from '../../domain/codec';
import { limits } from '../../domain/validate';
import { summarize, pathParts } from '../../domain/catalog';
import { fileRepositoryError } from './errors';

export type { Directory } from './directory-operations';

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
    const entries = new Map<string, StoredDocument & { name: string; directory: Directory; folderPath: string }>();
    const walk = async (directory: Directory, folderPath: string) => {
    for await (const handle of directory.values()) {
      if (handle.kind === 'directory') { await walk(handle as Directory, folderPath ? `${folderPath}/${handle.name}` : handle.name); continue; }
      if (handle.kind !== 'file' || !handle.name.endsWith(suffix)) continue;
      try {
        const file = await handle.getFile();
        if (file.size > limits.fileBytes) throw new RepositoryError('ValidationFailed', 'ファイルは10 MiB以内にしてください');
        const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
        const document = deserialize(text);
        if (entries.has(document.id)) throw new RepositoryError('ValidationFailed', '記事IDが重複しています', document.id);
        entries.set(document.id, { document, revision: await revision(text), name: handle.name, directory, folderPath });
      } catch (error) {
        const failure = fileRepositoryError(error);
        const code = error instanceof TypeError ? 'ValidationFailed' : failure.code;
        throw new RepositoryError(code, `${folderPath ? `${folderPath}/` : ''}${handle.name}: ${failure.message}`, failure.documentId, { cause: error });
      }
    }
    };
    await walk(directory, '');
    return entries;
  }
  async list() {
    return this.operation(async () => {
    await this.restore();
    if (!this.directory) return this.legacy?.list() ?? [];
    return [...(await this.scan()).values()].map(({ document, revision, folderPath }) => summarize(document, revision, folderPath))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
    });
  }
  async get(id: string): Promise<StoredDocument> {
    return this.operation(async () => {
    await this.restore();
    if (!this.directory && this.legacy) return this.legacy.get(id);
    const item = (await this.scan()).get(id);
    if (!item) throw new RepositoryError('NotFound', '記事ファイルが見つかりません', id);
    return { document: item.document, revision: item.revision };
    }, id);
  }
  private async write(document: Document, expected?: number, folderPath = ''): Promise<StoredDocument> {
    await this.restore();
    if (!this.directory && this.legacy) {
      if (folderPath) throw new Error('実フォルダへの保存には保存先を接続してください');
      return expected === undefined ? this.legacy.create(document) : this.legacy.save(document, expected);
    }
    const text = serialize(document);
    deserialize(text); // Enforce the same size limit on writes and reads.
    return navigator.locks.request('docsymbi-file-write', async () => {
      const existing = (await this.scan()).get(document.id);
      const directory = existing?.directory ?? await this.at(folderPath);
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
  create(document: Document, folderPath = '') { return this.operation(() => this.write(document, undefined, folderPath), document.id); }
  save(document: Document, expectedRevision: number) { return this.operation(() => this.write(document, expectedRevision), document.id); }
  async delete(id: string, expectedRevision: number) {
    await this.restore();
    if (!this.directory && this.legacy) return this.legacy.delete(id, expectedRevision);
    await this.operation(() => navigator.locks.request('docsymbi-file-write', async () => {
      const item = (await this.scan()).get(id);
      if (!item) throw new RepositoryError('NotFound', '記事ファイルが見つかりません');
      if (item.revision !== expectedRevision) throw new RepositoryError('Conflict', 'ファイルが外部で変更されています');
      await item.directory.removeEntry(item.name);
    }), id);
  }
  private async at(path: string): Promise<Directory> {
    let directory = await this.root();
    for (const part of pathParts(path)) directory = await directory.getDirectoryHandle(part) as Directory;
    return directory;
  }
  folders(): Promise<string[]> { return this.operation(() => this.listFolders()); }
  private async listFolders(): Promise<string[]> {
    await this.restore();
    if (!this.directory) return [''];
    const paths = [''];
    const walk = async (directory: Directory, parent: string) => {
      for await (const handle of directory.values()) if (handle.kind === 'directory') {
        const path = parent ? `${parent}/${handle.name}` : handle.name;
        paths.push(path); await walk(handle as Directory, path);
      }
    };
    await walk(await this.root(), '');
    return paths.sort((a, b) => a.localeCompare(b, 'ja'));
  }
  async createFolder(path: string): Promise<void> {
    const parts = pathParts(path); const name = parts.pop();
    if (!name) throw new Error('フォルダ名を入力してください');
    await this.operation(() => navigator.locks.request('docsymbi-file-write', async () => {
      const parent = await this.at(parts.join('/'));
      for await (const entry of parent.values()) if (entry.name === name) throw new Error('同名の項目が存在します');
      await parent.getDirectoryHandle(name, { create: true });
    }));
  }
  async deleteFolder(path: string, recursive = false): Promise<void> {
    const parts = pathParts(path); const name = parts.pop();
    if (!name) throw new Error('保存先ルートは削除できません');
    // Recursive removal must be explicitly requested by a confirmed UI action.
    await this.operation(() => navigator.locks.request('docsymbi-file-write', async () => {
      await (await this.at(parts.join('/'))).removeEntry(name, { recursive });
    }));
  }
  async renameFolder(path: string, name: string): Promise<void> {
    if (pathParts(name).length !== 1) throw new Error('新しいフォルダ名を入力してください');
    const parts = pathParts(path); const old = parts.pop();
    if (!old) throw new Error('保存先ルートは変更できません');
    if (name === old) return;
    await this.operation(() => navigator.locks.request('docsymbi-file-write', async () => {
      const directory = await this.at(path);
      const original = await directoryFingerprint(directory);
      const parent = await this.at(parts.join('/'));
      for await (const entry of parent.values()) if (entry.name === name) throw new Error('同名の項目が存在します');
      const target = await parent.getDirectoryHandle(name, { create: true }) as Directory;
      try {
        await copyDirectory(directory, target);
        if (original !== await directoryFingerprint(target) || original !== await directoryFingerprint(directory)) throw new Error('フォルダの内容が変更されたため名前変更を中止しました');
      } catch (error) { await parent.removeEntry(name, { recursive: true }).catch(() => undefined); throw error; }
      // Never remove the verified copy if removing the original fails partway.
      try { await parent.removeEntry(old, { recursive: true }); }
      catch { throw new Error('コピーは完了しましたが元フォルダを削除できませんでした。両方のフォルダをOSで確認してください'); }
    }));
  }
  async rename(document: Document, expectedRevision: number): Promise<StoredDocument> {
    await this.restore();
    if (!this.directory && this.legacy) return this.legacy.save(document, expectedRevision);
    if (pathParts(document.title).length !== 1) throw new Error('ファイル名は1つの名前で入力してください');
    const text = serialize(document); deserialize(text);
    return this.operation(() => navigator.locks.request('docsymbi-file-write', async () => {
      const item = (await this.scan()).get(document.id);
      if (!item) throw new RepositoryError('NotFound', 'ファイルが見つかりません');
      if (item.revision !== expectedRevision) throw new RepositoryError('Conflict', 'ファイルが外部で変更されています。一覧を再読み込みしてください');
      const name = `${document.title.slice(0, 60)}--${crypto.randomUUID()}${suffix}`;
      try { await item.directory.getFileHandle(name); throw new Error('同名ファイルが存在します'); }
      catch (error) { if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error; }
      const handle = await item.directory.getFileHandle(name, { create: true });
      try {
        const stream = await handle.createWritable();
        try { await stream.write(text); await stream.close(); }
        catch (error) { await stream.abort().catch(() => undefined); throw error; }
        if (await revision(await (await handle.getFile()).text()) !== await revision(text)) throw new Error('名前変更後のファイルを検証できません');
        const original = await item.directory.getFileHandle(item.name);
        if (await revision(await (await original.getFile()).text()) !== expectedRevision) throw new Error('ファイルが外部で変更されたため名前変更を中止しました');
        await item.directory.removeEntry(item.name);
      } catch (error) { await item.directory.removeEntry(name).catch(() => undefined); throw error; }
      return { document: deserialize(text), revision: await revision(text) };
    }), document.id);
  }

  async move(id: string, folderPath: string, expectedRevision: number): Promise<void> {
    pathParts(folderPath);
    await this.operation(() => navigator.locks.request('docsymbi-file-write', async () => {
      const item = (await this.scan()).get(id);
      if (!item) throw new RepositoryError('NotFound', '移動する記事が見つかりません');
      if (item.revision !== expectedRevision) throw new RepositoryError('Conflict', '記事が変更されています。同期してから移動してください');
      if (item.folderPath === folderPath) return;
      const target = await this.at(folderPath);
      for await (const entry of target.values()) if (entry.name === item.name) throw new RepositoryError('Conflict', '移動先に同名のファイルが存在します');
      const source = await item.directory.getFileHandle(item.name);
      const file = await source.getFile();
      if (await revision(await file.text()) !== expectedRevision) throw new RepositoryError('Conflict', '記事が外部で変更されています');
      const copy = await target.getFileHandle(item.name, { create: true });
      try {
        const stream = await copy.createWritable();
        try { await stream.write(file); await stream.close(); }
        catch (error) { await stream.abort().catch(() => undefined); throw error; }
        if (await revision(await (await copy.getFile()).text()) !== expectedRevision) throw new Error('移動先のファイルを検証できません');
        if (await revision(await (await source.getFile()).text()) !== expectedRevision) throw new RepositoryError('Conflict', '記事が外部で変更されたため移動を中止しました');
      } catch (error) { await target.removeEntry(item.name).catch(() => undefined); throw error; }
      try { await item.directory.removeEntry(item.name); }
      catch {
        // Keep the verified copy if source deletion fails; never risk losing both.
        throw new Error('コピーは完了しましたが元の記事を削除できませんでした。両方のフォルダを確認してください');
      }
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
