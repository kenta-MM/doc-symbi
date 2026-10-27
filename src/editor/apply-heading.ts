import type { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { closeHistory } from './history';

/** Split only the selected text (or current logical line) into a heading. */
export function applyHeading(editor: Editor): void {
  const { state } = editor;
  const { from, to, empty } = state.selection;
  const tr = closeHistory(state.tr);
  let focus: number | undefined;
  state.doc.forEach((node, position) => {
    if (!['paragraph', 'heading', 'codeBlock'].includes(node.type.name)) return;
    const start = position + 1;
    const end = start + node.content.size;
    if (empty ? from < start || from > end : to <= start || from >= end) return;
    let left = Math.max(0, from - start);
    let right = Math.min(node.content.size, to - start);
    if (empty) {
      const text = node.textBetween(0, node.content.size, '', '\n');
      left = left === 0 ? 0 : text.lastIndexOf('\n', left - 1) + 1;
      const next = text.indexOf('\n', right);
      right = next < 0 ? node.content.size : next;
    }
    const pieces = [];
    // Adjacent line breaks become block boundaries, rather than blank lines.
    const text = node.textBetween(0, node.content.size, '', '\n');
    const prefixEnd = left > 0 && text[left - 1] === '\n' ? left - 1 : left;
    const suffixStart = text[right] === '\n' ? right + 1 : right;
    if (prefixEnd > 0) pieces.push(node.copy(node.content.cut(0, prefixEnd)));
    const heading = state.schema.nodes.heading!.create({ ...node.attrs, id: pieces.length ? null : node.attrs.id, level: 1 }, node.content.cut(left, right));
    const mapped = tr.mapping.map(position);
    focus ??= mapped + (pieces[0]?.nodeSize ?? 0) + 1;
    pieces.push(heading);
    if (suffixStart < node.content.size) pieces.push(node.type.create({ ...node.attrs, id: null }, node.content.cut(suffixStart)));
    tr.replaceWith(mapped, mapped + node.nodeSize, pieces);
  });
  if (!tr.docChanged || focus === undefined) return;
  tr.setSelection(TextSelection.create(tr.doc, focus));
  editor.view.dispatch(tr.scrollIntoView());
  editor.view.dispatch(closeHistory(editor.state.tr));
  editor.view.focus();
}
