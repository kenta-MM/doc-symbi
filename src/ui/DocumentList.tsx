import { useState } from 'react';
import type { DocumentSummary } from '../application/ports/document-repository';
import { Icon } from './Icon';
export function DocumentList({ documents, activeId, open, storageLabel }: { documents: DocumentSummary[]; activeId: string | undefined; open: (id: string) => void; storageLabel: string }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const visible = documents.filter(document => document.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort((a, b) =>
    sort === 'title' ? a.title.localeCompare(b.title, 'ja') : sort === 'oldest' ? a.updatedAt.localeCompare(b.updatedAt) : b.updatedAt.localeCompare(a.updatedAt));
  return <aside className="document-sidebar"><h2>文書</h2><p className="sr-only">{storageLabel}</p>
    <label className="document-search"><Icon name="search" /><input type="search" aria-label="文書を検索" placeholder="文書を検索…" value={query} onChange={event => setQuery(event.target.value)} /></label>
    <div className="document-sort"><select aria-label="文書の並び順" value={sort} onChange={event => setSort(event.target.value)}><option value="newest">更新日時（新しい順）</option><option value="oldest">更新日時（古い順）</option><option value="title">文書名順</option></select><span>{visible.length}件</span></div>
    {documents.length === 0 && <p className="empty-note">保存した文書がここに並びます。</p>}
    {documents.length > 0 && visible.length === 0 && <p className="empty-note">一致する文書はありません。</p>}
    {visible.map(document => <button className={`document-link ${activeId === document.id ? 'active' : ''}`} aria-current={activeId === document.id ? 'page' : undefined} key={document.id} onClick={() => open(document.id)}><strong>{document.title}</strong><small>{new Date(document.updatedAt).toLocaleString('ja-JP')} · {document.id.slice(0, 8)}</small></button>)}
  </aside>;
}
