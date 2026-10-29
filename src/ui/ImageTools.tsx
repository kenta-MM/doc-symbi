import { useEffect, useRef, useState } from 'react';
import type { ImageBlock } from '../domain/schema';
import { emptyImageSemantics, imageByteLimit, imageFileSchema } from '../domain/image';
import { ImageInformation } from './ImageInformation';

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
  const [pending, setPending] = useState<ImageBlock | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <><button disabled={busy} onClick={() => input.current?.click()}>{busy ? '画像を読み込み中…' : '画像を添付'}</button>
    <input hidden ref={input} type="file" aria-label="画像ファイル" accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg" onChange={event => {
      const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
      setBusy(true); setError('');
      void readImage(file, newId()).then(image => {
        if (alive.current) setPending({ kind: 'image', id: newId(), metadata: {}, file: image, caption: file.name, alt: '', semantics: emptyImageSemantics() });
      }).catch(error => { if (alive.current) setError(error instanceof Error ? error.message : '画像を添付できません'); })
        .finally(() => { if (alive.current) setBusy(false); });
    }} />{error && <span role="alert">{error}</span>}{pending && <ImageInformation block={pending} close={() => setPending(null)} apply={block => { insert(block); setPending(null); }} />}</>;
}
