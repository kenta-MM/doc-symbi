import { readFileSync } from 'node:fs';
import { expect, test } from '../helpers/folder-page';
import type { Directory } from '../../src/infrastructure/files/directory-operations';
import type { Document } from '../../src/domain/schema';

const sample = JSON.parse(readFileSync('docs/azure-sql-hyperscale.docsymbi.json', 'utf8')) as Document;
const image = sample.blocks.find(block => block.kind === 'image')!;
const fixture = { ...sample, blocks: [image] };

test('image files and descriptions are document-owned and follow rename, move and deletion', async ({ page }) => {
  await page.goto('/tests/harness.html');
  const result = await page.evaluate(async json => {
    const input = JSON.parse(json) as Document;
    const repository = window.createFileRepositoryTest();
    const a = await repository.create(input as Document);
    const b = await repository.create({ ...input, id: crypto.randomUUID(), title: '別の文書' } as Document);
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('articles') as Directory;
    const manifests = [];
    for await (const handle of root.values()) if (handle.kind === 'file') manifests.push(JSON.parse(await (await handle.getFile()).text()));
    const refs = manifests.map(manifest => manifest.blocks[0].assetRef as string);
    const read = async (path: string, base: Directory = root) => {
      const parts = path.split('/'); const name = parts.pop()!;
      let dir = base; for (const part of parts) dir = await dir.getDirectoryHandle(part) as Directory;
      return (await dir.getFileHandle(name)).getFile();
    };
    const description = JSON.parse(await (await read(refs[0]!)).text());
    const imagePath = refs[0]!.replace(/[^/]+$/, description.file.path);
    const bytes = await (await read(imagePath)).arrayBuffer();
    const first = await repository.get(a.document.id);
    const renamed = await repository.rename({ ...a.document, title: '名前変更' }, a.revision);
    await repository.createFolder('移動先');
    await repository.move(a.document.id, '移動先', renamed.revision);
    await repository.renameFolder('移動先', '変更後');
    const moved = await repository.get(a.document.id);
    const folders = await repository.folders();
    await repository.delete(a.document.id, moved.revision);
    const remaining = await repository.get(b.document.id);
    let ownsDeleted = false;
    try { await (await (await root.getDirectoryHandle('変更後')).getDirectoryHandle('_docsymbi-assets')).getDirectoryHandle(a.document.id); }
    catch (error) { ownsDeleted = error instanceof DOMException && error.name === 'NotFoundError'; }
    return { refs, versions: manifests.map(value => value.schemaVersion), embedded: manifests.some(value => JSON.stringify(value).includes('"data":')),
      description, byteLength: bytes.byteLength, roundTrip: JSON.stringify(first.document) === JSON.stringify(a.document),
      moved: moved.document.title, revisionPreserved: moved.revision === renamed.revision,
      folders, ownsDeleted, remaining: JSON.stringify(remaining.document) === JSON.stringify(b.document) };
  }, JSON.stringify(fixture));
  expect(result.versions).toEqual([5, 5]);
  expect(result.embedded).toBe(false);
  expect(result.refs[0]).not.toBe(result.refs[1]);
  expect(result.description).toMatchObject({ format: 'docsymbi-image', caption: image.caption, semantics: image.semantics });
  expect(result.description.file).not.toHaveProperty('data');
  expect(result.byteLength).toBe(image.file.byteLength);
  expect(result.roundTrip).toBe(true); expect(result.remaining).toBe(true);
  expect(result.moved).toBe('名前変更'); expect(result.revisionPreserved).toBe(true);
  expect(result.folders).toEqual(['', '変更後']); expect(result.ownsDeleted).toBe(true);
});

test('legacy embedded files migrate on save and failed main writes retain the previous assets', async ({ page }) => {
  await page.goto('/tests/harness.html');
  const result = await page.evaluate(async json => {
    const input = JSON.parse(json) as Document;
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('articles') as Directory;
    const file = await root.getFileHandle('legacy.docsymbi.json', { create: true });
    const stream = await file.createWritable(); await stream.write(JSON.stringify(input)); await stream.close();
    const repository = window.createFileRepositoryTest();
    const old = await repository.get(input.id);
    const stored = await repository.save(old.document, old.revision);
    const originalText = await (await file.getFile()).text();
    const listFiles = async (dir: Directory): Promise<string[]> => {
      const result: string[] = [];
      for await (const child of dir.values()) {
        if (child.kind === 'file') result.push(child.name);
        else result.push(...(await listFiles(child as Directory)).map(name => `${child.name}/${name}`));
      }
      return result.sort();
    };
    const before = await listFiles(root);
    const changed = structuredClone(stored.document);
    if (changed.blocks[0]!.kind !== 'image') throw new Error('fixture');
    changed.blocks[0]!.caption = '保存に失敗する変更';
    const original = FileSystemFileHandle.prototype.createWritable;
    FileSystemFileHandle.prototype.createWritable = async function (...args) {
      if (this.name.endsWith('.docsymbi.json')) throw new DOMException('full', 'QuotaExceededError');
      return original.apply(this, args);
    };
    let code = '';
    try { await repository.save(changed, stored.revision); } catch (error) { code = (error as { code: string }).code; }
    finally { FileSystemFileHandle.prototype.createWritable = original; }
    const unchanged = JSON.stringify((await repository.get(input.id)).document) === JSON.stringify(stored.document);
    const after = await listFiles(root);
    const retry = await repository.save(changed, stored.revision);
    return { version: JSON.parse(originalText).schemaVersion, code, unchanged, before, after,
      caption: retry.document.blocks[0]!.kind === 'image' ? retry.document.blocks[0]!.caption : '',
      fileCountAfterRetry: (await listFiles(root)).length };
  }, JSON.stringify(fixture));
  expect(result.version).toBe(5); expect(result.code).toBe('QuotaExceeded'); expect(result.unchanged).toBe(true);
  expect(result.after).toEqual(result.before); expect(result.caption).toBe('保存に失敗する変更');
  expect(result.fileCountAfterRetry).toBe(3);
});

