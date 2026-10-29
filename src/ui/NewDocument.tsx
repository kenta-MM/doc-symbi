import { useState } from 'react';
import { documentStatuses, documentTypes } from '../domain/catalog';

// Registry permits adding templates without changing the creation workflow.
export const documentTemplates = [{ id: 'empty', title: '空のドキュメント', description: '自由な構成でドキュメントを作成します。' }] as const;
export interface NewDocumentValues { title: string; type: string; folder: string; tags: string[]; status: string }
export function NewDocument({ folders, folder, create, cancel }: { folders: string[]; folder: string; create: (values: NewDocumentValues) => Promise<void>; cancel: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <section className="new-document"><h2>新規ドキュメント作成</h2><form onSubmit={event => {
    event.preventDefault(); const data = new FormData(event.currentTarget); setBusy(true); setError('');
    void create({ title: String(data.get('title')).trim(), type: String(data.get('type')), folder: String(data.get('folder')), status: String(data.get('status')), tags: [...new Set(String(data.get('tags')).split(/[,、]/).map(tag => tag.trim()).filter(Boolean))] }).catch(error => setError(error instanceof Error ? error.message : '作成できません')).finally(() => setBusy(false));
  }}><fieldset disabled={busy}><div className="creation-columns"><div><h3>基本情報</h3>
    <label>ドキュメント名<input name="title" aria-label="新しいドキュメント名" defaultValue="無題の文書" required pattern=".*\S.*" autoFocus /></label>
    <label>ドキュメント種類<select name="type" aria-label="ドキュメント種類">{Object.entries(documentTypes).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
    <label>保存先フォルダ<select aria-label="保存先フォルダ" name="folder" defaultValue={folder}>{folders.map(path => <option key={path} value={path}>{path || 'ルート（現在の保存先）'}</option>)}</select></label>
    <label>タグ<input name="tags" placeholder="認証, API（カンマ区切り）" /></label>
    <label>ステータス<select aria-label="ステータス" name="status" defaultValue="draft">{Object.entries(documentStatuses).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
    </div><div><h3>テンプレート</h3>{documentTemplates.map(template => <div className="template-card" key={template.id}><strong>✓ {template.title}</strong><p>{template.description}</p></div>)}<p className="muted">種類を選んで、本文の構成は編集画面で作成できます。</p></div></div>
    {error && <p role="alert">{error}</p>}<div className="creation-actions"><button type="button" onClick={cancel}>キャンセル</button><button className="primary" type="submit">{busy ? '作成中…' : '作成して編集を開始'}</button></div></fieldset></form></section>;
}
