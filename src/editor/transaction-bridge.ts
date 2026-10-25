import type { Editor } from '@tiptap/core';
import type { EditorCommand } from '../domain/commands';
import type { Document } from '../domain/schema';
import type { DocumentEnvironment } from '../domain/document';
import { applyCommand } from '../domain/block-operations';
import { applyListCommand } from '../domain/list-operations';
import { equivalent } from '../domain/equivalence';
import { toEditor, fromEditor } from './adapter';
import { closeHistory } from './history';

export function executeCommand(editor: Editor, current: Document, command: EditorCommand, environment: DocumentEnvironment): void {
  const expected = ['insertListItem', 'deleteListItem', 'indentListItem', 'outdentListItem'].includes(command.type)
    ? applyListCommand(current, command, environment) : applyCommand(current, command, environment);
  if (equivalent(expected.blocks, current.blocks)) return;
  const target = editor.schema.nodeFromJSON(toEditor(expected));
  // Preserve the unchanged prefix/suffix; do not reset content, selection or history.
  const start = editor.state.doc.content.findDiffStart(target.content);
  if (start === null) return;
  const end = editor.state.doc.content.findDiffEnd(target.content)!;
  const overlap = start - Math.min(end.a, end.b);
  const endA = overlap > 0 ? end.a + overlap : end.a;
  const endB = overlap > 0 ? end.b + overlap : end.b;
  const transaction = closeHistory(editor.state.tr).replace(start, endA, target.slice(start, endB));
  const actual = fromEditor(transaction.doc.toJSON(), expected);
  if (!equivalent(actual, expected)) throw new Error('構造操作の結果が正規モデルと一致しません');
  editor.view.dispatch(transaction.setMeta('docsymbi-command', true).scrollIntoView());
}
