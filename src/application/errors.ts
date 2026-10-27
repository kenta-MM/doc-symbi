export type RepositoryErrorCode = 'NotFound' | 'Conflict' | 'ValidationFailed' | 'QuotaExceeded' | 'StorageUnavailable' | 'Aborted';
export class RepositoryError extends Error {
  constructor(public readonly code: RepositoryErrorCode, message: string, public readonly documentId?: string, options?: ErrorOptions) {
    super(message, options); this.name = 'RepositoryError';
  }
}
