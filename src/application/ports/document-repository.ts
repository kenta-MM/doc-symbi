import type { Document } from '../../domain/schema';

export interface StoredDocument { document: Document; revision: number }
export interface DocumentSummary { id: string; title: string; updatedAt: string; revision: number }
/** Revisions are positive integers; failures reject with RepositoryError.
 * list: updatedAt descending, then ID ascending. Writes resolve on transaction complete.
 * save/delete: compare expectedRevision atomically; never recreate missing documents.
 */
export interface DocumentRepository {
  list(): Promise<DocumentSummary[]>;
  get(id: string): Promise<StoredDocument>;
  create(document: Document): Promise<StoredDocument>;
  save(document: Document, expectedRevision: number): Promise<StoredDocument>;
  delete(id: string, expectedRevision: number): Promise<void>;
}
