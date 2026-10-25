import { documentSchema, type Document } from './schema';
import { utf8Length } from './text';

export type ValidationCode = 'InvalidStructure' | 'DuplicateElementId' | 'LimitExceeded';
export class ValidationError extends Error {
  constructor(public readonly code: ValidationCode, message: string, public readonly path = '') {
    super(message); this.name = 'ValidationError';
  }
}
export const limits = { fileBytes: 10 * 1024 * 1024, textPoints: 1_000_000, elements: 10_000, listDepth: 32 } as const;

function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }

export function validateDocument(input: unknown): Document {
  // Bound recursion before invoking Zod: hostile depth and cyclic input must not
  // exhaust the JavaScript stack. Document ID is a separate namespace.
  const pending: { value: unknown; depth: number }[] = [];
  if (record(input) && Array.isArray(input.blocks)) for (const value of input.blocks) pending.push({ value, depth: 0 });
  const seen = new Set<object>();
  const ids = new Set<string>();
  let elements = 0;
  let points = 0;
  while (pending.length) {
    const { value, depth } = pending.pop()!;
    if (!record(value)) continue;
    if (seen.has(value)) {
      if (typeof value.id === 'string' && ids.has(value.id)) throw new ValidationError('DuplicateElementId', '要素 ID が重複しています', value.id);
      throw new ValidationError('InvalidStructure', '循環構造は使用できません');
    }
    seen.add(value);
    if (++elements > limits.elements) throw new ValidationError('LimitExceeded', '要素数の上限は 10000 です');
    if (typeof value.id === 'string') {
      if (ids.has(value.id)) throw new ValidationError('DuplicateElementId', '要素 ID が重複しています', value.id);
      ids.add(value.id);
    }
    if (typeof value.text === 'string') {
      for (const point of value.text) { void point; points++; }
      if (points > limits.textPoints) throw new ValidationError('LimitExceeded', '本文は 100万文字以内にしてください');
    }
    const nextDepth = value.kind === 'list' ? depth + 1 : depth;
    if (nextDepth > limits.listDepth) throw new ValidationError('LimitExceeded', 'リストの深さは 32 までです');
    for (const field of ['items', 'children']) if (Array.isArray(value[field])) {
      for (const child of value[field]) pending.push({ value: child, depth: nextDepth });
    }
  }
  const result = documentSchema.safeParse(input);
  if (!result.success) throw new ValidationError('InvalidStructure', result.error.issues[0]?.message ?? '不正な文書', result.error.issues[0]?.path.join('.') ?? '');
  if (utf8Length(JSON.stringify(result.data)) > limits.fileBytes) throw new ValidationError('LimitExceeded', '文書は UTF-8 で 10 MiB 以内にしてください');
  return result.data;
}
