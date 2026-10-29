import type { Editor } from '@tiptap/core';
import type { Document } from '../domain/schema';
import type { DocumentEnvironment } from '../domain/document';
import { executeCommand } from './transaction-bridge';
import { closeHistory } from './history';
import type { EditorCommand } from '../domain/commands';

export function applyHeading(editor: Editor, document: Document, environment: DocumentEnvironment, style: Pick<Extract<EditorCommand, { type: 'applyHeading' }>, 'kind' | 'language'> = {}): void {
  const { from, to, empty } = editor.state.selection;
  const ranges: { id: string; from: number; to: number }[] = [];
  editor.state.doc.forEach((node, position) => {
    if (!['paragraph', 'heading', 'codeBlock'].includes(node.type.name)) return;
    const start = position + 1, end = start + node.content.size;
    if (empty ? from < start || from > end : to < start || from > end || (node.content.size > 0 && (to === start || from === end))) return;
    ranges.push({ id: String(node.attrs.id), from: Math.max(0, from - start), to: Math.min(node.content.size, to - start) });
  });
  executeCommand(editor, document, { type: 'applyHeading', cursor: empty, ranges, ...style }, environment);
  editor.view.dispatch(closeHistory(editor.state.tr));
  editor.view.focus();
}
