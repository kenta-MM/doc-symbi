import { z } from 'zod';

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type Metadata = { [key: string]: JsonValue };

// Inspect iteratively before recursive schema parsing. Never spread metadata into
// configuration or assign its keys to another object's prototype.
export function isMetadata(input: unknown): input is Metadata {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const pending: { value: unknown; depth: number; ancestors: Set<object> }[] = [
    { value: input, depth: 1, ancestors: new Set() },
  ];
  while (pending.length) {
    const entry = pending.pop()!;
    const value = entry.value;
    if (value === null || typeof value === 'boolean' || typeof value === 'string') continue;
    if (typeof value === 'number') { if (!Number.isFinite(value)) return false; continue; }
    if (typeof value !== 'object' || entry.depth > 16 || entry.ancestors.has(value)) return false;
    if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return false;
    const ancestors = new Set(entry.ancestors).add(value);
    for (const child of Object.values(value)) pending.push({ value: child, depth: entry.depth + 1, ancestors });
  }
  return true;
}

export const metadataSchema = z.custom<Metadata>(isMetadata, 'metadata must be a JSON object with depth at most 16');
