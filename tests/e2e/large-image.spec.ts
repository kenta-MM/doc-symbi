import { expect, test } from '../helpers/folder-page';
import type { Directory } from '../../src/infrastructure/files/directory-operations';

test('attach an image above 3 MiB, persist a separate description JSON and reload its bytes', async ({ page }) => {
  test.setTimeout(120000);
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.getByRole('button', { name: '作成して編集を開始', exact: true }).click();
  await expect(page.getByRole('status', { name: '保存状態' })).toContainText('保存済み');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="red"/><!--' + 'x'.repeat(4 * 1024 * 1024) + '--></svg>';
  await page.locator('input[type="file"][accept*="image"]').setInputFiles({ name: 'large.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(svg) });
  await page.getByLabel('画像の目的', { exact: true }).fill('大きい画像の保存確認');
  await page.getByRole('button', { name: '画像情報を適用', exact: true }).click();
  const image = page.locator('.tiptap img'); await expect(image).toHaveCount(1);
  await page.getByRole('button', { name: '保存', exact: true }).click(); await expect(page.getByRole('status', { name: '保存状態' })).toContainText('保存済み');
  const files = await page.evaluate(async () => {
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('articles') as Directory;
    let main = ''; for await (const handle of root.values()) if (handle.kind === 'file') main = await (await handle.getFile()).text();
    const document = JSON.parse(main); const block = document.blocks.find((block: { kind: string }) => block.kind === 'image');
    const parts = block.assetRef.split('/'); const name = parts.pop(); let dir = root; for (const part of parts) dir = await dir.getDirectoryHandle(part) as Directory;
    const description = JSON.parse(await (await (await dir.getFileHandle(name)).getFile()).text());
    return { mainSize: main.length, version: document.schemaVersion, block, description, bytes: (await (await dir.getFileHandle(description.file.path)).getFile()).size };
  });
  expect(files.version).toBe(5); expect(files.mainSize).toBeLessThan(10000); expect(files.block).not.toHaveProperty('file');
  expect(files.description).toMatchObject({ format: 'docsymbi-image', caption: 'large.svg', semantics: { purpose: '大きい画像の保存確認' } }); expect(files.description.file).not.toHaveProperty('data'); expect(files.bytes).toBe(Buffer.byteLength(svg));
  await page.reload(); await expect(image).toHaveCount(1); expect(await image.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBe(24);
  expect(await image.getAttribute('src')).toBe('data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64'));
});
