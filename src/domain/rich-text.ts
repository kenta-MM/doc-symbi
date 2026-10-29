import { z } from 'zod';

export function safeLink(value: string): boolean {
  return /^(https?:\/\/|mailto:|#article=)/i.test(value) && !/[<>]/.test(value) && ![...value].some(char => char.charCodeAt(0) <= 32);
}
export const formattingSchema = z.array(z.strictObject({
  from: z.number().int().nonnegative(), to: z.number().int().positive(),
  bold: z.boolean().optional(), href: z.string().refine(safeLink, 'http(s)・mailto・記事リンクを入力してください').optional(),
}).refine(value => value.to > value.from && (value.bold === true || !!value.href))).max(10000).refine(ranges => ranges.every((range, index) => !index || range.from >= ranges[index - 1]!.to), '書式の範囲は重複せず順番に指定してください');
export type Formatting = z.infer<typeof formattingSchema>;
export function sliceFormatting(formatting: Formatting | undefined, from: number, to: number): { formatting?: Formatting } {
  const ranges = (formatting ?? []).filter(range => range.to > from && range.from < to).map(range => ({ ...range, from: Math.max(range.from, from) - from, to: Math.min(range.to, to) - from }));
  return ranges.length ? { formatting: ranges } : {};
}
export const languages = ['text', 'javascript', 'typescript', 'python', 'json', 'html', 'css', 'sql', 'bash'] as const;
export const languageSchema = z.enum(languages);
export function bodyVersion(blocks: unknown[], previous: 1 | 2 | 3 | 4): 1 | 2 | 3 | 4 {
  if (previous === 4) return 4;
  let version = previous;
  const pending = [...blocks], seen = new Set<object>();
  while (pending.length) {
    const item = pending.pop();
    if (!item || typeof item !== 'object' || seen.has(item)) continue;
    seen.add(item);
    const node = item as { kind?: string; language?: unknown; formatting?: unknown; items?: unknown[]; children?: unknown[] };
    if (node.kind === 'quiz') return 4;
    if (node.kind === 'table' || node.formatting !== undefined || (node.kind === 'code' && node.language !== undefined)) version = 3;
    if (node.kind === 'image' && version < 2) version = 2;
    if (Array.isArray(node.items)) pending.push(...node.items);
    if (Array.isArray(node.children)) pending.push(...node.children);
  }
  return version;
}
