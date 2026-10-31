import { useState } from 'react';
import type { ImageBlock } from '../domain/schema';
import { imageSemanticsSchema, imageSource, type ImageSemantics } from '../domain/image';
import { DocumentDialog } from './DocumentDialogs';

export function ImageInformation({ block, apply, close }: { block: ImageBlock; apply: (block: ImageBlock) => void; close: () => void }) {
  const [caption, setCaption] = useState(block.caption), [alt, setAlt] = useState(block.alt);
  const [semantics, setSemantics] = useState<ImageSemantics>(structuredClone(block.semantics));
  const [error, setError] = useState('');
  function field<K extends keyof ImageSemantics>(key: K, value: ImageSemantics[K]) { setSemantics(current => ({ ...current, [key]: value })); }
  return <DocumentDialog label="画像の詳細設定" close={close}><h2>画像の詳細設定</h2>
    <form className="image-information" onSubmit={event => { event.preventDefault(); try { apply({ ...block, caption, alt, semantics: imageSemanticsSchema.parse(semantics) }); } catch { setError('出典のURL・参照日、関係の構成要素などの入力を確認してください。'); } }}>
      <img className="image-preview" src={imageSource(block.file)} alt={alt} /><p>{block.file.fileName} · {block.file.width} × {block.file.height}</p>
      <label>キャプション<input autoFocus value={caption} onChange={event => setCaption(event.target.value)} /></label>
      <label>代替テキスト<input value={alt} onChange={event => setAlt(event.target.value)} /></label>
      <label>画像の目的<input value={semantics.purpose} onChange={event => field('purpose', event.target.value)} /></label>
      <label>画像の要約<textarea value={semantics.summary} onChange={event => field('summary', event.target.value)} /></label>
      <details><summary>構成要素・関係・出典</summary>
        <fieldset><legend>構成要素</legend>{semantics.entities.map((entity, index) => <div className="image-fields" key={entity.id}>
          {(['label', 'role'] as const).map(key => <label key={key}>{key === 'label' ? '名称' : '役割'}<input value={entity[key]} onChange={event => field('entities', semantics.entities.map((value, i) => i === index ? { ...value, [key]: event.target.value } : value))} /></label>)}
          <button className="danger" type="button" onClick={() => setSemantics(current => ({ ...current, entities: current.entities.filter(value => value.id !== entity.id), relationships: current.relationships.filter(value => value.from !== entity.id && value.to !== entity.id), readingOrder: current.readingOrder.filter(id => id !== entity.id) }))}>構成要素を削除</button>
        </div>)}<button type="button" onClick={() => field('entities', [...semantics.entities, { id: crypto.randomUUID(), label: '', role: '' }])}>構成要素を追加</button></fieldset>
        <fieldset><legend>関係</legend>{semantics.relationships.map((edge, index) => <div className="image-fields" key={index}>
          {(['from', 'to'] as const).map(key => <label key={key}>{key === 'from' ? '関係の始点' : '関係の終点'}<select value={edge[key]} onChange={event => field('relationships', semantics.relationships.map((value, i) => i === index ? { ...value, [key]: event.target.value } : value))}><option value="">選択してください</option>{semantics.entities.map(entity => <option key={entity.id} value={entity.id}>{entity.label || '名称未入力'}</option>)}</select></label>)}
          <label>関係の説明<input value={edge.meaning} onChange={event => field('relationships', semantics.relationships.map((value, i) => i === index ? { ...value, meaning: event.target.value } : value))} /></label>
          <button className="danger" type="button" onClick={() => field('relationships', semantics.relationships.filter((_, i) => i !== index))}>関係を削除</button>
        </div>)}<button type="button" disabled={!semantics.entities.length} onClick={() => field('relationships', [...semantics.relationships, { from: '', to: '', meaning: '' }])}>関係を追加</button></fieldset>
        <fieldset><legend>読み順</legend>{semantics.readingOrder.map((id, index) => <div key={index}><label>読む要素 {index + 1}<select value={id} onChange={event => field('readingOrder', semantics.readingOrder.map((value, i) => i === index ? event.target.value : value))}>{semantics.entities.map(entity => <option key={entity.id} value={entity.id}>{entity.label || '名称未入力'}</option>)}</select></label><button className="danger" type="button" onClick={() => field('readingOrder', semantics.readingOrder.filter((_, i) => i !== index))}>読み順から削除</button></div>)}<button type="button" disabled={!semantics.entities.length} onClick={() => field('readingOrder', [...semantics.readingOrder, semantics.entities[0]!.id])}>読み順を追加</button></fieldset>
        <label>前提・省略（1行に1件）<textarea value={semantics.assumptions.join('\n')} onChange={event => field('assumptions', event.target.value ? event.target.value.split('\n') : [])} /></label>
        <fieldset><legend>出典</legend>{semantics.sources.map((source, index) => <div className="image-fields" key={index}>
          {(['title', 'url', 'accessedAt'] as const).map(key => <label key={key}>{({ title: '出典名', url: '出典URL', accessedAt: '参照日' })[key]}<input type={key === 'accessedAt' ? 'date' : key === 'url' ? 'url' : 'text'} required={key !== 'title'} value={source[key]} onChange={event => field('sources', semantics.sources.map((value, i) => i === index ? { ...value, [key]: event.target.value } : value))} /></label>)}
          <button className="danger" type="button" onClick={() => field('sources', semantics.sources.filter((_, i) => i !== index))}>出典を削除</button>
        </div>)}<button type="button" onClick={() => field('sources', [...semantics.sources, { title: '', url: '', accessedAt: new Date().toISOString().slice(0, 10) }])}>出典を追加</button></fieldset>
      </details>{error && <p role="alert">{error}</p>}
      <div className="dialog-actions"><button type="submit" className="primary">画像情報を適用</button><button type="button" onClick={close}>キャンセル</button></div>
    </form></DocumentDialog>;
}
