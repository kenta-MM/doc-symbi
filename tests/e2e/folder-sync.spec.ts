import { expect, test } from '../helpers/folder-page';

test('folder sync reconnects and discovers external folders from both controls', async ({ page }) => {
  await expect(page.locator('.workspace-toolbar')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'ブラウザ内の記事をコピー' })).toHaveCount(0);
  await page.evaluate(async () => {
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('articles');
    await root.getDirectoryHandle('外部追加', { create: true });
    let granted = false;
    Object.defineProperty(FileSystemDirectoryHandle.prototype, 'queryPermission', { configurable: true, value: async () => granted ? 'granted' : 'prompt' });
    Object.defineProperty(FileSystemDirectoryHandle.prototype, 'requestPermission', { configurable: true, value: async () => { granted = true; return 'granted'; } });
  });
  await page.getByRole('button', { name: 'フォルダを同期・再接続' }).click();
  await expect(page.getByRole('button', { name: '▱ 外部追加', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('articles');
    await root.getDirectoryHandle('メニュー同期', { create: true });
    let granted = false;
    Object.defineProperty(FileSystemDirectoryHandle.prototype, 'queryPermission', { configurable: true, value: async () => granted ? 'granted' : 'prompt' });
    Object.defineProperty(FileSystemDirectoryHandle.prototype, 'requestPermission', { configurable: true, value: async () => { granted = true; return 'granted'; } });
  });
  await page.getByRole('button', { name: '選択中のフォルダの作成メニュー' }).click();
  await page.getByRole('menuitem', { name: '同期・再接続' }).click();
  await expect(page.getByRole('button', { name: '▱ メニュー同期', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
