import type { Document } from './schema';
import { validateDocument } from './validate';

export interface DocumentEnvironment { id: () => string; clock: () => string }
export function createDocument(title: string, environment: DocumentEnvironment): Document {
  const time = environment.clock();
  return validateDocument({ format: 'docsymbi', schemaVersion: 1, id: environment.id(), title,
    createdAt: time, updatedAt: time, metadata: {},
    blocks: [{ kind: 'paragraph', id: environment.id(), metadata: {}, text: '' }],
  });
}

export function editedDocument(document: Document, change: Partial<Pick<Document, 'title' | 'blocks'>>, clock: () => string): Document {
  const nextTime = clock();
  const updatedAt = Date.parse(nextTime) > Date.parse(document.updatedAt) ? nextTime : document.updatedAt;
  return validateDocument({ ...document, ...change, schemaVersion: (change.blocks ?? document.blocks).some(block => block.kind === 'image') ? 2 : document.schemaVersion, updatedAt });
}

export function renameDocument(document: Document, title: string, clock: () => string): Document {
  const name = title.trim();
  if (name === document.title) return document;
  return editedDocument(document, { title: name }, clock);
}
