import type { Editor } from '@tiptap/core';
import type { Node as PMNode, Slice } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import { closeHistory } from './history';

/** Only two directly typed ASCII quotes trigger this shortcut. */
export class InlineCodeInput {
  private pending: { doc: PMNode; position: number; selected: Slice; active: boolean } | null = null;
  constructor(private editor: Editor) {}
  clear() { this.pending = null; }
  key(event: KeyboardEvent) {
    if (!['"', 'Shift'].includes(event.key) || event.ctrlKey || event.metaKey || event.altKey) this.clear();
  }
  text(from: number, to: number, text: string): boolean {
    const { state, view } = this.editor;
    const cursor = state.doc.resolve(from);
    if (text !== '"' || !cursor.parent.isTextblock || cursor.parent.type.spec.code
      || !cursor.sameParent(state.doc.resolve(to))) { this.clear(); return false; }
    const previous = this.pending;
    const mark = state.schema.marks.inlineCode!;
    if (previous && previous.doc === state.doc && from === to && from === previous.position + 1) {
      const tr = closeHistory(state.tr).replace(previous.position, from, previous.selected);
      const end = previous.position + previous.selected.size;
      if (end > previous.position) {
        if (previous.active) tr.removeMark(previous.position, end, mark);
        else tr.addMark(previous.position, end, mark.create());
      }
      tr.setSelection(TextSelection.create(tr.doc, end));
      if (previous.active) tr.removeStoredMark(mark);
      else tr.addStoredMark(mark.create());
      this.clear(); view.dispatch(tr); view.dispatch(closeHistory(this.editor.state.tr));
      return true;
    }
    const selected = state.doc.slice(from, to);
    const active = this.editor.isActive('inlineCode');
    view.dispatch(state.tr.insertText(text, from, to));
    this.pending = { doc: this.editor.state.doc, position: from, selected, active };
    return true;
  }
}
