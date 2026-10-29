import type { Document } from '../domain/schema';
import { documentProperties, documentTypes, documentStatuses } from '../domain/catalog';

export function DocumentProperties({ document, folder, editable, change }: { document: Document; folder: string; editable: boolean; change: (values: { type?: string; status?: string; tags?: string[] }) => void }) {
  const properties = documentProperties(document);
  return <aside className="document-properties" aria-label="ドキュメント情報"><h2>ドキュメント情報</h2>
    <label>種類<select aria-label="ドキュメント種類" disabled={!editable} value={properties.type} onChange={event => change({ type: event.target.value })}>
      {!Object.hasOwn(documentTypes, properties.type) && <option>{properties.type}</option>}{Object.entries(documentTypes).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
    <label>フォルダ<span className="property-value">{folder || 'ルート'}</span></label>
    <label>タグ{editable ? <input aria-label="ドキュメントのタグ" defaultValue={properties.tags.join(', ')} key={document.id} placeholder="カンマ区切り" onChange={event => change({ tags: [...new Set(event.target.value.split(/[,、]/).map(tag => tag.trim()).filter(Boolean))] })} /> : <span className="property-value">{properties.tags.length ? properties.tags.map(tag => <span className="tag" key={tag}>{tag}</span>) : '未設定'}</span>}</label>
    <label>ステータス<select aria-label="ドキュメントのステータス" disabled={!editable} value={properties.status} onChange={event => change({ status: event.target.value })}>{!Object.hasOwn(documentStatuses, properties.status) && <option>{properties.status}</option>}{Object.entries(documentStatuses).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
    <label>更新日時<span className="property-value">{new Date(document.updatedAt).toLocaleString('ja-JP')}</span></label>
    <label>作成日時<span className="property-value">{new Date(document.createdAt).toLocaleString('ja-JP')}</span></label>
  </aside>;
}
