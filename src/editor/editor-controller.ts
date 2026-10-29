import { Editor } from '@tiptap/core';
import { editorHistory } from './history';
import { focusHeading } from './focus-heading';
import type { EditorPort, EditorCommand, CursorAction, CursorContext } from '../application/ports/editor';
import type { Document, List, Block } from '../domain/schema';
import type { Metadata } from '../domain/metadata';
import type { DocumentEnvironment } from '../domain/document';
import { acceptBodyChange } from '../domain/accept-body-change';
import { equivalent } from '../domain/equivalence';
import { editorNodes } from './schema';
import { toEditor, fromEditor, encodeBlock } from './adapter';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { safeLink, languageSchema } from '../domain/rich-text';
import { assignIdentity } from './identity';
import { plainTextPaste } from './input';
import { executeCommand } from './transaction-bridge';
import { applyHeading } from './apply-heading';

function textElements(document: Document): { id: string; text: string; metadata: Metadata }[] {
  const result: { id: string; text: string; metadata: Metadata }[] = [];
  const visitList = (list: List) => { for (const item of list.items) { result.push(item); item.children.forEach(visitList); } };
  for (const block of document.blocks) { if (block.kind === 'list') visitList(block); else if (block.kind === 'table') result.push(...block.rows.flat()); else if (block.kind !== 'image' && block.kind !== 'quiz') result.push(block); }
  return result;
}

