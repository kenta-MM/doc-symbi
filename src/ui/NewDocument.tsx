import { useState } from 'react';
import { documentStatuses, documentTypes } from '../domain/catalog';
import type { DocumentSummary } from '../application/ports/document-repository';

export interface NewDocumentValues { title: string; type: string; folder: string; tags: string[]; status: string; templateId: string }
export function NewDocument({ folders, folder, templates, create, cancel }: { folders: string[]; folder: string; templates: DocumentSummary[]; create: (values: NewDocumentValues) => Promise<void>; cancel: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [type, setType] = useState('document');
  const [tags, setTags] = useState('');
  const selected = templates.find(template => template.id === templateId);
  return <section className="new-document"><h2>新規ドキュメント作成</h2><form onSubmit={event => {
    event.preventDefault(); const data = new FormData(event.currentTarget); setBusy(true); setError('');
    void create({ title: String(data.get('title')).trim(), type, folder: String(data.get('folder')), status: String(data.get('status')), tags: [...new Set(tags.split(/[,、]/).map(tag => tag.trim()).filter(Boolean))], templateId: type === 'template' ? '' : templateId }).catch(error => setError(error instanceof Error ? error.message : '作成できません')).finally(() => setBusy(false));
  }}><fieldset disabled={busy}><div className="creation-columns"><div><h3>基本情報</h3>
    <label>ドキュメント名<input name="title" aria-label="新しいドキュメント名" defaultValue="無題の文書" required pattern=".*\S.*" autoFocus /></label>
    <label>ドキュメント種類<select name="type" aria-label="ドキュメント種類" value={type} onChange={event => { setType(event.target.value); if (event.target.value === 'template') setTemplateId(''); }}>{Object.entries(documentTypes).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
    <label>保存先フォルダ<select aria-label="保存先フォルダ" name="folder" defaultValue={folder}>{folders.map(path => <option key={path} value={path}>{path || 'ルート（現在の保存先）'}</option>)}</select></label>
    <label>タグ<input name="tags" value={tags} onChange={event => setTags(event.target.value)} placeholder="認証, API（カンマ区切り）" /></label>
    <label>ステータス<select aria-label="ステータス" name="status" defaultValue="draft">{Object.entries(documentStatuses).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
    </div><div><h3>テンプレート</h3>
    <label>使用するテンプレート<select aria-label="使用するテンプレート" disabled={type === 'template'} value={templateId} onChange={event => {
      const id = event.target.value; setTemplateId(id);
      const template = templates.find(item => item.id === id);
      setTags((template?.tags ?? []).join(', '));
    }}><option value="">空のドキュメント</option>{templates.map(template => <option key={template.id} value={template.id}>{template.title}{template.folderPath ? `（${template.folderPath}）` : ''}</option>)}</select></label>
    <div className="template-card"><strong>{selected?.title ?? '空のドキュメント'}</strong><p>{selected ? (selected.searchText?.slice(0, 500) || '本文なし') : '自由な構成でドキュメントを作成します。'}</p></div>
    {type === 'template' && <p className="muted">テンプレートは空の本文から作成します。保存後、新規ドキュメントのひな形として選べます。</p>}<p className="muted">文書を開いて「テンプレートとして保存」でひな形を追加できます。本文・画像・表などをコピーして、新しい文書を作成します。</p></div></div>
    {error && <p role="alert">{error}</p>}<div className="creation-actions"><button type="button" onClick={cancel}>キャンセル</button><button className="primary" type="submit">{busy ? '作成中…' : '作成して編集を開始'}</button></div></fieldset></form></section>;
}
