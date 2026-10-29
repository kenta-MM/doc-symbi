import { expect, test } from '../helpers/folder-page';
import { fixtureDocument } from '../fixtures/documents';

test('real nested directories, external moves, metadata, conflicts and nonrecursive deletion', async ({ page }) => {
  await page.goto('/tests/harness.html');
  const result = await page.evaluate(async input => {
    const repository = window.createFileRepositoryTest();
    await repository.createFolder('EC'); await repository.createFolder('EC/設計');
    await repository.createFolder('別'); await repository.createFolder('別/設計');
    const document = JSON.parse(input);
    document.metadata = { ...document.metadata, type: 'detailed-design', tags: ['認証', 'API'], status: 'draft' };
    const stored = await repository.create(document, 'EC/設計');
    const first = await repository.list();
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('articles');
    const from = await (await root.getDirectoryHandle('EC')).getDirectoryHandle('設計');
    const to = await (await root.getDirectoryHandle('別')).getDirectoryHandle('設計');
    for await (const entry of (from as unknown as { values(): AsyncIterable<FileSystemFileHandle> }).values()) {
      const target = await to.getFileHandle('renamed.docsymbi.json', { create: true });
      const writer = await target.createWritable(); await writer.write(await (await entry.getFile()).text()); await writer.close();
      await from.removeEntry(entry.name);
    }
    const moved = await repository.list();
    await repository.save({ ...document, title: '移動後の更新' }, stored.revision);
    const read = await repository.get(document.id);
    let protectedNonempty = false;
    try { await repository.deleteFolder('別/設計'); } catch { protectedNonempty = true; }
    await repository.renameFolder('EC/設計', '空の設計');
    await repository.deleteFolder('EC/空の設計');
    const folders = await repository.folders();
    await repository.delete(document.id, read.revision);
    return { first, moved, read, protectedNonempty, folders, remaining: await repository.list() };
  }, JSON.stringify(fixtureDocument()));
  expect(result.first[0]).toMatchObject({ folderPath: 'EC/設計', type: 'detailed-design', tags: ['認証', 'API'] });
  expect(result.moved[0]).toMatchObject({ id: result.first[0]!.id, folderPath: '別/設計' });
  expect(result.read.document.title).toBe('移動後の更新');
  expect(result.read.document.metadata.tags).toEqual(['認証', 'API']);
  expect(result.protectedNonempty).toBe(true);
  expect(result.folders).toEqual(expect.arrayContaining(['', 'EC', '別', '別/設計']));
  expect(result.remaining).toEqual([]);
});

test('failed folder rename preserves original files and removes incomplete copy', async ({ page }) => {
  await page.goto('/tests/harness.html');
  const result = await page.evaluate(async () => {
    const repository = window.createFileRepositoryTest();
    await repository.createFolder('元');
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('articles');
    const original = await root.getDirectoryHandle('元');
    const writer = await (await original.getFileHandle('note.txt', { create: true })).createWritable();
    await writer.write('保持する内容'); await writer.close();
    const createWritable = FileSystemFileHandle.prototype.createWritable;
    FileSystemFileHandle.prototype.createWritable = async () => { throw new DOMException('容量不足', 'QuotaExceededError'); };
    let rejected = false;
    try { await repository.renameFolder('元', '変更先'); } catch { rejected = true; }
    finally { FileSystemFileHandle.prototype.createWritable = createWritable; }
    return { rejected, folders: await repository.folders(), text: await (await (await original.getFileHandle('note.txt')).getFile()).text() };
  });
  expect(result).toEqual({ rejected: true, folders: ['', '元'], text: '保持する内容' });
});
