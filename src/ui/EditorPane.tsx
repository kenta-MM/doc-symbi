import { useEffect, useRef } from 'react';
import type { Document } from '../domain/schema';
import type { EditorPort } from '../application/ports/editor';

export function EditorPane({ document, createEditor, connect }: {
  document: Document; createEditor: (host: HTMLElement) => EditorPort; connect: (editor: EditorPort | null) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const initial = useRef(document); initial.current = document;
  useEffect(() => {
    if (!host.current) return;
    const editor = createEditor(host.current);
    editor.mount(initial.current); connect(editor);
    return () => { connect(null); editor.dispose(); };
  }, [document.id, createEditor, connect]);
  return <div className="editor-host" ref={host} />;
}
