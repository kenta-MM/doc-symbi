import { expect, test } from 'vitest';
import { fileRepositoryError } from '../../src/infrastructure/files/errors';
import { RepositoryError } from '../../src/application/errors';
import { ImportError } from '../../src/domain/codec';

test.each([
  ['QuotaExceededError', 'QuotaExceeded'], ['AbortError', 'Aborted'],
  ['NotAllowedError', 'StorageUnavailable'], ['NotFoundError', 'NotFound'],
])('file errors retain cause and expose a stable code: %s', (name, code) => {
  const cause = new DOMException('original reason', name);
  const error = fileRepositoryError(cause, 'document-id');
  expect(error).toBeInstanceOf(RepositoryError);
  expect(error).toMatchObject({ code, documentId: 'document-id', cause });
  expect(error.message).toContain('original reason');
});

test('validation and existing conflict errors retain precise semantics', () => {
  const cause = new ImportError('InvalidJson', 'broken');
  expect(fileRepositoryError(cause)).toMatchObject({ code: 'ValidationFailed', cause });
  const conflict = new RepositoryError('Conflict', 'external change');
  expect(fileRepositoryError(conflict)).toBe(conflict);
});
