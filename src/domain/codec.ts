import type { Document } from './schema';
import { validateDocument, ValidationError, limits } from './validate';
import { utf8Length } from './text';

export type ImportErrorCode = 'InvalidJson' | 'InvalidFormat' | 'UnsupportedVersion' | 'InvalidStructure' | 'DuplicateElementId' | 'LimitExceeded' | 'DocumentIdConflict';
export class ImportError extends Error {
  constructor(public readonly code: ImportErrorCode, message: string, public readonly path = '') {
    super(message); this.name = 'ImportError';
  }
}
export function serialize(document: Document): string { return JSON.stringify(validateDocument(document)); }
export function deserialize(text: string): Document {
  if (utf8Length(text) > limits.fileBytes) throw new ImportError('LimitExceeded', 'ファイルは 10 MiB 以内にしてください');
  let input: unknown;
  try { input = JSON.parse(text); } catch { throw new ImportError('InvalidJson', 'JSON を読み取れません'); }
  if (!input || typeof input !== 'object' || !('format' in input) || input.format !== 'docsymbi') throw new ImportError('InvalidFormat', 'DocSymbi 形式ではありません');
  if (!('schemaVersion' in input) || ![1, 2].includes(input.schemaVersion as number)) throw new ImportError('UnsupportedVersion', '未対応の文書バージョンです');
  try { return validateDocument(input); }
  catch (error) {
    if (error instanceof ValidationError) throw new ImportError(error.code, error.message, error.path);
    throw error;
  }
}
