import type { Document } from './schema';
import { equivalent } from './equivalence';
import { validateDocument } from './validate';
import { bodyVersion } from './rich-text';

export function acceptBodyChange(document: Document, blocks: unknown, clock: () => string): Document {
  const nextTime = clock();
  const updatedAt = Date.parse(nextTime) > Date.parse(document.updatedAt) ? nextTime : document.updatedAt;
  const candidate = validateDocument({ ...document, blocks, updatedAt, schemaVersion: Array.isArray(blocks) ? bodyVersion(blocks, document.schemaVersion) : document.schemaVersion });
  return equivalent(document.blocks, candidate.blocks) ? document : candidate;
}
