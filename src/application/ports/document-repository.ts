import type { Document } from '../../domain/schema';

export interface StoredDocument { document: Document; revision: number }
export interface DocumentSummary { id: string; title: string; updatedAt: string; revision: number }
/** Revisions are positive integers; failures reject with RepositoryError.
 * list: updatedAt descending, then ID ascending. Writes resolve after durable commit.
 * Revisions are opaque positive comparison tokens, not necessarily counters.
 * save/delete: compare expectedRevision; never recreate missing documents.
 * File storage serializes same-origin app writes; external tools cannot share its lock.
 */
export interface DocumentRepository {
  list(): Promise<DocumentSummary[]>;
  get(id: string): Promise<StoredDocument>;
  create(document: Document): Promise<StoredDocument>;
  save(document: Document, expectedRevision: number): Promise<StoredDocument>;
  delete(id: string, expectedRevision: number): Promise<void>;
}
