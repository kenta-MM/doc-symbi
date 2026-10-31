import type { DocumentRepository } from '../../application/ports/document-repository';
import type { FolderStorage } from '../../application/ports/folder-storage';
import type { Document } from '../../domain/schema';
import { AccessPolicy, type LockState } from '../../application/access-policy';

export class LockedStorage implements DocumentRepository, FolderStorage {
  readonly access: AccessPolicy;
  constructor(private source: DocumentRepository & FolderStorage) {
    const key = () => 'docsymbi:locks:' + (source.name ?? 'browser');
    this.access = new AccessPolicy(() => JSON.parse(localStorage.getItem(key()) ?? '{"documents":[],"folders":[]}') as LockState,
      state => { localStorage.setItem(key(), JSON.stringify(state)); window.dispatchEvent(new Event('docsymbi-locks')); });
  }
  get name() { return this.source.name; }
  get supported() { return this.source.supported; }
  get warning() { return this.source.warning; }
  restore() { return this.source.restore(); }
  choose() { return this.source.choose(); }
  reconnect() { return this.source.reconnect(); }
  async list() { const rows = await this.source.list(); this.access.paths = new Map(rows.map(row => [row.id, row.folderPath ?? ''])); return rows; }
  async get(id: string) { await this.list(); return this.source.get(id); }
  async create(document: Document, path = '') { this.access.assertFolder(path); return this.source.create(document, path); }
  async save(document: Document, revision: number) { await this.list(); this.access.assertDocument(document.id); return this.source.save(document, revision); }
  async rename(document: Document, revision: number) { await this.list(); this.access.assertDocument(document.id); return this.source.rename ? this.source.rename(document, revision) : this.source.save(document, revision); }
  async delete(id: string, revision: number) { await this.list(); this.access.assertDocument(id); return this.source.delete(id, revision); }
  async move(id: string, path: string, revision: number) { await this.list(); this.access.assertDocument(id); this.access.assertFolder(path); await this.source.move?.(id, path, revision); }
  folders() { return this.source.folders?.() ?? Promise.resolve(['']); }
  async createFolder(path: string) { this.access.assertFolder(path); await this.source.createFolder?.(path); }
  async renameFolder(path: string, name: string) { await this.list(); this.access.assertFolder(path, true); this.access.assertFolder([...path.split('/').slice(0, -1), name].join('/'), true); await this.source.renameFolder?.(path, name); }
  async deleteFolder(path: string, recursive = false) { await this.list(); this.access.assertFolder(path, true); await this.source.deleteFolder?.(path, recursive); }
  async migrate() { this.access.assertFolder('', true); return this.source.migrate(); }
}
