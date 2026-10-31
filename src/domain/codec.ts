import type { Document } from './schema';
import { validateDocument, ValidationError, limits } from './validate';
import { utf8Length } from './text';

export type ImportErrorCode = 'InvalidJson' | 'InvalidFormat' | 'UnsupportedVersion' | 'InvalidStructure' | 'DuplicateElementId' | 'LimitExceeded' | 'DocumentIdConflict';
export class ImportError extends Error {
  constructor(public readonly code: ImportErrorCode, message: string, public readonly path = '') {
    super(message); this.name = 'ImportError';
  }
}
export function serialize(document: Document): string {
  const text = JSON.stringify(validateDocument(document));
  if (utf8Length(text) > limits.transferBytes) throw new ImportError('LimitExceeded', '持ち運び用JSONは画像を含めて256 MiB以内にしてください');
  return text;
}
export function deserialize(text: string): Document {
  if (utf8Length(text) > limits.transferBytes) throw new ImportError('LimitExceeded', '持ち運び用JSONは画像を含めて256 MiB以内にしてください');
  let input: unknown;
  try { input = JSON.parse(text); } catch { throw new ImportError('InvalidJson', 'JSON を読み取れません'); }
  if (!input || typeof input !== 'object' || !('format' in input) || input.format !== 'docsymbi') throw new ImportError('InvalidFormat', 'DocSymbi 形式ではありません');
  if ('schemaVersion' in input && input.schemaVersion === 5) throw new ImportError('InvalidFormat', 'この文書は画像ファイルを参照しています。素材フォルダーと一緒に保存先へ配置して同期するか、「文書を取り出す」で作成したJSONを読み込んでください');
  if (!('schemaVersion' in input) || ![1, 2, 3, 4].includes(input.schemaVersion as number)) throw new ImportError('UnsupportedVersion', '未対応の文書バージョンです');
  try { return validateDocument(input); }
  catch (error) {
    if (error instanceof ValidationError) throw new ImportError(error.code, error.message, error.path);
    throw error;
  }
}
