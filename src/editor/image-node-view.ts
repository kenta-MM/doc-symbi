import type { NodeViewRenderer } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';
import { imageFileSchema, imageSource } from '../domain/image';

export const imageNodeView: NodeViewRenderer = ({ node, editor, getPos }) => {
  let current = node;
  const dom = document.createElement('figure');
  dom.className = 'attached-image';
  const frame = document.createElement('span');
  frame.className = 'image-resize-frame';
  const img = document.createElement('img');
  img.draggable = false;
  const caption = document.createElement('figcaption');
  frame.append(img); dom.append(frame, caption);
  const render = () => {
    const source = imageSource(imageFileSchema.parse(current.attrs.file));
    if (img.getAttribute('src') !== source) img.src = source;
    img.alt = String(current.attrs.alt);
    caption.textContent = String(current.attrs.caption);
    const size = current.attrs.displaySize as { width: number; height: number } | null;
    img.style.width = size ? `${size.width}px` : '';
    img.style.height = size ? `${size.height}px` : '';
  };
  render();
  let cancel = () => {};
  for (const [corner, label] of [['nw', '左上'], ['ne', '右上'], ['sw', '左下'], ['se', '右下']] as const) {
    const handle = document.createElement('button');
    handle.type = 'button'; handle.className = `image-resize-handle ${corner}`;
    handle.setAttribute('aria-label', `画像サイズ変更（${label}）`);
    handle.onpointerdown = event => {
      if (!editor.isEditable || event.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      cancel();
      const pos = getPos(); if (pos === undefined) return;
      editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos)));
      const rect = img.getBoundingClientRect(), startX = event.clientX, startY = event.clientY;
      let width = rect.width, height = rect.height;
      const move = (next: PointerEvent) => {
        if (next.pointerId !== event.pointerId) return;
        width = Math.round(Math.min(20000, Math.max(24, rect.width + (next.clientX - startX) * (corner.endsWith('w') ? -1 : 1))));
        height = Math.round(Math.min(20000, Math.max(24, rect.height + (next.clientY - startY) * (corner.startsWith('n') ? -1 : 1))));
        img.style.width = `${width}px`; img.style.height = `${height}px`;
      };
      const cleanup = () => {
        window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', finish);
        window.removeEventListener('pointercancel', abort); window.removeEventListener('keydown', key);
        cancel = () => {};
      };
      const abort = () => { cleanup(); render(); };
      const key = (next: KeyboardEvent) => { if (next.key === 'Escape') abort(); };
      const finish = (next: PointerEvent) => {
        if (next.pointerId !== event.pointerId) return;
        cleanup();
        const at = getPos();
        if (editor.isEditable && at !== undefined && (width !== rect.width || height !== rect.height)) {
          editor.view.dispatch(closeHistory(editor.state.tr).setNodeMarkup(at, undefined, { ...current.attrs, displaySize: { width, height } }));
          editor.view.dispatch(closeHistory(editor.state.tr));
        }
        render();
      };
      cancel = abort;
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', finish);
      window.addEventListener('pointercancel', abort); window.addEventListener('keydown', key);
    };
    frame.append(handle);
  }
  return { dom, update(next) { if (next.type !== current.type) return false; current = next; render(); return true; },
    stopEvent: event => event.target instanceof Element && !!event.target.closest('.image-resize-handle'),
    ignoreMutation: () => true, destroy: () => cancel(),
  };
};
