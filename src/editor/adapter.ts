import type { JSONContent } from '@tiptap/core';
import type { Block, Document, List, ListItem } from '../domain/schema';
import { validateDocument } from '../domain/validate';

function inline(text: string, code = false): JSONContent[] {
  if (code) return text ? [{ type: 'text', text }] : [];
  return text.split('\n').flatMap((part, index) => [
    ...(index ? [{ type: 'hardBreak' }] : []), ...(part ? [{ type: 'text', text: part }] : []),
  ]);
}
function encodeItem(item: ListItem): JSONContent {
  return { type: 'listItem', attrs: { id: item.id, metadata: item.metadata }, content: [
    { type: 'paragraph', attrs: { id: null, metadata: {} }, content: inline(item.text) },
    ...item.children.map(encodeBlock),
  ] };
}
export function encodeBlock(block: Block): JSONContent {
  const attrs = { id: block.id, metadata: block.metadata };
  switch (block.kind) {
    case 'image': return { type: 'imageBlock', attrs: { ...attrs, file: block.file, caption: block.caption, alt: block.alt, semantics: block.semantics } };
    case 'list': return { type: block.style === 'bullet' ? 'bulletList' : 'orderedList', attrs, content: block.items.map(encodeItem) };
    case 'heading': return { type: 'heading', attrs: { ...attrs, level: block.level }, content: inline(block.text) };
    case 'code': return { type: 'codeBlock', attrs, content: inline(block.text, true) };
    case 'paragraph': return { type: 'paragraph', attrs, content: inline(block.text) };
  }
}
export function toEditor(document: Document): JSONContent { return { type: 'doc', content: validateDocument(document).blocks.map(encodeBlock) }; }

function checkedNode(input: unknown): JSONContent {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid editor node');
  const node = input as JSONContent;
  if (Object.keys(node).some(key => !['type', 'attrs', 'content', 'text'].includes(key))) throw new Error('Unknown editor node field or marks');
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
    if (child.type === 'text' && typeof child.text === 'string' && !child.attrs && !child.content) return child.text;
    if (!code && child.type === 'hardBreak' && !child.attrs && !child.content && child.text === undefined) return '\n';
    throw new Error('Unsupported inline content');
  }).join('');
}
function decodeBlock(input: unknown): unknown {
  const node = checkedNode(input);
  const attributes = attrs(node, node.type === 'heading' ? ['level'] : node.type === 'imageBlock' ? ['file', 'caption', 'alt', 'semantics'] : []);
  const common = { id: attributes.id, metadata: attributes.metadata };
  if (node.text !== undefined) throw new Error('Text belongs to inline nodes');
  if (node.type === 'imageBlock') {
    if (node.content?.length) throw new Error('Image cannot contain editor nodes');
    return { ...common, kind: 'image', file: attributes.file, caption: attributes.caption, alt: attributes.alt, semantics: attributes.semantics };
  }
  if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'codeBlock') {
    return { ...common, kind: node.type === 'codeBlock' ? 'code' : node.type, text: textContent(node, node.type === 'codeBlock'),
      ...(node.type === 'heading' ? { level: attributes.level } : {}) };
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
      return { id: itemAttrs.id, metadata: itemAttrs.metadata, text: textContent(paragraph), children };
    }) };
  }
  throw new Error(`Unsupported node: ${node.type}`);
}
export function fromEditor(input: unknown, envelope: Document): Document {
  const body = checkedNode(input);
  if (body.type !== 'doc' || body.attrs || body.text !== undefined) throw new Error('Invalid editor document');
  const blocks = (body.content ?? []).map(decodeBlock);
  return validateDocument({ ...envelope, schemaVersion: body.content?.some(node => node.type === 'imageBlock') ? 2 : envelope.schemaVersion, blocks });
}
export type { List };
