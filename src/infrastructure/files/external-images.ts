import { z } from 'zod';
import { documentSchema, paragraphSchema, headingSchema, codeSchema, listSchema, tableSchema, quizSchema, imageSchema, type Document } from '../../domain/schema';
import { imageFileSchema, imageSemanticsSchema } from '../../domain/image';
import { serialize, deserialize } from '../../domain/codec';
import { limits, validateDocument } from '../../domain/validate';
import { utf8Length } from '../../domain/text';
import type { Directory } from './directory-operations';

export const assetDirectory = '_docsymbi-assets';
const imageReference = z.strictObject({ kind: z.literal('image'), id: imageSchema.shape.id,
  metadata: imageSchema.shape.metadata, assetRef: z.string(), displaySize: imageSchema.shape.displaySize });
const diskSchema = z.strictObject({ ...documentSchema.shape, schemaVersion: z.literal(5),
  bodySchemaVersion: documentSchema.shape.schemaVersion,
  blocks: z.array(z.discriminatedUnion('kind', [paragraphSchema, headingSchema, codeSchema, listSchema, tableSchema, quizSchema, imageReference])).min(1),
});
const sidecarSchema = z.strictObject({ format: z.literal('docsymbi-image'), schemaVersion: z.literal(1),
  documentId: z.uuid(), blockId: z.uuid(), caption: imageSchema.shape.caption, alt: imageSchema.shape.alt,
  semantics: imageSemanticsSchema,
  file: z.strictObject({ id: imageFileSchema.shape.id, fileName: imageFileSchema.shape.fileName,
    mimeType: imageFileSchema.shape.mimeType, byteLength: imageFileSchema.shape.byteLength,
    width: imageFileSchema.shape.width, height: imageFileSchema.shape.height, path: z.string() }),
});
const extensions = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' } as const;
export interface AssetFile { path: string; data: string | Uint8Array<ArrayBuffer> }
export interface DiskDocument { text: string; assets: AssetFile[] }
export interface LoadedDiskDocument { document: Document; revisionSource: string; assets: string[] }

async function digest(data: string | Uint8Array<ArrayBuffer>): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('');
}
function decode(data: string): Uint8Array<ArrayBuffer> { return Uint8Array.from(atob(data), character => character.charCodeAt(0)); }
function encode(bytes: Uint8Array): string {
  let binary = '';
  for (let start = 0; start < bytes.length; start += 32768) binary += String.fromCharCode(...bytes.subarray(start, start + 32768));
  return btoa(binary);
}
function checkedReference(path: string, documentId: string, blockId: string): string[] {
  const parts = path.split('/');
  if (parts.length !== 4 || parts[0] !== assetDirectory || parts[1] !== documentId || parts[2] !== blockId
    || !/^[a-f0-9]{64}\.json$/.test(parts[3]!)) throw new Error('画像情報の参照先が文書専用フォルダーの外にあります');
  return parts;
}
async function parent(root: Directory, path: string, create = false): Promise<{ directory: Directory; name: string }> {
  const parts = path.split('/');
  const name = parts.pop()!;
  let directory = root;
  for (const part of parts) directory = await directory.getDirectoryHandle(part, { create }) as Directory;
  return { directory, name };
}
async function read(root: Directory, path: string, max?: number): Promise<Uint8Array<ArrayBuffer>> {
  try {
    const { directory, name } = await parent(root, path);
    const file = await (await directory.getFileHandle(name)).getFile();
    if (max !== undefined && file.size > max) throw new Error('ファイル容量の上限を超えています');
    return new Uint8Array(await file.arrayBuffer());
  } catch (error) { throw new Error(`画像の関連ファイルを読み込めません: ${path} (${error instanceof Error ? error.message : String(error)})`, { cause: error }); }
}

/** Disk v5 is a storage format; the editor receives a hydrated v1-v4 document. */
export async function readDiskDocument(root: Directory, text: string): Promise<LoadedDiskDocument> {
  const input: unknown = JSON.parse(text);
  if (!input || typeof input !== 'object' || !('schemaVersion' in input) || input.schemaVersion !== 5)
    return { document: deserialize(text), revisionSource: text, assets: [] };
  if (utf8Length(text) > limits.fileBytes) throw new Error('文書JSONは10 MiB以内にしてください');
  const disk = diskSchema.parse(input);
  const blocks: Document['blocks'] = [];
  const fingerprints: string[] = [], assets: string[] = [];
  for (const block of disk.blocks) {
    if (block.kind !== 'image') { blocks.push(block); continue; }
    const parts = checkedReference(block.assetRef, disk.id, block.id);
    const raw = await read(root, block.assetRef, limits.fileBytes);
    const sidecar = sidecarSchema.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)));
    if (sidecar.documentId !== disk.id || sidecar.blockId !== block.id) throw new Error(`画像情報の所有文書・画像IDが一致しません: ${block.assetRef}`);
    const expectedName = parts[3]!.replace(/\.json$/, `.${extensions[sidecar.file.mimeType]}`);
    const { path, ...file } = sidecar.file;
    if (path !== expectedName) throw new Error(`画像ファイルの相対パスが不正です: ${block.assetRef}`);
    const filePath = [...parts.slice(0, -1), expectedName].join('/');
    const bytes = await read(root, filePath);
    blocks.push({ kind: 'image', id: block.id, metadata: block.metadata,
      ...(block.displaySize ? { displaySize: block.displaySize } : {}),
      caption: sidecar.caption, alt: sidecar.alt, semantics: sidecar.semantics, file: { ...file, data: encode(bytes) } });
    assets.push(block.assetRef, filePath);
    fingerprints.push(await digest(raw), await digest(bytes));
  }
  const { bodySchemaVersion, ...envelope } = disk;
  return { document: validateDocument({ ...envelope, schemaVersion: bodySchemaVersion, blocks }),
    revisionSource: JSON.stringify([text, ...fingerprints]), assets };
}

