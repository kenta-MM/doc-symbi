import type { Document } from '../../src/domain/schema';
import type { DocumentRepository, StoredDocument } from '../../src/application/ports/document-repository';
import { RepositoryError } from '../../src/application/errors';
import { validateDocument } from '../../src/domain/validate';

export class MemoryRepository implements DocumentRepository {
  private records = new Map<string, StoredDocument>();
  beforeWrite: (() => void | Promise<void>) | undefined;
  async list() {
    return [...this.records.values()].map(({ document, revision }) => ({ id: document.id, title: document.title, updatedAt: document.updatedAt, revision }))
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.id.localeCompare(b.id));
  }
  async get(id: string): Promise<StoredDocument> {
    const result = this.records.get(id);
    if (!result) throw new RepositoryError('NotFound', 'missing');
    return structuredClone(result);
  }
  async create(document: Document): Promise<StoredDocument> {
    const snapshot = structuredClone(validateDocument(document)); await this.beforeWrite?.();
    if (this.records.has(snapshot.id)) throw new RepositoryError('Conflict', 'exists');
    const record = { document: snapshot, revision: 1 };
    this.records.set(snapshot.id, record); return structuredClone(record);
  }
  async save(document: Document, expectedRevision: number): Promise<StoredDocument> {
    const snapshot = structuredClone(validateDocument(document)); await this.beforeWrite?.();
    const previous = this.records.get(snapshot.id);
    if (!previous) throw new RepositoryError('NotFound', 'missing');
    if (previous.revision !== expectedRevision) throw new RepositoryError('Conflict', 'stale');
    const record = { document: snapshot, revision: expectedRevision + 1 };
    this.records.set(snapshot.id, record); return structuredClone(record);
  }
  async delete(id: string, expectedRevision: number): Promise<void> {
    const record = await this.get(id);
    if (record.revision !== expectedRevision) throw new RepositoryError('Conflict', 'stale');
    this.records.delete(id);
  }
}
