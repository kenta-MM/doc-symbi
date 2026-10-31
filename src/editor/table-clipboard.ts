import type { Editor } from '@tiptap/core';
import { DOMSerializer, Fragment, Slice } from '@tiptap/pm/model';
import { Selection } from '@tiptap/pm/state';
import { tableSchema, type Block } from '../domain/schema';
import type { DocumentEnvironment } from '../domain/document';
import { encodeBlock } from './adapter';
import { closeHistory } from './history';

const attribute = 'data-docsymbi-table';

export async function copyTable(editor: Editor, table: Extract<Block, { kind: 'table' }>): Promise<void> {
  const node = editor.schema.nodeFromJSON(encodeBlock(table));
  const dom = DOMSerializer.fromSchema(editor.schema).serializeNode(node) as HTMLElement;
  dom.setAttribute(attribute, JSON.stringify(table));
  const text = table.rows.map(row => row.map(cell => cell.text).join('\t')).join('\n');
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('このブラウザでは表をコピーできません。Chromeでお試しください。');
  await navigator.clipboard.write([new ClipboardItem({
    'text/html': new Blob([dom.outerHTML], { type: 'text/html' }),
    'text/plain': new Blob([text], { type: 'text/plain' }),
  })]);
}

export function pasteTable(editor: Editor, event: ClipboardEvent, environment: DocumentEnvironment): boolean {
  const html = event.clipboardData?.getData('text/html');
  if (!html || !editor.isEditable) return false;
  const payload = new DOMParser().parseFromString(html, 'text/html').querySelector(`table[${attribute}]`)?.getAttribute(attribute);
  if (!payload) return false;
  let table: Extract<Block, { kind: 'table' }>;
  try { table = tableSchema.parse(JSON.parse(payload)); } catch { return false; }
  // Every paste is a new table, even when the source lives in another document.
  table.id = environment.id();
  for (const row of table.rows) for (const cell of row) cell.id = environment.id();
  const node = editor.schema.nodeFromJSON(encodeBlock(table));
  const tr = closeHistory(editor.state.tr);
  if (tr.selection.$from.depth > 1) {
    // The document model does not allow tables nested inside cells or lists.
    const at = tr.selection.$from.after(1);
    tr.insert(at, node).setSelection(Selection.near(tr.doc.resolve(at + node.nodeSize)));
  } else tr.replaceSelection(new Slice(Fragment.from(node), 0, 0));
  event.preventDefault();
  editor.view.dispatch(tr.scrollIntoView());
  editor.view.dispatch(closeHistory(editor.state.tr));
  return true;
}
