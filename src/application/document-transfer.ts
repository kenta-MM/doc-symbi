import type { Document } from '../domain/schema';
import { deserialize, serialize, ImportError } from '../domain/codec';
import type { DocumentRepository, StoredDocument } from './ports/document-repository';
import { RepositoryError } from './errors';
export function exportDocument(document: Document): string { return serialize(document); }
export async function importDocument(text: string, repository: DocumentRepository): Promise<StoredDocument> {
  const document = deserialize(text);
  try { return await repository.create(document); }
  catch (error) {
    if (error instanceof RepositoryError && error.code === 'Conflict') throw new ImportError('DocumentIdConflict', '同じ ID の文書が存在します。別の空の環境へ読み込んでください');
    throw error;
  }
}
