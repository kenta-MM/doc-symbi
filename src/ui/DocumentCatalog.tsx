import { creationEvents, type OpenCreationMenu } from './CreationMenu';
import { useState } from 'react';
import type { DocumentSummary } from '../application/ports/document-repository';
import { documentTypes, folderContains } from '../domain/catalog';

export function DocumentCatalog({ documents, folders, folder, selectFolder, selectedId, select, open, tagFilter, setTagFilter, menu, rootName }: {
  menu: OpenCreationMenu; rootName: string;
  documents: DocumentSummary[]; folders: string[]; folder: string; selectFolder: (path: string) => void;
  selectedId: string | null; select: (id: string) => void;
  open: (id: string) => void; tagFilter: string; setTagFilter: (tag: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('all');
  const [type, setType] = useState('');
  const [sort, setSort] = useState('updated');
  const [recursive, setRecursive] = useState(true);
  const tags = [...new Set(documents.flatMap(row => row.tags ?? []))].sort();
  const normalized = query.trim().toLocaleLowerCase();
  // A trailing slash denotes an exact root-relative folder path, never a basename.
  const pathQuery = normalized.endsWith('/') ? query.trim().replace(/^\//, '').slice(0, -1) : null;
  const visible = documents.filter(row => folderContains(folder, row.folderPath ?? '', recursive)
    && (!type || (row.type ?? 'document') === type) && (!tagFilter || row.tags?.includes(tagFilter))
    && (pathQuery !== null ? folderContains(pathQuery, row.folderPath ?? '')
      : `${scope !== 'body' ? row.title : ''}\n${scope !== 'title' ? row.searchText ?? '' : ''}`.toLocaleLowerCase().includes(normalized)))
    .sort((a, b) => (sort === 'title' ? a.title.localeCompare(b.title, 'ja')
      : sort === 'created' ? (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
      : sort === 'oldest' ? a.updatedAt.localeCompare(b.updatedAt) : b.updatedAt.localeCompare(a.updatedAt)) || a.id.localeCompare(b.id));
  const searching = !!(normalized || type || tagFilter);
  const destinations = [...new Set(visible.map(row => row.folderPath ?? ''))];
  const destination = searching && recursive ? (destinations.length === 1 ? destinations[0]! : null) : folder;
  return <section className="catalog" aria-label="ドキュメント一覧">
    <h2>ドキュメント</h2>
    <div className="catalog-search"><input id="catalog-search" type="search" aria-label="文書を検索" placeholder="タイトル・本文を検索、またはルートからのフォルダパス/" value={query} onChange={event => setQuery(event.target.value)} />
      <select aria-label="検索対象" value={scope} onChange={event => setScope(event.target.value)}><option value="all">タイトル・本文</option><option value="title">タイトル</option><option value="body">本文</option></select></div>
    <div className="catalog-filters">
      <select aria-label="フォルダで絞り込み" value={folder} onChange={event => selectFolder(event.target.value)}>{folders.map(path => <option key={path} value={path}>{path || rootName}</option>)}</select>
      <label><input type="checkbox" checked={recursive} onChange={event => setRecursive(event.target.checked)} />子孫フォルダを含む</label>
      <select aria-label="種類で絞り込み" value={type} onChange={event => setType(event.target.value)}><option value="">すべての種類</option>{Object.entries(documentTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <select id="catalog-tags" aria-label="タグで絞り込み" value={tagFilter} onChange={event => setTagFilter(event.target.value)}><option value="">すべてのタグ</option>{tags.map(tag => <option key={tag}>{tag}</option>)}</select>
      <select aria-label="文書の並び順" value={sort} onChange={event => setSort(event.target.value)}><option value="updated">更新日時（新しい順）</option><option value="oldest">更新日時（古い順）</option><option value="created">作成日時（新しい順）</option><option value="title">文書名順</option></select>
    </div>
    <p className="catalog-count" aria-live="polite">検索結果: {visible.length} 件 {folder && ` · ${folder}/`}</p>
    {pathQuery !== null && <p className="muted">保存先ルートからのパス「{pathQuery}/」配下を検索しています。</p>}
    <div className="catalog-table" tabIndex={0} {...creationEvents(menu, destination, 'ドキュメント一覧の空白')}><table><thead><tr><th>タイトル</th><th>種類</th><th>フォルダ</th><th>タグ</th><th>更新日時</th></tr></thead><tbody>
      {visible.map(row => <tr key={row.id} className={selectedId === row.id ? 'selected' : undefined} onClick={() => select(row.id)} onDoubleClick={() => open(row.id)} {...creationEvents(target => { select(row.id); menu(target); }, row.folderPath ?? '', row.title, 'file', row.id)}><td><button className="document-link" title={row.id} aria-pressed={selectedId === row.id} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); open(row.id); } }}>{row.title}</button></td><td><span className="type-badge">{documentTypes[row.type as keyof typeof documentTypes] ?? row.type ?? 'ドキュメント'}</span></td><td>{row.folderPath || 'ルート'}</td><td>{row.tags?.map(tag => <span className="tag" key={tag}>{tag}</span>)}</td><td><time dateTime={row.updatedAt}>{new Date(row.updatedAt).toLocaleString('ja-JP')}</time></td></tr>)}
    </tbody></table>
    {!visible.length && <p className="empty-note">{documents.length ? '一致する文書はありません。検索条件を変更してください。' : '保存した文書がここに並びます。「新規作成」から始めましょう。'}</p>}
  </div></section>;
}
