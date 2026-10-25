import { useEffect } from 'react';
import type { EditorPort } from '../application/ports/editor';
export function HistoryToolbar({ editor }: { editor: EditorPort | null }) {
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || !(event.ctrlKey || event.metaKey)) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const pressed = event.key.toLowerCase();
      if (pressed === 'z') { event.preventDefault(); if (event.shiftKey) editor?.redo(); else editor?.undo(); }
      if (pressed === 'y') { event.preventDefault(); editor?.redo(); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [editor]);
  return <div className="history-tools"><button disabled={!editor?.canUndo} onClick={() => editor?.undo()}>元に戻す</button><button disabled={!editor?.canRedo} onClick={() => editor?.redo()}>やり直す</button><span className="muted">Ctrl+S で保存</span></div>;
}
