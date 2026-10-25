import type { DocumentSummary } from '../application/ports/document-repository';
export function DocumentList({ documents, activeId, open }: { documents: DocumentSummary[]; activeId: string | undefined; open: (id: string) => void }) {
  return <aside className="document-sidebar"><h2>文書</h2><p className="muted">このブラウザに保存</p>
    {documents.length === 0 && <p className="empty-note">保存した文書がここに並びます。</p>}
    {documents.map(document => <button className={`document-link ${activeId === document.id ? 'active' : ''}`} key={document.id} onClick={() => open(document.id)}><strong>{document.title}</strong><small>{new Date(document.updatedAt).toLocaleString('ja-JP')} · {document.id.slice(0, 8)}</small></button>)}
  </aside>;
}