test('more than 10 MiB of embedded image JSON saves as a small reference document', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/tests/harness.html');
  const result = await page.evaluate(async json => {
    const input = JSON.parse(json) as Document;
    const base = input.blocks[0]!; if (base.kind !== 'image') throw new Error('fixture');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><!--' + 'x'.repeat(11 * 1024 * 1024) + '--></svg>';
    const data = btoa(svg);
    const blocks = Array.from({ length: 1 }, () => ({ ...base, id: crypto.randomUUID(), file: { ...base.file,
      id: crypto.randomUUID(), mimeType: 'image/svg+xml' as const, data, byteLength: svg.length, width: 1, height: 1 } }));
    const paragraph = { kind: 'paragraph' as const, id: crypto.randomUUID(), metadata: {}, text: '本文' };
    const document = { ...input, blocks: [paragraph, ...blocks] } as Document;
    const editor = window.createEditorTest(0, document);
    editor.execute({ type: 'replaceText', id: paragraph.id, text: '編集後の本文' });
    const repository = window.createFileRepositoryTest();
    const saved = await repository.create(editor.getDocument());
    const errors = [...editor.errors]; editor.dispose();
    await repository.createFolder('large-images');
    await repository.move(document.id, 'large-images', saved.revision);
    const read = await repository.get(document.id);
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('articles') as Directory;
    let mainSize = 0;
    for await (const handle of (await root.getDirectoryHandle('large-images') as Directory).values()) if (handle.kind === 'file') mainSize = (await handle.getFile()).size;
    return { embeddedSize: JSON.stringify(document).length, mainSize, count: read.document.blocks.filter(block => block.kind === 'image').length, errors,
      same: JSON.stringify(read.document) === JSON.stringify(saved.document) };
  }, JSON.stringify(fixture));
  expect(result.embeddedSize).toBeGreaterThan(10 * 1024 * 1024);
  expect(result.mainSize).toBeLessThan(10000); expect(result.count).toBe(1); expect(result.same).toBe(true);
  expect(result.errors).toEqual([]);
});

test('sidecar edits participate in conflict detection and invalid paths or missing images are rejected', async ({ page }) => {
  await page.goto('/tests/harness.html');
  const result = await page.evaluate(async json => {
    const input = JSON.parse(json) as Document;
    const repository = window.createFileRepositoryTest();
    const stored = await repository.create(input as Document);
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('articles') as Directory;
    let main: FileSystemFileHandle | undefined;
    for await (const handle of root.values()) if (handle.kind === 'file') main = handle;
    const text = await (await main!.getFile()).text(); const manifest = JSON.parse(text);
    const parts = (manifest.blocks[0].assetRef as string).split('/'); const name = parts.pop()!;
    let dir = root; for (const part of parts) dir = await dir.getDirectoryHandle(part) as Directory;
    const sidecar = await dir.getFileHandle(name); const description = JSON.parse(await (await sidecar.getFile()).text());
    description.caption = '外部で編集';
    let writer = await sidecar.createWritable(); await writer.write(JSON.stringify(description)); await writer.close();
    const read = await repository.get(input.id);
    let conflict = ''; try { await repository.save(stored.document, stored.revision); } catch (error) { conflict = (error as { code: string }).code; }
    manifest.blocks[0].assetRef = '../outside.json';
    writer = await main!.createWritable(); await writer.write(JSON.stringify(manifest)); await writer.close();
    let invalid = ''; try { await repository.get(input.id); } catch (error) { invalid = (error as Error).message; }
    writer = await main!.createWritable(); await writer.write(text); await writer.close();
    await dir.removeEntry(description.file.path);
    let missing = ''; try { await repository.get(input.id); } catch (error) { missing = (error as Error).message; }
    return { conflict, invalid, missing, caption: read.document.blocks[0]!.kind === 'image' ? read.document.blocks[0]!.caption : '',
      revisionChanged: read.revision !== stored.revision };
  }, JSON.stringify(fixture));
  expect(result.conflict).toBe('Conflict'); expect(result.revisionChanged).toBe(true); expect(result.caption).toBe('外部で編集');
  expect(result.invalid).toContain('参照先'); expect(result.missing).toContain('画像の関連ファイル');
});
