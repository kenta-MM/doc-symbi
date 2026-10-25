import type { Document } from './schema';
export interface OutlineEntry { headingId: string; label: string; level: number; parentHeadingId: string | null }
export function deriveOutline(document: Document): OutlineEntry[] {
  const entries: OutlineEntry[] = [];
  const ancestors: OutlineEntry[] = [];
  for (const block of document.blocks) {
    if (block.kind !== 'heading') continue;
    while (ancestors.length && ancestors.at(-1)!.level >= block.level) ancestors.pop();
    const entry = { headingId: block.id, label: block.text.trim() ? block.text : '無題の見出し', level: block.level, parentHeadingId: ancestors.at(-1)?.headingId ?? null };
    entries.push(entry); ancestors.push(entry);
  }
  return entries;
}
