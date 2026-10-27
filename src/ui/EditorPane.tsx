import { useEffect, useRef } from 'react';
import type { Document } from '../domain/schema';
import type { EditorPort } from '../application/ports/editor';

export function EditorPane({ document, editable, createEditor, connect }: {
  document: Document; editable: boolean; createEditor: (host: HTMLElement) => EditorPort; connect: (editor: EditorPort | null) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const initial = useRef(document); initial.current = document;
  const active = useRef<EditorPort | null>(null);
  const editing = useRef(editable); editing.current = editable;
  useEffect(() => {
    if (!host.current) return;
    const editor = createEditor(host.current);
    editor.mount(initial.current); editor.setEditable(editing.current); active.current = editor; connect(editor);
    return () => { active.current = null; connect(null); editor.dispose(); };
  }, [document.id, createEditor, connect]);
  useEffect(() => { active.current?.setEditable(editable); }, [editable]);
  return <div className={`editor-host${editable ? '' : ' view-mode'}`} ref={host} />;
}
