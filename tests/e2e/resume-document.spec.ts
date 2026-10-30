import { expect, test } from '../helpers/folder-page';

test('direct links reopen the document while root startup shows the library', async ({ page }) => {
  for (const title of ['前回読んだ記事', '最新の記事']) {
    await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.getByRole('button', { name: '作成して編集を開始', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '保存済み' })).toBeVisible();
    await page.getByLabel('文書名').fill(title);
    await page.getByLabel('文書名').press('Tab');
    await page.locator('.tiptap').fill(title + 'の本文');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('保存済み');
  }
  await page.getByRole('navigation', { name: 'パンくずリスト' }).getByRole('button', { name: 'ドキュメント', exact: true }).click();
  await page.locator('.document-link').filter({ hasText: '前回読んだ記事' }).click();
  await expect(page.locator('.document-title')).toContainText('前回読んだ記事');
  await page.reload();
  await expect(page.locator('.document-title')).toContainText('前回読んだ記事');
  await expect(page.locator('.tiptap')).toHaveText('前回読んだ記事の本文');
  await expect(page.locator('.tiptap')).toHaveAttribute('contenteditable', 'false');
  await page.evaluate(() => { localStorage.clear(); history.replaceState(null, '', location.pathname); });
  await page.reload();
  await expect(page.locator('.document-link')).toHaveCount(2);
  await expect(page.locator('.tiptap')).toHaveCount(0);
});

test('reconnecting refreshes the library and preserves an existing draft', async ({ page }) => {
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.getByRole('button', { name: '作成して編集を開始', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '保存済み' })).toBeVisible();
  await page.locator('.tiptap').fill('再接続で開く本文');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('保存済み');
  await page.addInitScript(() => {
    let granted = false;
    Object.defineProperty(FileSystemDirectoryHandle.prototype, 'queryPermission', { configurable: true, value: async () => granted ? 'granted' : 'prompt' });
    Object.defineProperty(FileSystemDirectoryHandle.prototype, 'requestPermission', { configurable: true, value: async () => { granted = true; return 'granted'; } });
  });
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('保存先に再接続');
  await expect(page.getByRole('button', { name: '保存を再試行' })).toHaveCount(0);
  await page.getByRole('button', { name: 'フォルダを同期・再接続' }).click();
  await page.locator('.document-link').click();
  await expect(page.locator('.tiptap')).toHaveText('再接続で開く本文');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.getByRole('button', { name: '作成して編集を開始', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '保存済み' })).toBeVisible();
  await page.locator('.tiptap').fill('上書きしない下書き');
  await page.evaluate(() => {
    Object.defineProperty(FileSystemDirectoryHandle.prototype, 'queryPermission', { configurable: true, value: async () => 'denied' });
    Object.defineProperty(FileSystemDirectoryHandle.prototype, 'requestPermission', { configurable: true, value: async () => {
      Object.defineProperty(FileSystemDirectoryHandle.prototype, 'queryPermission', { configurable: true, value: async () => 'granted' });
      return 'granted';
    } });
  });
  await page.keyboard.press('Control+s');
  await expect(page.getByRole('status', { name: '保存状態' })).toContainText('保存失敗');
  await page.getByRole('button', { name: '保存先に再接続' }).click();
  await expect(page.locator('.tiptap')).toHaveText('上書きしない下書き');
  await expect(page.locator('.tiptap')).toHaveAttribute('contenteditable', 'true');
});

