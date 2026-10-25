import { Editor } from '@tiptap/core';
import { editorHistory } from './history';
import { focusHeading } from './focus-heading';
import type { EditorPort, EditorCommand } from '../application/ports/editor';
import type { Document, List } from '../domain/schema';
import type { Metadata } from '../domain/metadata';
import type { DocumentEnvironment } from '../domain/document';
import { acceptBodyChange } from '../domain/accept-body-change';
import { equivalent } from '../domain/equivalence';
import { editorNodes } from './schema';
import { toEditor, fromEditor } from './adapter';
import { assignIdentity } from './identity';
import { plainTextPaste } from './input';
import { executeCommand } from './transaction-bridge';

function textElements(document: Document): { id: string; text: string; metadata: Metadata }[] {
  const result: { id: string; text: string; metadata: Metadata }[] = [];
  const visitList = (list: List) => { for (const item of list.items) { result.push(item); item.children.forEach(visitList); } };
  for (const block of document.blocks) { if (block.kind === 'list') visitList(block); else result.push(block); }
  return result;
}

export class EditorController implements EditorPort {
  private editor: Editor | undefined;
  private listeners = new Set<(document: Document) => void>();
  constructor(private readonly host: HTMLElement, private readonly current: () => Document,
    private readonly environment: DocumentEnvironment, private readonly onError: (error: Error) => void) {}
  mount(document: Document): void {
    this.editor?.destroy();
    const editor = new Editor({ element: this.host, extensions: [...editorNodes, editorHistory],
      content: toEditor(document), enableInputRules: false, enablePasteRules: false,
      editorProps: { attributes: { role: 'textbox', 'aria-label': '文書本文', 'aria-multiline': 'true' }, handlePaste: plainTextPaste },
      onUpdate: () => {
        const current = this.current();
        const decoded = fromEditor(editor.getJSON(), current);
        const accepted = acceptBodyChange(current, decoded.blocks, this.environment.clock);
        for (const listener of this.listeners) listener(accepted);
      },
    });
    const dispatch = editor.view.props.dispatchTransaction!;
    editor.view.setProps({ dispatchTransaction: transaction => {
      try {
        if (transaction.docChanged) {
          assignIdentity(transaction, this.environment.id);
          const before = this.current();
          const candidate = fromEditor(transaction.doc.toJSON(), before);
          // Native joins may remove a node. Reject a merge that would silently
          // discard a different metadata value; explicit domain commands were checked already.
          if (!transaction.getMeta('docsymbi-command')) {
            const oldElements = textElements(before);
            const oldById = new Map(oldElements.map(element => [element.id, element]));
            const newElements = textElements(candidate);
            const newIds = new Set(newElements.map(element => element.id));
            for (const removed of oldElements) {
              if (newIds.has(removed.id)) continue;
              for (const survivor of newElements) {
                const previous = oldById.get(survivor.id);
                if (previous && (survivor.text === previous.text + removed.text || survivor.text === removed.text + previous.text)
                  && !equivalent(previous.metadata, removed.metadata)) throw new Error('metadata が異なるブロック・項目は結合できません');
              }
            }
          }
        }
        dispatch(transaction);
      } catch (error) { this.onError(error instanceof Error ? error : new Error('編集を適用できません')); }
    } });
    this.editor = editor;
  }
  execute(command: EditorCommand, environment: DocumentEnvironment): void {
    if (!this.editor) throw new Error('Editor is not mounted');
    executeCommand(this.editor, this.current(), command, environment);
  }
  focusHeading(id: string): void {
    const editor = this.editor;
    if (!editor) return;
    focusHeading(editor, id);
  }
  undo(): void { this.editor?.commands.undo(); }
  redo(): void { this.editor?.commands.redo(); }
  get canUndo(): boolean { return this.editor?.can().undo() ?? false; }
  get canRedo(): boolean { return this.editor?.can().redo() ?? false; }
  onAcceptedChange(listener: (document: Document) => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  dispose(): void { this.editor?.destroy(); this.editor = undefined; this.listeners.clear(); }
}
