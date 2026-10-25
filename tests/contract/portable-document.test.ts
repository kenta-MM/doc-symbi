import { expect, test } from 'vitest';
import { importDocument, exportDocument } from '../../src/application/document-transfer';
import { MemoryRepository } from '../helpers/memory-repository';
import { documents } from '../fixtures/documents';
import { validateDocument } from '../../src/domain/validate';
test.each(documents.map((value, i) => [i, value] as const))('fixture %i imports and exports without changing any field', async (_, value) => {
  const repository = new MemoryRepository();
  const document = validateDocument(value);
  const imported = await importDocument(exportDocument(document), repository);
  expect(imported.document).toEqual(document);
  await expect(importDocument(exportDocument(document), repository)).rejects.toHaveProperty('code', 'DocumentIdConflict');
  expect((await repository.get(document.id)).document).toEqual(document);
});
