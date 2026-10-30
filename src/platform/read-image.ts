import { imageByteLimit, imageFileSchema } from '../domain/image';

export async function readImage(file: File, id: string) {
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

