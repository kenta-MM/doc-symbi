import type { JSONContent } from '@tiptap/core';
import type { Block, Document, List, ListItem } from '../domain/schema';
import { validateDocument } from '../domain/validate';
import { bodyVersion, formattingSchema, type Formatting } from '../domain/rich-text';

function inline(text: string, code = false, formatting: Formatting = []): JSONContent[] {
  if (code) return text ? [{ type: 'text', text }] : [];
  const boundaries = [...new Set([0, text.length, ...formatting.flatMap(range => [range.from, range.to])])].sort((a, b) => a - b);
  return boundaries.slice(0, -1).flatMap((from, i) => {
    const to = boundaries[i + 1]!;
    const active = formatting.filter(range => range.from <= from && range.to >= to);
    const href = active.find(range => range.href)?.href;
    const marks = [...(active.some(range => range.bold) ? [{ type: 'bold' }] : []), ...(active.some(range => range.code) ? [{ type: 'inlineCode' }] : []), ...(href ? [{ type: 'link', attrs: { href } }] : [])];
    return text.slice(from, to).split('\n').flatMap((part, index) => [
      ...(index ? [{ type: 'hardBreak', ...(marks.length ? { marks } : {}) }] : []), ...(part ? [{ type: 'text', text: part, ...(marks.length ? { marks } : {}) }] : []),
    ]);
  });
}
function encodeItem(item: ListItem): JSONContent {
  return { type: 'listItem', attrs: { id: item.id, metadata: item.metadata }, content: [
    { type: 'paragraph', attrs: { id: null, metadata: {} }, content: inline(item.text, false, item.formatting) },
    ...item.children.map(encodeBlock),
  ] };
}
export function encodeBlock(block: Block): JSONContent {
  const attrs = { id: block.id, metadata: block.metadata };
  switch (block.kind) {
    case 'quiz': return { type: 'quizBlock', attrs: { ...attrs, questions: block.questions } };
    case 'table': return { type: 'table', attrs: { ...attrs, displaySize: block.displaySize ?? null }, content: block.rows.map(row => ({ type: 'tableRow', content: row.map(cell => ({ type: cell.header ? 'tableHeader' : 'tableCell', attrs: { id: cell.id, metadata: cell.metadata }, content: [{ type: 'paragraph', attrs: { id: null, metadata: {} }, content: inline(cell.text, false, cell.formatting) }] })) })) };
    case 'image': return { type: 'imageBlock', attrs: { ...attrs, file: block.file, caption: block.caption, alt: block.alt, semantics: block.semantics, displaySize: block.displaySize ?? null } };
    case 'list': return { type: block.style === 'bullet' ? 'bulletList' : 'orderedList', attrs, content: block.items.map(encodeItem) };
    case 'heading': return { type: 'heading', attrs: { ...attrs, level: block.level }, content: inline(block.text, false, block.formatting) };
    case 'code': return { type: 'codeBlock', attrs: { ...attrs, language: block.language ?? null, width: block.width ?? null }, content: inline(block.text, true) };
    case 'paragraph': return { type: 'paragraph', attrs, content: inline(block.text, false, block.formatting) };
  }
}
export function toEditor(document: Document): JSONContent { return { type: 'doc', content: validateDocument(document).blocks.map(encodeBlock) }; }

