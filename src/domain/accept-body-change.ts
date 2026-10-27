import type { Document } from './schema';
import { editedDocument } from './document';
import { equivalent } from './equivalence';
import { validateDocument } from './validate';

export function acceptBodyChange(document: Document, blocks: unknown, clock: () => string): Document {
  const candidate = validateDocument({ ...document, blocks, schemaVersion: Array.isArray(blocks) && blocks.some(block => block?.kind === 'image') ? 2 : document.schemaVersion });
  return equivalent(document.blocks, candidate.blocks) ? document : editedDocument(document, { blocks: candidate.blocks }, clock);
}