export class EditorController implements EditorPort {
  private editor: Editor | undefined;
  private listeners = new Set<(document: Document) => void>();
  private selectionListeners = new Set<() => void>();
  private dispatchFailure: Error | null = null;
  constructor(private readonly host: HTMLElement, private readonly current: () => Document,
    private readonly environment: DocumentEnvironment, private readonly onError: (error: Error) => void) {}
  mount(document: Document): void {
    this.editor?.destroy();
    let validated: { node: ProseMirrorNode; document: Document } | null = null;
    const editor = new Editor({ element: this.host, extensions: [...editorNodes, editorHistory],
      content: toEditor(document), enableInputRules: false, enablePasteRules: false,
      editorProps: { attributes: { role: 'textbox', 'aria-label': '文書本文', 'aria-multiline': 'true' }, handlePaste: plainTextPaste,
        handleDOMEvents: { contextmenu: (view, event) => {
          if (!editor.isEditable) return false;
          const figure = (event.target as HTMLElement).closest('figure');
          if (figure) { const pos = view.posAtDOM(figure, 0); const resolved = view.state.doc.resolve(pos); const at = resolved.parent.type.name === 'imageBlock' ? resolved.before() : pos; view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, at))); }
          if (!figure && view.state.selection.empty) return false;
          event.preventDefault();
          this.host.dispatchEvent(new CustomEvent('editor-context', { bubbles: true, detail: { x: event.clientX, y: event.clientY, imageId: figure ? this.cursorContext().blockId : undefined } }));
          return true;
        }, click: (_view, event) => {
          const anchor = (event.target as HTMLElement).closest('a');
          if (anchor && editor.isEditable) { event.preventDefault(); return true; }
          return false;
        } },
        handleKeyDown: (view, event) => {
          if (!editor.isEditable) return false;
          if (event.key === 'Enter' && this.cursorContext().inTable) {
            event.preventDefault();
            if (event.ctrlKey || event.metaKey) {
              const pos = view.state.selection.$from.after(1);
              const tr = view.state.tr.insert(pos, view.state.schema.nodes.paragraph!.create());
              view.dispatch(tr.setSelection(TextSelection.create(tr.doc, pos + 1)).scrollIntoView());
            } else editor.commands.setHardBreak();
            return true;
          }
          if (event.key !== 'Tab') return false;
          const cells: number[] = []; view.state.doc.descendants((node, pos) => { if (['tableCell', 'tableHeader'].includes(node.type.name)) cells.push(pos + 2); });
          let index = -1; cells.forEach((pos, i) => { if (pos <= view.state.selection.from) index = i; });
          if (!this.cursorContext().inTable || index < 0) return false;
          event.preventDefault(); const next = cells[index + (event.shiftKey ? -1 : 1)];
          if (next !== undefined) view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, next)).scrollIntoView());
          return true;
        },
      },
      onSelectionUpdate: () => { for (const listener of this.selectionListeners) listener(); },
      onUpdate: () => {
        const current = this.current();
        // Reuse validation from dispatch only for this exact immutable editor tree.
        const decoded = validated?.node === editor.state.doc ? validated.document : fromEditor(editor.getJSON(), current);
        const accepted = acceptBodyChange(current, decoded.blocks, this.environment.clock);
        for (const listener of this.listeners) listener(accepted);
        for (const listener of this.selectionListeners) listener();
      },
    });
    const dispatch = editor.view.props.dispatchTransaction!;
    editor.view.setProps({ dispatchTransaction: transaction => {
      try {
        if (transaction.docChanged) {
          if (!editor.isEditable) return;
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
          validated = { node: transaction.doc, document: candidate };
        }
        dispatch(transaction);
      } catch (error) { this.dispatchFailure = error instanceof Error ? error : new Error('編集を適用できません'); this.onError(this.dispatchFailure); }
    } });
    this.editor = editor;
  }
  execute(command: EditorCommand, environment: DocumentEnvironment): void {
    if (!this.editor) throw new Error('Editor is not mounted');
    if (!this.editor.isEditable) return;
    this.dispatchFailure = null;
    executeCommand(this.editor, this.current(), command, environment);
    if (this.dispatchFailure) throw this.dispatchFailure;
  }
  focusHeading(id: string): void {
    const editor = this.editor;
    if (!editor) return;
    focusHeading(editor, id);
  }
  setEditable(editable: boolean): void {
    this.editor?.setEditable(editable, false);
    this.editor?.view.dom.setAttribute('aria-readonly', String(!editable));
  }
  applyHeading(): void {
    if (!this.editor?.isEditable) return;
    try { applyHeading(this.editor, this.current(), this.environment); }
    catch (error) { this.onError(error instanceof Error ? error : new Error('見出しを適用できません')); }
  }
  cursorContext(): CursorContext {
    const editor = this.editor;
    if (!editor) return { selected: false, inTable: false };
    const { selection } = editor.state;
    const node = selection instanceof NodeSelection ? selection.node : selection.$from.node(1);
    return { blockId: node?.attrs.id as string, selected: !selection.empty && !(selection instanceof NodeSelection), inTable: editor.isActive('table'), headingLevel: editor.isActive('heading') ? Number(editor.getAttributes('heading').level) : undefined, language: editor.isActive('codeBlock') ? String(editor.getAttributes('codeBlock').language ?? 'text') : undefined, href: editor.getAttributes('link').href as string | undefined };
  }
  onSelectionChange(listener: () => void): () => void { this.selectionListeners.add(listener); return () => { this.selectionListeners.delete(listener); }; }
  insertAtCursor(block: Block): void {
    if (!this.editor?.isEditable) return;
    this.dispatchFailure = null;
    this.editor.chain().focus().insertContent(encodeBlock(block)).run();
    if (this.dispatchFailure) throw this.dispatchFailure;
  }
  setLink(href: string): void {
    if (!this.editor?.isEditable || this.editor.state.selection.empty) return;
    if (!safeLink(href)) throw new Error('http(s)・mailto・記事リンクを入力してください');
    this.dispatchFailure = null;
    this.editor.chain().focus().setMark('link', { href }).run();
    if (this.dispatchFailure) throw this.dispatchFailure;
  }
  applyAtCursor(action: CursorAction, value?: string): void {
    const editor = this.editor;
    if (!editor?.isEditable) return;
    if (editor.state.selection instanceof NodeSelection && ['paragraph', 'heading', 'code', 'bullet', 'ordered'].includes(action)) {
      const common = { id: this.environment.id(), metadata: {} };
      const block: Block = action === 'bullet' || action === 'ordered'
        ? { ...common, kind: 'list', style: action, items: [{ id: this.environment.id(), metadata: {}, text: '', children: [] }] }
        : action === 'heading' ? { ...common, kind: 'heading', level: 1, text: '' }
        : action === 'code' ? { ...common, kind: 'code', language: languageSchema.parse(value ?? 'text'), text: '' }
        : { ...common, kind: 'paragraph', text: '' };
      editor.chain().focus().insertContentAt(editor.state.selection.to, encodeBlock(block)).run(); return;
    }
    if (action === 'up' || action === 'down' || action === 'headingLevel') {
      const id = this.cursorContext().blockId; if (!id) return;
      if (action === 'headingLevel') this.execute({ type: 'setHeadingLevel', id, level: Number(value) }, this.environment);
      else { const index = this.current().blocks.findIndex(block => block.id === id) + (action === 'up' ? -1 : 1); if (index >= 0 && index < this.current().blocks.length) this.execute({ type: 'moveBlock', id, index }, this.environment); }
      editor.state.doc.descendants((node, pos) => {
        if (node.attrs.id === id) { editor.view.dispatch(editor.state.tr.setSelection(node.isTextblock ? TextSelection.create(editor.state.doc, pos + 1) : NodeSelection.create(editor.state.doc, pos)).scrollIntoView()); return false; }
      });
      editor.view.focus(); return;
    }
    if (['paragraph', 'heading', 'code', 'bullet', 'ordered'].includes(action) && ['paragraph', 'heading', 'codeBlock'].includes(editor.state.selection.$from.node(1)?.type.name ?? '')) {
      if (action === 'code' && editor.isActive('codeBlock') && value) editor.chain().focus().updateAttributes('codeBlock', { language: languageSchema.parse(value) }).run();
      else applyHeading(editor, this.current(), this.environment, { kind: action as 'paragraph' | 'heading' | 'code' | 'bullet' | 'ordered', ...(action === 'code' ? { language: languageSchema.parse(value ?? 'text') } : {}) });
      return;
    }
    if (action === 'heading') { if (!this.cursorContext().inTable) this.applyHeading(); return; }
    if (action === 'bold') { editor.chain().focus().toggleMark('bold').run(); return; }
    if (action === 'bullet' || action === 'ordered') {
      if (this.cursorContext().inTable) return;
      const { $from } = editor.state.selection;
      for (let depth = $from.depth; depth > 0; depth--) {
        const node = $from.node(depth);
        if (['bulletList', 'orderedList'].includes(node.type.name)) { this.execute({ type: 'setListStyle', listId: String(node.attrs.id), style: action }, this.environment); editor.view.focus(); return; }
      }
      editor.chain().focus().toggleList(action === 'bullet' ? 'bulletList' : 'orderedList', 'listItem').run(); return;
    }
    if (action === 'indent' || action === 'outdent') { const chain = editor.chain().focus(); (action === 'indent' ? chain.sinkListItem('listItem') : chain.liftListItem('listItem')).run(); return; }
    if (action === 'paragraph' || action === 'code') {
      if (this.cursorContext().inTable && action === 'code') return;
      editor.chain().focus().setNode(action === 'code' ? 'codeBlock' : 'paragraph', action === 'code' ? { language: value ?? 'text' } : {}).run(); return;
    }
    const context = this.cursorContext();
    if (action === 'delete' && context.blockId) { this.execute({ type: 'deleteBlock', id: context.blockId }, this.environment); return; }
    if (context.inTable && context.blockId) {
      const block = structuredClone(this.current().blocks.find(block => block.id === context.blockId));
      if (block?.kind !== 'table') return;
      if ((action === 'rowDelete' && block.rows.length === 1) || (action === 'columnDelete' && block.rows[0]!.length === 1)) {
        this.execute({ type: 'deleteBlock', id: block.id }, this.environment); editor.view.focus(); return;
      }
      const { $from } = editor.state.selection;
      const row = $from.index(1), column = $from.index(2);
      const cell = (header = false) => ({ id: this.environment.id(), metadata: {}, text: '', header });
      if (action === 'rowAdd') block.rows.splice(row + 1, 0, block.rows[0]!.map(() => cell()));
      if (action === 'rowDelete' && block.rows.length > 1) block.rows.splice(row, 1);
      if (action === 'columnAdd') block.rows.forEach(cells => cells.splice(column + 1, 0, cell(cells.every(c => c.header))));
      if (action === 'columnDelete' && block.rows[0]!.length > 1) block.rows.forEach(cells => cells.splice(column, 1));
      const pos = $from.before(1), original = $from.node(1);
      const replacement = editor.schema.nodeFromJSON(encodeBlock(block));
      const tr = editor.state.tr.replaceWith(pos, pos + original.nodeSize, replacement);
      const targetRow = Math.min(row, replacement.childCount - 1);
      const targetColumn = Math.min(column, replacement.child(targetRow).childCount - 1);
      let cellPos = pos + 1;
      for (let i = 0; i < targetRow; i++) cellPos += replacement.child(i).nodeSize;
      cellPos++;
      for (let i = 0; i < targetColumn; i++) cellPos += replacement.child(targetRow).child(i).nodeSize;
      editor.view.dispatch(tr.setSelection(TextSelection.create(tr.doc, cellPos + 2)));
      editor.view.focus();
    }
  }
  undo(): void { if (this.editor?.isEditable) this.editor.commands.undo(); }
  redo(): void { if (this.editor?.isEditable) this.editor.commands.redo(); }
  get canUndo(): boolean { return this.editor?.can().undo() ?? false; }
  get canRedo(): boolean { return this.editor?.can().redo() ?? false; }
  onAcceptedChange(listener: (document: Document) => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  dispose(): void { this.editor?.destroy(); this.editor = undefined; this.listeners.clear(); this.selectionListeners.clear(); }
}
