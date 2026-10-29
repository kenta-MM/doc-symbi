import { useEffect, useState } from 'react';
import type { EditorPort } from '../application/ports/editor';
export function HistoryToolbar({ editor }: { editor: EditorPort | null }) {
  const [message, setMessage] = useState('');
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || !(event.ctrlKey || event.metaKey)) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const pressed = event.key.toLowerCase();
      if (pressed !== 'z' && pressed !== 'y') return;
      event.preventDefault(); event.stopPropagation();
      const redo = pressed === 'y' || event.shiftKey;
      if (redo ? editor?.canRedo : editor?.canUndo) {
        setMessage(''); if (redo) editor?.redo(); else editor?.undo();
      } else setMessage(redo ? 'やり直せる編集はありません' : '取り消せる編集はありません');
    };
    const unsubscribe = editor?.onAcceptedChange(() => setMessage(''));
    window.addEventListener('keydown', key, true);
    return () => { window.removeEventListener('keydown', key, true); unsubscribe?.(); };
  }, [editor]);
  return message ? <div className="history-message muted" role="note" aria-live="polite">{message}</div> : null;
}
