import { useRef } from 'react';
import type { DocumentSession } from '../application/document-session';
import { exportDocument, importDocument, updateDocumentFromFile } from '../application/document-transfer';
import { limits } from '../domain/validate';
export function FileTransfer({ session, navigate, refreshed, report, editable, loaded }: {
  editable: boolean; loaded: () => void; session: DocumentSession; navigate: (action: () => void | Promise<void>) => void;
  refreshed: () => Promise<void>; report: (error: unknown) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const updating = useRef(false);
  function download() {
    try {
      const document = session.state.document; if (!document) return;
      const url = URL.createObjectURL(new Blob([exportDocument(document)], { type: 'application/json;charset=utf-8' }));
      const anchor = window.document.createElement('a'); anchor.href = url;
      anchor.download = `${document.id}.docsymbi.json`;
      anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { report(error); }
  }
  return <div className="transfer-tools"><button disabled={!session.state.document} onClick={download}>文書を取り出す</button>
    <button onClick={() => { updating.current = false; input.current?.click(); }}>文書を読み込む</button>
    <button disabled={!editable || !session.state.document || session.state.baseRevision === null} onClick={() => { updating.current = true; input.current?.click(); }}>現在の文書をファイルで更新</button>
    <input ref={input} type="file" hidden aria-label="文書を読み込む" accept=".json,.docsymbi.json,application/json" onChange={event => {
      const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
      const update = updating.current;
      navigate(async () => {
        try {
          const initial = session.state;
          if (file.size > limits.fileBytes) throw new Error('ファイルは 10 MiB 以内にしてください');
          const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
          if (session.state !== initial) throw new Error('文書が変更されたため読み込みを中止しました。もう一度選択してください');
          const stored = update && initial.document && initial.baseRevision !== null
            ? await updateDocumentFromFile(text, session.repository, initial.document.id, initial.baseRevision)
            : await importDocument(text, session.repository);
          session.close(); await session.load(stored.document.id); loaded(); await refreshed();
        } catch (error) { report(error); }
      });
    }} />
  </div>;
}
