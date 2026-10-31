import type { Document } from './schema';

export const documentTypes = { document: 'ドキュメント', template: 'テンプレート' };
export const documentStatuses = { draft: '下書き', review: 'レビュー中', published: '公開済み' };
export function documentProperties(document: Document) {
  const value = document.metadata;
  return { type: value.isTemplate === true || value.type === 'template' ? 'template' : 'document',
    status: typeof value.status === 'string' ? value.status : 'draft',
    tags: Array.isArray(value.tags) ? value.tags.filter((tag): tag is string => typeof tag === 'string') : [] };
}
export function bodyText(document: Document): string {
  const texts: string[] = [];
  function visit(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (['text', 'caption', 'alt', 'prompt', 'explanation'].includes(key) && typeof child === 'string') texts.push(child);
      else if (key === 'options' && Array.isArray(child)) texts.push(...child.filter((item): item is string => typeof item === 'string'));
      else if (['blocks', 'items', 'children', 'rows', 'questions'].includes(key) && Array.isArray(child)) child.forEach(item => Array.isArray(item) ? item.forEach(visit) : visit(item));
    }
  }
  visit(document);
  return texts.join('\n');
}
export function summarize(document: Document, revision: number, folderPath = '') {
  return { id: document.id, title: document.title, createdAt: document.createdAt, updatedAt: document.updatedAt, revision, folderPath, ...documentProperties(document), isTemplate: documentProperties(document).type === 'template', searchText: bodyText(document) };
}
export function folderContains(parent: string, child: string, recursive = true): boolean {
  return child === parent || (recursive && (!parent || child.startsWith(`${parent}/`)));
}
export function pathParts(path: string): string[] {
  if (!path) return [];
  const parts = path.split('/');
  if (parts.some(part => !part.trim() || part.length > 255 || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part) || part === '.' || part === '..' || /[<>:"\\|?*]/.test(part) || [...part].some(character => character.charCodeAt(0) < 32) || /[. ]$/.test(part))) throw new Error('フォルダ名に使用できない文字が含まれています');
  return parts;
}