export async function prepareDiskDocument(input: Document): Promise<DiskDocument> {
  const document = validateDocument(input);
  if (!document.blocks.some(block => block.kind === 'image')) return { text: serialize(document), assets: [] };
  const blocks: z.infer<typeof diskSchema>['blocks'] = [], assets: AssetFile[] = [];
  for (const block of document.blocks) {
    if (block.kind !== 'image') { blocks.push(block); continue; }
    // No cross-document or cross-block sharing. Content hashes only avoid
    // rewriting the same image on every text-only save, and stage edits safely.
    const { data, ...file } = block.file;
    const key = await digest(JSON.stringify([file, data, block.caption, block.alt, block.semantics]));
    const base = `${assetDirectory}/${document.id}/${block.id}`;
    const imageName = `${key}.${extensions[file.mimeType]}`;
    const assetRef = `${base}/${key}.json`;
    const sidecar = sidecarSchema.parse({ format: 'docsymbi-image', schemaVersion: 1,
      documentId: document.id, blockId: block.id, file: { ...file, path: imageName },
      caption: block.caption, alt: block.alt, semantics: block.semantics });
    assets.push({ path: `${base}/${imageName}`, data: decode(data) }, { path: assetRef, data: JSON.stringify(sidecar) });
    blocks.push({ kind: 'image', id: block.id, metadata: block.metadata, assetRef,
      ...(block.displaySize ? { displaySize: block.displaySize } : {}) });
  }
  const text = JSON.stringify(diskSchema.parse({ ...document, schemaVersion: 5, bodySchemaVersion: document.schemaVersion, blocks }));
  if (utf8Length(text) > limits.fileBytes) throw new Error('文書JSONは10 MiB以内にしてください');
  return { text, assets };
}

export async function removeAssetFiles(root: Directory, paths: string[]): Promise<void> {
  for (const path of paths) {
    const { directory, name } = await parent(root, path);
    await directory.removeEntry(name);
    const parts = path.split('/'); parts.pop();
    while (parts.length) {
      try {
        const target = await parent(root, parts.join('/'));
        await target.directory.removeEntry(target.name); // Empty directories only.
      } catch (error) {
        if (error instanceof DOMException && error.name === 'InvalidModificationError') break;
        if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error;
      }
      parts.pop();
    }
  }
}

export async function readAssetFiles(root: Directory, paths: string[]): Promise<AssetFile[]> {
  const files: AssetFile[] = [];
  for (const path of paths) files.push({ path, data: await read(root, path, path.endsWith('.json') ? limits.fileBytes : undefined) });
  return files;
}

/** Commit the main JSON only after all new assets have been written and checked. */
export async function stageAssets(root: Directory, assets: AssetFile[]): Promise<() => Promise<void>> {
  const created: string[] = [];
  const rollback = async () => { for (const path of created) await removeAssetFiles(root, [path]).catch(() => undefined); };
  try {
    for (const asset of assets) {
      const { directory, name } = await parent(root, asset.path, true);
      try {
        const existing = await directory.getFileHandle(name);
        const content = new Uint8Array(await (await existing.getFile()).arrayBuffer());
        if (await digest(content) !== await digest(asset.data)) throw new Error(`画像の関連ファイルが外部で変更されています: ${asset.path}`);
        continue;
      } catch (error) { if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error; }
      const handle = await directory.getFileHandle(name, { create: true });
      created.push(asset.path);
      const stream = await handle.createWritable();
      try { await stream.write(asset.data); await stream.close(); }
      catch (error) { await stream.abort().catch(() => undefined); throw error; }
      if (await digest(new Uint8Array(await (await handle.getFile()).arrayBuffer())) !== await digest(asset.data)) throw new Error(`画像の保存結果を確認できません: ${asset.path}`);
    }
    return rollback;
  } catch (error) { await rollback(); throw error; }
}

export async function removeDocumentAssets(root: Directory, id: string): Promise<void> {
  z.uuid().parse(id);
  let directory: FileSystemDirectoryHandle;
  try { directory = await root.getDirectoryHandle(assetDirectory); }
  catch (error) { if (error instanceof DOMException && error.name === 'NotFoundError') return; throw error; }
  try { await directory.removeEntry(id, { recursive: true }); }
  catch (error) { if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error; }
  try { await root.removeEntry(assetDirectory); }
  catch (error) { if (!(error instanceof DOMException && ['InvalidModificationError', 'NotFoundError'].includes(error.name))) throw error; }
}
