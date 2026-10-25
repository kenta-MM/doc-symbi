import type { EditorProps } from '@tiptap/pm/view';
import { Fragment, Slice } from '@tiptap/pm/model';
import { normalizeClipboard } from '../domain/text';

export const plainTextPaste: NonNullable<EditorProps['handlePaste']> = (view, event) => {
  const text = event.clipboardData?.getData('text/plain');
  if (text === undefined) return false;
  const normalized = normalizeClipboard(text);
  if (view.state.selection.$from.parent.type.spec.code) {
    view.dispatch(view.state.tr.insertText(normalized));
  } else {
    const nodes = normalized.split('\n').flatMap((line, index) => [
      ...(index ? [view.state.schema.nodes.hardBreak!.create()] : []),
      ...(line ? [view.state.schema.text(line)] : []),
    ]);
    view.dispatch(view.state.tr.replaceSelection(new Slice(Fragment.fromArray(nodes), 0, 0)).scrollIntoView());
  }
  return true;
};
