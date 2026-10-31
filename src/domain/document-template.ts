import type { DocumentEnvironment } from './document';
import type { Document, List } from './schema';
import { validateDocument } from './validate';

/** Copy content with new structural identities, leaving metadata and references intact. */
export function instantiateTemplate(source: Document, title: string, environment: DocumentEnvironment): Document {
  const copy = structuredClone(validateDocument(source));
  copy.id = environment.id();
  copy.title = title.trim();
  copy.createdAt = copy.updatedAt = environment.clock();
  delete copy.metadata.isTemplate;
  copy.metadata.type = 'document';
  copy.metadata.status = 'draft';
  function identifyList(list: List): void {
    for (const item of list.items) {
      item.id = environment.id();
      for (const child of item.children) { child.id = environment.id(); identifyList(child); }
    }
  }
  for (const block of copy.blocks) {
    block.id = environment.id();
    if (block.kind === 'list') identifyList(block);
    if (block.kind === 'table') for (const row of block.rows) for (const cell of row) cell.id = environment.id();
  }
  return validateDocument(copy);
}
