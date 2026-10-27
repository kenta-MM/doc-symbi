import { useEffect, useRef, useState } from 'react';
import type { ImageBlock } from '../domain/schema';
import { emptyImageSemantics, imageByteLimit, imageFileSchema, imageSemanticsSchema, imageSource } from '../domain/image';
import type { EditorCommand } from '../domain/commands';

async function readImage(file: File, id: string) {
  if (!file.size || file.size > imageByteLimit) throw new Error('画像は 3 MiB 以内にしてください');
  const mimeType = file.type || (file.name.toLowerCase().endsWith('.svg') ? 'image/svg+xml' : '');
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(mimeType)) throw new Error('PNG・JPEG・WebP・SVG を選んでください');
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onerror = () => reject(new Error('画像を読み取れません')); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(file);
  });
  const data = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const image = new Image();
  image.src = `data:${mimeType};base64,${data}`;
  try { await image.decode(); } catch { throw new Error('有効な画像として表示できません'); }
  return imageFileSchema.parse({ id, fileName: file.name, mimeType, byteLength: file.size, width: image.naturalWidth, height: image.naturalHeight, data });
}

export function ImageAttachment({ insert, newId }: { insert: (block: ImageBlock) => void; newId: () => string }) {
  const input = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <><button disabled={busy} onClick={() => input.current?.click()}>{busy ? '画像を読み込み中…' : '画像を添付'}</button>
    <input hidden ref={input} type="file" aria-label="画像ファイル" accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg" onChange={event => {
      const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
      setBusy(true); setError('');
      void readImage(file, newId()).then(image => {
        if (alive.current) insert({ kind: 'image', id: newId(), metadata: {}, file: image, caption: file.name, alt: '', semantics: emptyImageSemantics() });
      }).catch(error => { if (alive.current) setError(error instanceof Error ? error.message : '画像を添付できません'); })
        .finally(() => { if (alive.current) setBusy(false); });
    }} />{error && <span role="alert">{error}</span>}</>;
}

export function ImageInformation({ block, execute }: { block: ImageBlock; execute: (command: EditorCommand) => void }) {
  const [caption, setCaption] = useState(block.caption);
  const [alt, setAlt] = useState(block.alt);
  const [json, setJson] = useState(JSON.stringify(block.semantics, null, 2));
  const [error, setError] = useState('');
  useEffect(() => { setCaption(block.caption); setAlt(block.alt); setJson(JSON.stringify(block.semantics, null, 2)); setError(''); }, [block]);
  return <section className="image-information" aria-label="画像の情報">
    <p>{block.file.fileName} · {block.file.mimeType} · {block.file.width} × {block.file.height} · {Math.ceil(block.file.byteLength / 1024)} KiB</p>
    <label>キャプション<input value={caption} onChange={event => setCaption(event.target.value)} /></label>
    <label>代替テキスト<input value={alt} onChange={event => setAlt(event.target.value)} /></label>
    <details><summary>AI向け構造化データ</summary>
      <p>purpose：目的 / summary：要約 / entities：構成要素（id・label・role） / relationships：関係（from・to・meaning） / readingOrder：要素IDの読み順 / assumptions：前提・省略 / sources：出典（title・url・accessedAt）。空欄は未記述です。添付内容を自動推測して埋めることはありません。</p>
      <textarea aria-label="AI向け構造化データ JSON" spellCheck={false} rows={16} value={json} onChange={event => setJson(event.target.value)} />
    </details>
    <button onClick={() => {
      try {
        const semantics = imageSemanticsSchema.parse(JSON.parse(json));
        execute({ type: 'describeImage', id: block.id, caption, alt, semantics }); setError('');
      } catch (error) { setError(error instanceof Error ? error.message : '情報データを確認してください'); }
    }}>画像情報を適用</button>
    <button onClick={() => { const link = window.document.createElement('a'); link.href = imageSource(block.file); link.download = block.file.fileName; link.click(); }}>画像を取り出す</button>
    {error && <p role="alert">{error}</p>}
    <p>適用後は文書を保存してください。画像情報も元に戻す／やり直すの対象です。</p>
  </section>;
}
