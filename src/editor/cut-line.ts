import type { EditorView } from '@tiptap/pm/view';
import { closeHistory } from './history';
import { TextSelection } from '@tiptap/pm/state';

/** Cut a logical (newline-delimited) line when there is no explicit selection. */
export function cutLine(view: EditorView, event: ClipboardEvent): boolean {
  const native = view.dom.ownerDocument.getSelection();
  if (!view.editable || view.composing || !native?.isCollapsed || !native.focusNode || !view.dom.contains(native.focusNode) || !event.clipboardData) return false;
  // A click or arrow key can move the DOM caret before selectionchange is read.
  const selection = TextSelection.near(view.state.doc.resolve(view.posAtDOM(native.focusNode, native.focusOffset)));
  if (!selection.empty || !selection.$from.parent.isTextblock) return false;
  const tr = view.state.tr.setSelection(selection);
  const { $from } = selection;
  const text = $from.parent.textBetween(0, $from.parent.content.size, '\n', '\n');
  const offset = $from.parentOffset;
  const start = offset === 0 ? 0 : text.lastIndexOf('\n', offset - 1) + 1;
  const next = text.indexOf('\n', offset);
  const end = next < 0 ? text.length : next;
  event.clipboardData.setData('text/plain', text.slice(start, end) + '\n');
  event.preventDefault();
  if (start === 0 && end === text.length && $from.depth === 1) {
    tr.delete($from.before(), $from.after());
  } else {
    // Prefer the following separator; for a final line remove the preceding one.
    tr.delete($from.start() + (next < 0 && start > 0 ? start - 1 : start), $from.start() + (next < 0 ? end : end + 1));
  }
  view.dispatch(closeHistory(tr).scrollIntoView());
  view.dispatch(closeHistory(view.state.tr));
  return true;
}
