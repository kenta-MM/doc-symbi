import type { NodeViewRenderer } from '@tiptap/core';
import { closeHistory } from '@tiptap/pm/history';

export const tableNodeView: NodeViewRenderer = ({ node, editor, getPos }) => {
  let current = node;
  const dom = document.createElement('div');
  dom.className = 'table-resize-frame';
  const table = document.createElement('table');
  const contentDOM = document.createElement('tbody');
  const handle = document.createElement('button');
  handle.type = 'button';
  handle.contentEditable = 'false';
  handle.className = 'table-resize-handle';
  handle.setAttribute('aria-label', '表サイズ変更（右下）');
  handle.title = 'ドラッグして表の幅・高さを変更';
  table.append(contentDOM); dom.append(table, handle);
  const render = () => {
    const size = current.attrs.displaySize as { width: number; height: number } | null;
    dom.style.width = size ? `${size.width}px` : '';
    table.style.height = size ? `${size.height}px` : '';
  };
  render();
  let cancel = () => {};
  handle.onpointerdown = event => {
    if (!editor.isEditable || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); cancel();
    const rect = table.getBoundingClientRect();
    let width = Math.round(rect.width), height = Math.round(rect.height);
    const move = (next: PointerEvent) => {
      if (next.pointerId !== event.pointerId) return;
      width = Math.round(Math.min(20000, Math.max(80, rect.width + next.clientX - event.clientX)));
      height = Math.round(Math.min(20000, Math.max(24, rect.height + next.clientY - event.clientY)));
      dom.style.width = `${width}px`; table.style.height = `${height}px`;
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', abort); window.removeEventListener('keydown', key);
      window.removeEventListener('blur', abort); cancel = () => {};
    };
    const abort = () => { cleanup(); render(); };
    const key = (next: KeyboardEvent) => { if (next.key === 'Escape') abort(); };
    const finish = (next: PointerEvent) => {
      if (next.pointerId !== event.pointerId) return;
      cleanup();
      const at = getPos();
      if (editor.isEditable && at !== undefined && (width !== Math.round(rect.width) || height !== Math.round(rect.height))) {
        editor.view.dispatch(closeHistory(editor.state.tr).setNodeMarkup(at, undefined, { ...current.attrs, displaySize: { width, height } }));
        editor.view.dispatch(closeHistory(editor.state.tr));
      }
      render(); editor.view.focus();
    };
    cancel = abort;
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', abort); window.addEventListener('keydown', key);
    window.addEventListener('blur', abort);
  };
  return {
    dom, contentDOM,
    update(next) { if (next.type !== current.type) return false; current = next; render(); return true; },
    stopEvent: event => event.target instanceof Element && !!event.target.closest('.table-resize-handle'),
    ignoreMutation: mutation => mutation.type !== 'selection' && (mutation.target === dom || mutation.target === table || handle.contains(mutation.target)),
    destroy: () => cancel(),
  };
};
