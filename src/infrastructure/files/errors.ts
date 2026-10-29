import { RepositoryError, type RepositoryErrorCode } from '../../application/errors';
import { ImportError } from '../../domain/codec';
import { ValidationError } from '../../domain/validate';

export function fileRepositoryError(error: unknown, documentId?: string): RepositoryError {
  if (error instanceof RepositoryError) return error;
  const name = error instanceof DOMException ? error.name : '';
  const code: RepositoryErrorCode = error instanceof ImportError || error instanceof ValidationError ? 'ValidationFailed'
    : name === 'QuotaExceededError' ? 'QuotaExceeded' : name === 'AbortError' ? 'Aborted'
      : name === 'NotFoundError' ? 'NotFound' : 'StorageUnavailable';
  const advice = name === 'NotAllowedError' || name === 'SecurityError' ? '保存先に再接続してアクセスを許可してください。 '
    : name === 'NotFoundError' ? '保存先や対象フォルダを確認し、保存先に再接続してください。 ' : code === 'QuotaExceeded' ? '保存先の空き容量を確認して再試行してください。 ' : '';
  return new RepositoryError(code, advice + (error instanceof Error ? error.message : '保存先を利用できません'), documentId, { cause: error });
}
