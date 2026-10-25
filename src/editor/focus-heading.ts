import type { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
export function focusHeading(editor: Editor, id: string): void {
  editor.state.doc.descendants((node, position) => {
    if (node.type.name === 'heading' && node.attrs.id === id) {
      editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, position + 1)).scrollIntoView());
      editor.view.focus();
      const element = editor.view.nodeDOM(position);
      if (element instanceof HTMLElement) element.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  });
}
