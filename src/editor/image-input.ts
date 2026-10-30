import type { Editor } from '@tiptap/core';
import { Selection, TextSelection, type SelectionBookmark, type Transaction } from '@tiptap/pm/state';
import { Fragment, Slice } from '@tiptap/pm/model';
import type { DocumentEnvironment } from '../domain/document';
import { emptyImageSemantics } from '../domain/image';
import { readImage } from '../platform/read-image';
import { encodeBlock } from './adapter';
import { closeHistory } from './history';

function images(files: FileList | File[]) { return Array.from(files).filter(file => file.type.startsWith('image/') || /\.(png|jpe?g|webp|svg|gif|bmp)$/i.test(file.name)); }
export class ImageInput {
  private marker: HTMLDivElement | null = null;
  private pending = new Set<{ bookmark: SelectionBookmark }>();
  private alive = true;
  constructor(private editor: Editor, private environment: DocumentEnvironment, private error: (error: Error) => void) {}
  map(transaction: Transaction) { for (const target of this.pending) target.bookmark = target.bookmark.map(transaction.mapping); }
  clearMarker() { this.marker?.remove(); this.marker = null; }
  dispose() { this.alive = false; this.pending.clear(); this.clearMarker(); }
  private position(event: DragEvent): number | null {
    const hit = this.editor.view.posAtCoords({ left: event.clientX, top: event.clientY });
    if (!hit) return null;
    const pos = this.editor.state.doc.resolve(hit.pos);
    if (pos.depth && (pos.depth > 1 || !['paragraph', 'heading'].includes(pos.parent.type.name))) return pos.after(1);
    return hit.pos;
  }
  drag(event: DragEvent): boolean {
    if (!this.editor.isEditable || !event.dataTransfer || !Array.from(event.dataTransfer.items).some(item => item.kind === 'file' && (item.type.startsWith('image/') || !item.type))) { this.clearMarker(); return false; }
    const position = this.position(event); if (position === null) return false;
    event.preventDefault(); event.dataTransfer.dropEffect = 'copy';
    this.clearMarker();
    const rect = this.editor.view.coordsAtPos(position);
    const marker = document.createElement('div'); marker.className = 'image-drop-marker'; marker.setAttribute('aria-label', '画像の挿入位置');
    Object.assign(marker.style, { left: `${rect.left}px`, top: `${rect.top}px`, height: `${Math.max(20, rect.bottom - rect.top)}px` });
    document.body.append(marker); this.marker = marker; return true;
  }
  drop(event: DragEvent): boolean {
    this.clearMarker();
    if (!this.editor.isEditable || !event.dataTransfer) return false;
    const files = images(event.dataTransfer.files); if (!files.length) return false;
    event.preventDefault();
    const pos = this.position(event); if (pos === null) return true;
    const resolved = this.editor.state.doc.resolve(pos);
    const selection = resolved.parent.inlineContent ? TextSelection.create(this.editor.state.doc, pos) : Selection.near(resolved);
    this.read(files, selection.getBookmark()); return true;
  }
  paste(event: ClipboardEvent): boolean {
    if (!this.editor.isEditable || !event.clipboardData) return false;
    const files = images(event.clipboardData.files); if (!files.length) return false;
    event.preventDefault();
    const selection = this.editor.state.selection;
    if (selection.$from.depth > 1) { this.error(new Error('画像は本文の段落に挿入してください')); return true; }
    this.read(files, selection.getBookmark()); return true;
  }
  private read(files: File[], bookmark: SelectionBookmark) {
    const target = { bookmark }; this.pending.add(target);
    void Promise.all(files.map(async file => ({ kind: 'image' as const, id: this.environment.id(), metadata: {}, file: await readImage(file, this.environment.id()), caption: file.name, alt: '', semantics: emptyImageSemantics() }))).then(blocks => {
      if (!this.alive || !this.editor.isEditable) return;
      const nodes = blocks.map(block => this.editor.schema.nodeFromJSON(encodeBlock(block)));
      const tr = closeHistory(this.editor.state.tr).setSelection(target.bookmark.resolve(this.editor.state.doc)).replaceSelection(new Slice(Fragment.fromArray(nodes), 0, 0));
      this.editor.view.dispatch(tr.scrollIntoView());
      this.editor.view.dispatch(closeHistory(this.editor.state.tr));
    }).catch(error => { if (this.alive) this.error(error instanceof Error ? error : new Error('画像を挿入できません')); }).finally(() => this.pending.delete(target));
  }
}
