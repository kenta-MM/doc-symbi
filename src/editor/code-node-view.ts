import type { NodeViewRenderer } from '@tiptap/core';
import { closeHistory } from './history';

export const codeNodeView: NodeViewRenderer = ({ node, editor, getPos }) => {
  let current = node;
  const dom = document.createElement('div');
  dom.className = 'code-resize-frame';
  const pre = document.createElement('pre');
  const contentDOM = document.createElement('code');
  const handle = document.createElement('button');
  handle.type = 'button'; handle.contentEditable = 'false';
  handle.className = 'code-resize-handle';
  handle.setAttribute('aria-label', 'コードブロックの幅を変更');
  handle.title = '左右にドラッグして幅を変更（矢印キーでも調整できます）';
  pre.append(contentDOM); dom.append(pre, handle);
  const render = () => {
    dom.style.width = current.attrs.width ? `${current.attrs.width}px` : '';
    pre.dataset.language = String(current.attrs.language ?? 'text');
  };
  const commit = (width: number) => {
    const at = getPos();
    if (!editor.isEditable || at === undefined) { render(); return; }
    editor.view.dispatch(closeHistory(editor.state.tr).setNodeMarkup(at, undefined, { ...current.attrs, width }));
    editor.view.dispatch(closeHistory(editor.state.tr));
  };
  const clamp = (width: number) => Math.round(Math.max(120, Math.min(20000, width)));
  render();
  let cancel = () => {};
  handle.onkeydown = event => {
    if (!editor.isEditable || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    commit(clamp(dom.getBoundingClientRect().width + (event.key === 'ArrowLeft' ? -20 : 20)));
  };
  handle.onpointerdown = event => {
    if (!editor.isEditable || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); cancel();
    const initial = dom.getBoundingClientRect().width;
    let width = Math.round(initial);
    const move = (next: PointerEvent) => {
      if (next.pointerId !== event.pointerId) return;
      width = clamp(initial + next.clientX - event.clientX);
      dom.style.width = `${width}px`;
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
      if (width !== Math.round(initial)) commit(width);
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
    stopEvent: event => event.target instanceof Element && !!event.target.closest('.code-resize-handle'),
    ignoreMutation: mutation => mutation.type !== 'selection' && (mutation.target === dom || mutation.target === pre || handle.contains(mutation.target)),
    destroy: () => cancel(),
  };
};