function checkedNode(input: unknown): JSONContent {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid editor node');
  const node = input as JSONContent;
  if (Object.keys(node).some(key => !['type', 'attrs', 'content', 'text', 'marks'].includes(key))) throw new Error('Unknown editor node field');
  if (node.marks && !['text', 'hardBreak'].includes(node.type ?? '')) throw new Error('Marks require inline content');
  if (typeof node.type !== 'string' || (node.content !== undefined && !Array.isArray(node.content))) throw new Error('Invalid editor shape');
  return node;
}
function attrs(node: JSONContent, extra: string[] = []): Record<string, unknown> {
  const attributes: Record<string, unknown> = node.attrs ?? {};
  if (Object.keys(attributes).some(key => !['id', 'metadata', ...extra].includes(key))) throw new Error('Unknown editor attribute');
  return attributes;
}
function textContent(node: JSONContent, code = false): string {
  return (node.content ?? []).map(input => {
    const child = checkedNode(input);
    if (code && child.marks?.length) throw new Error('Code cannot contain marks');
    if (child.type === 'text' && typeof child.text === 'string' && !child.attrs && !child.content) return child.text;
    if (!code && child.type === 'hardBreak' && !child.attrs && !child.content && child.text === undefined) return '\n';
    throw new Error('Unsupported inline content');
  }).join('');
}
function decodeFormatting(node: JSONContent): { formatting?: Formatting } {
  if (!node.content?.some(child => child.marks?.length)) return {};
  const ranges: Formatting = [];
  let offset = 0;
  for (const child of node.content ?? []) {
    const end = offset + (child.type === 'hardBreak' ? 1 : child.text?.length ?? 0);
    const range: Formatting[number] = { from: offset, to: end };
    for (const mark of child.marks ?? []) {
      if (mark.type === 'bold' && !mark.attrs) range.bold = true;
      else if (mark.type === 'inlineCode' && !mark.attrs) range.code = true;
      else if (mark.type === 'link' && mark.attrs && Object.keys(mark.attrs).length === 1) range.href = mark.attrs.href as string;
      else throw new Error('Unsupported mark');
    }
    if (range.bold || range.code || range.href) {
      const previous = ranges.at(-1);
      if (previous && previous.to === offset && previous.bold === range.bold && previous.code === range.code && previous.href === range.href) previous.to = end;
      else ranges.push(range);
    }
    offset = end;
  }
  return ranges.length ? { formatting: formattingSchema.parse(ranges) } : {};
}
function decodeBlock(input: unknown): unknown {
  const node = checkedNode(input);
  const attributes = attrs(node, node.type === 'table' ? ['displaySize'] : node.type === 'quizBlock' ? ['questions'] : node.type === 'heading' ? ['level'] : node.type === 'codeBlock' ? ['language', 'width'] : node.type === 'imageBlock' ? ['file', 'caption', 'alt', 'semantics', 'displaySize'] : []);
  const common = { id: attributes.id, metadata: attributes.metadata };
  if (node.text !== undefined) throw new Error('Text belongs to inline nodes');
  if (node.type === 'quizBlock') {
    if (node.content?.length) throw new Error('Quiz cannot contain editor nodes');
    return { ...common, kind: 'quiz', questions: attributes.questions };
  }
  if (node.type === 'table') return { ...common, kind: 'table', ...(attributes.displaySize != null ? { displaySize: attributes.displaySize } : {}), rows: (node.content ?? []).map(inputRow => {
    const row = checkedNode(inputRow);
    if (row.type !== 'tableRow' || row.attrs) throw new Error('Invalid table row');
    return (row.content ?? []).map(inputCell => {
      const cell = checkedNode(inputCell), cellAttrs = attrs(cell);
      const paragraph = checkedNode(cell.content?.[0]);
      const paragraphAttrs = attrs(paragraph);
      if (!['tableCell', 'tableHeader'].includes(cell.type!) || cell.text !== undefined || cell.content?.length !== 1 || paragraph.type !== 'paragraph' || paragraphAttrs.id != null || Object.keys(paragraphAttrs.metadata ?? {}).length) throw new Error('Invalid table cell');
      return { id: cellAttrs.id, metadata: cellAttrs.metadata, header: cell.type === 'tableHeader', text: textContent(paragraph), ...decodeFormatting(paragraph) };
    });
  }) };
  if (node.type === 'imageBlock') {
    if (node.content?.length) throw new Error('Image cannot contain editor nodes');
    return { ...common, kind: 'image', file: attributes.file, caption: attributes.caption, alt: attributes.alt, semantics: attributes.semantics, ...(attributes.displaySize != null ? { displaySize: attributes.displaySize } : {}) };
  }
  if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'codeBlock') {
    return { ...common, kind: node.type === 'codeBlock' ? 'code' : node.type, text: textContent(node, node.type === 'codeBlock'),
      ...(node.type === 'heading' ? { level: attributes.level } : {}),
      ...(node.type === 'codeBlock' && attributes.width != null ? { width: attributes.width } : {}),
      ...(node.type === 'codeBlock' ? (attributes.language ? { language: attributes.language } : {}) : decodeFormatting(node)) };
  }
  if (node.type === 'bulletList' || node.type === 'orderedList') {
    return { ...common, kind: 'list', style: node.type === 'bulletList' ? 'bullet' : 'ordered', items: (node.content ?? []).map(inputItem => {
      const item = checkedNode(inputItem);
      if (item.type !== 'listItem' || !item.content?.length) throw new Error('Invalid list item');
      const itemAttrs = attrs(item);
      const paragraph = checkedNode(item.content[0]);
      const paragraphAttrs = attrs(paragraph);
      if (paragraph.type !== 'paragraph' || paragraphAttrs.id != null || Object.keys(paragraphAttrs.metadata ?? {}).length) throw new Error('Internal paragraph cannot own canonical identity/metadata');
      const children = item.content.slice(1).map(child => {
        if (child.type !== 'bulletList' && child.type !== 'orderedList') throw new Error('Only child lists are supported');
        return decodeBlock(child);
      });
      return { id: itemAttrs.id, metadata: itemAttrs.metadata, text: textContent(paragraph), ...decodeFormatting(paragraph), children };
    }) };
  }
  throw new Error(`Unsupported node: ${node.type}`);
}
export function fromEditor(input: unknown, envelope: Document): Document {
  const body = checkedNode(input);
  if (body.type !== 'doc' || body.attrs || body.text !== undefined) throw new Error('Invalid editor document');
  const blocks = (body.content ?? []).map(decodeBlock);
  return validateDocument({ ...envelope, schemaVersion: bodyVersion(blocks, envelope.schemaVersion), blocks });
}
export type { List };
