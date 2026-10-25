import { useRef } from 'react';
import type { DocumentSession } from '../application/document-session';
import { exportDocument, importDocument } from '../application/document-transfer';
import { limits } from '../domain/validate';
export function FileTransfer({ session, navigate, refreshed, report }: {
  session: DocumentSession; navigate: (action: () => void | Promise<void>) => void;
  refreshed: () => Promise<void>; report: (error: unknown) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
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
    <button onClick={() => input.current?.click()}>文書を読み込む</button>
    <input ref={input} type="file" hidden aria-label="文書を読み込む" accept=".json,.docsymbi.json,application/json" onChange={event => {
      const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
      navigate(async () => {
        try {
          if (file.size > limits.fileBytes) throw new Error('ファイルは 10 MiB 以内にしてください');
          const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
          const stored = await importDocument(text, session.repository); await session.load(stored.document.id); await refreshed();
        } catch (error) { report(error); }
      });
    }} />
  </div>;
}
