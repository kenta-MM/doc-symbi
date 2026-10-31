import type { Editor } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { TextSelection, Selection } from '@tiptap/pm/state';
import type { Block } from '../domain/schema';
import type { DocumentEnvironment } from '../domain/document';
import { encodeBlock } from './adapter';
import { closeHistory } from './history';
import { automaticInputEnabled, saveAutomaticInput } from '../platform/input-preferences';
import { InlineCodeInput } from './inline-code-input';

const choices = [{ command: 'table', label: '表' }, { command: 'quiz', label: 'クイズ' }, { command: 'code', label: 'コードブロック' }, { command: 'heading', label: '見出し' }] as const;
type Choice = typeof choices[number];

/** Only direct, contiguous input in a top-level paragraph starts a shortcut. */
export class InputAssistance {
  enabled = automaticInputEnabled();
  private direct: { doc: PMNode; position: number; end: number } | null = null;
  private conversion: { doc: PMNode; position: number; size: number; original: PMNode; offset: number; cursor: number } | null = null;
  private slashId: string | null = null;
  private pending: { id: string; node: PMNode } | null = null;
  private menu: HTMLDivElement | null = null;
  private selected = 0;
  private fence: { doc: PMNode; position: number; third: boolean } | null = null;
  private matches: readonly Choice[] = [];
  private inlineCode: InlineCodeInput;
  constructor(private editor: Editor, private host: HTMLElement, private environment: DocumentEnvironment) { this.inlineCode = new InlineCodeInput(editor); }
  setEnabled(value: boolean) { this.enabled = value; saveAutomaticInput(value); this.direct = null; this.conversion = null; this.fence = null; this.inlineCode.clear(); }
  interrupt() { this.direct = null; this.conversion = null; this.fence = null; this.inlineCode.clear(); this.closeMenu(); }
  dispose() { this.interrupt(); this.pending = null; }
  private paragraph() {
    const { selection } = this.editor.state;
    return selection.empty && selection.$from.depth === 1 && selection.$from.parent.type.name === 'paragraph' ? selection.$from : null;
  }
  text(from: number, to: number, text: string): boolean {
    if (!this.editor.isEditable || this.editor.view.composing) return false;
    if (this.enabled && this.inlineCode.text(from, to, text)) { this.direct = null; this.conversion = null; this.fence = null; return true; }
    // Code examples must keep block shortcuts literal. Process quote toggling
    // above first so the user can still leave inline code with two quotes.
    if (this.editor.isActive('inlineCode')) {
      this.direct = null; this.conversion = null; this.fence = null; this.closeMenu();
      return false;
    }
    // The second backtick already created the block. Accept a third backtick
    // followed by Enter as the existing fence shortcut, without inserting it.
    if (this.fence && !this.fence.third && this.fence.doc === this.editor.state.doc
      && from === to && from === this.fence.position + 1 && text === '`' && this.conversion) {
      this.fence.third = true;
      this.conversion.original = this.conversion.original.type.create(this.conversion.original.attrs, this.editor.schema.text('```'));
      this.conversion.offset = 3;
      return true;
    }
    this.fence = null;
    // DOM input may arrive before ProseMirror has synchronized its selection.
    // The input callback's range is authoritative, not state.selection.
    const cursor = this.editor.state.doc.resolve(from);
    if (cursor.depth !== 1 || !['paragraph', 'heading'].includes(cursor.parent.type.name) || from !== to) { this.direct = null; return false; }
    const continues = this.direct?.doc.eq(this.editor.state.doc) && this.direct.end === from;
    const starts = cursor.parentOffset === 0 && /^[#1`/-]$/.test(text);
    if (!continues && !starts) return false;
    const position = cursor.before();
    const tr = this.editor.state.tr.insertText(text, from, to);
    tr.setSelection(TextSelection.create(tr.doc, from + text.length));
    const original = tr.doc.nodeAt(position)!;
    const prefix = original.textBetween(0, cursor.parentOffset + text.length);
    const marker = /^(#{1,6}|-|1\.) $/.exec(prefix);
    if (this.enabled && prefix === '``') {
      this.convert(position, original, 2, '```');
      if (original.content.size === 2) this.fence = { doc: this.editor.state.doc, position, third: false };
      return true;
    }
    if (this.enabled && marker && (cursor.parent.type.name !== 'heading' || marker[1]!.startsWith('#'))) {
      this.convert(position, original, prefix.length, marker[1]!);
      return true;
    }
    this.editor.view.dispatch(tr);
    this.direct = { doc: this.editor.state.doc, position, end: from + text.length };
    if (text === '/' && cursor.parent.content.size === 0) { this.slashId = String(this.editor.state.doc.nodeAt(position)!.attrs.id); this.selected = 0; }
    this.update();
    return true;
  }
  private convert(position: number, original: PMNode, offset: number, marker: string) {
    const { schema } = this.editor;
    const content = original.content.cut(offset);
    let replacement: PMNode;
    if (marker === '-' || marker === '1.') {
      const paragraph = schema.nodes.paragraph!.create(null, content);
      const item = schema.nodes.listItem!.create({ id: this.environment.id(), metadata: {} }, paragraph);
      replacement = schema.nodes[marker === '-' ? 'bulletList' : 'orderedList']!.create(original.attrs, item);
    } else if (marker === '```') {
      const text = original.textBetween(offset, original.content.size, '\n', '\n');
      replacement = schema.nodes.codeBlock!.create({ ...original.attrs, language: 'text' }, text ? schema.text(text) : undefined);
    } else replacement = schema.nodes.heading!.create({ ...original.attrs, level: marker.length }, content);
    const old = this.editor.state.doc.nodeAt(position)!;
    const tr = closeHistory(this.editor.state.tr).replaceWith(position, position + old.nodeSize, replacement);
    tr.setSelection(TextSelection.create(tr.doc, position + (marker === '-' || marker === '1.' ? 3 : 1)));
    this.editor.view.dispatch(tr.scrollIntoView());
    if (this.editor.state.doc.nodeAt(position)?.type !== replacement.type) return;
    this.conversion = { doc: this.editor.state.doc, position, size: replacement.nodeSize, original, offset, cursor: this.editor.state.selection.from };
    this.direct = null;
    this.editor.view.dispatch(closeHistory(this.editor.state.tr));
  }
  key(event: KeyboardEvent): boolean {
    if (!this.editor.isEditable || event.isComposing || event.keyCode === 229 || this.editor.view.composing) return false;
    this.inlineCode.key(event);
    if (this.fence && this.fence.doc === this.editor.state.doc && this.editor.state.selection.empty
      && this.editor.state.selection.from === this.fence.position + 1) {
      if (!this.fence.third && event.key === '`' && !event.ctrlKey && !event.metaKey && !event.altKey) return false;
      if (this.fence.third && event.key === 'Enter' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
        this.fence = null; return true;
      }
      if (event.key === 'Shift') return false;
    }
    this.fence = null;
    if (event.key === 'Escape' && this.slashId) { this.closeMenu(); return true; }
    if (this.slashId && this.matches.length && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        this.selected = (this.selected + (event.key === 'ArrowDown' ? 1 : -1) + this.matches.length) % this.matches.length;
        this.renderMenu(); return true;
      }
      if (event.key === 'Enter' || event.key === 'Tab') { this.choose(this.matches[this.selected]!); return true; }
    }
    const previous = this.conversion;
    if (event.key === 'Backspace' && !event.ctrlKey && !event.metaKey && !event.altKey && previous && previous.doc === this.editor.state.doc && this.editor.state.selection.empty && previous.cursor === this.editor.state.selection.from) {
      const tr = closeHistory(this.editor.state.tr).replaceWith(previous.position, previous.position + previous.size, previous.original);
      this.editor.view.dispatch(tr.setSelection(TextSelection.create(tr.doc, previous.position + 1 + previous.offset)).scrollIntoView());
      this.conversion = null; this.direct = null;
      this.editor.view.dispatch(closeHistory(this.editor.state.tr));
      return true;
    }
    if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
      const cursor = this.paragraph();
      if (this.enabled && cursor && cursor.parent.textContent === '```' && cursor.parentOffset === 3 && this.direct?.doc === this.editor.state.doc && this.direct.end === this.editor.state.selection.from) {
        this.convert(cursor.before(), cursor.parent, 3, '```'); return true;
      }
      const { selection, schema } = this.editor.state;
      if (selection.empty && selection.$from.depth === 1 && selection.$from.parent.type.name === 'heading' && selection.$from.parentOffset === selection.$from.parent.content.size) {
        const tr = this.editor.state.tr.insert(selection.$from.after(), schema.nodes.paragraph!.create());
        this.editor.view.dispatch(tr.setSelection(TextSelection.create(tr.doc, selection.$from.after() + 1)).scrollIntoView()); return true;
      }
    }
    if (event.key !== 'Shift') this.conversion = null;
    return false;
  }
  update() {
    if (!this.slashId) return;
    const cursor = this.paragraph();
    if (!this.editor.isEditable || !cursor || cursor.parent.attrs.id !== this.slashId || cursor.parentOffset !== cursor.parent.content.size || !/^\/[^\s/]*$/.test(cursor.parent.textContent)) { this.closeMenu(); return; }
    const query = cursor.parent.textContent.slice(1).toLowerCase();
    this.matches = choices.filter(choice => choice.command.startsWith(query) || choice.label.startsWith(query));
    this.selected = Math.min(this.selected, Math.max(0, this.matches.length - 1));
    this.renderMenu();
  }
  private renderMenu() {
    this.menu?.remove(); this.menu = null;
    if (!this.matches.length) return;
    const menu = document.createElement('div'); menu.className = 'slash-menu'; menu.setAttribute('role', 'listbox'); menu.setAttribute('aria-label', '挿入メニュー');
    const rect = this.editor.view.coordsAtPos(this.editor.state.selection.from);
    menu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 210))}px`;
    menu.style.top = `${Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 110))}px`;
    this.matches.forEach((choice, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = choice.label; button.setAttribute('role', 'option'); button.setAttribute('aria-selected', String(index === this.selected));
      button.onmousedown = event => event.preventDefault(); button.onclick = () => this.choose(choice); menu.append(button);
    });
    document.body.append(menu); this.menu = menu;
  }
  private choose(choice: Choice) {
    const cursor = this.paragraph(); if (!cursor) return;
    this.pending = { id: String(cursor.parent.attrs.id), node: cursor.parent };
    this.closeMenu();
    if (choice.command === 'heading') { this.insert({ kind: 'heading', id: String(cursor.parent.attrs.id), metadata: {}, text: '', level: 1 }); return; }
    if (choice.command === 'code') {
      this.insert({ kind: 'code', id: String(cursor.parent.attrs.id), metadata: {}, text: '', language: 'text' });
      return;
    }
    this.host.dispatchEvent(new CustomEvent('editor-insert-request', { bubbles: true, detail: choice.command }));
  }
  cancel() { this.pending = null; this.closeMenu(); this.editor.view.focus(); }
  insert(block: Block): boolean {
    if (!this.pending) return false;
    let position = -1;
    this.editor.state.doc.forEach((node, pos) => { if (node.attrs.id === this.pending!.id && node.eq(this.pending!.node)) position = pos; });
    if (position < 0) throw new Error('挿入位置の内容が変更されました。キャンセルしてやり直してください');
    const original = this.pending.node;
    const replacement = this.editor.schema.nodeFromJSON(encodeBlock({ ...block, id: original.attrs.id, metadata: original.attrs.metadata }));
    const tr = closeHistory(this.editor.state.tr).replaceWith(position, position + original.nodeSize, replacement);
    this.editor.view.dispatch(tr.setSelection(Selection.near(tr.doc.resolve(position))).scrollIntoView());
    // Keep the command available if the controller rejected validation.
    if (this.editor.state.doc.nodeAt(position)?.type !== replacement.type) throw new Error('挿入を適用できません');
    this.pending = null; this.editor.view.dispatch(closeHistory(this.editor.state.tr)); this.editor.view.focus(); return true;
  }
  private closeMenu() { this.slashId = null; this.matches = []; this.menu?.remove(); this.menu = null; }
}
