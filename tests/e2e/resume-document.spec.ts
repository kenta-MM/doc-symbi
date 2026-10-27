import { expect, test } from '../helpers/folder-page';

test('startup resumes the last viewed article rather than the newest one', async ({ page }) => {
  for (const title of ['前回読んだ記事', '最新の記事']) {
    await page.getByRole('button', { name: '新規作成', exact: true }).click();
    await page.getByLabel('文書名').fill(title);
    await page.getByLabel('文書名').press('Tab');
    await page.locator('.tiptap').fill(title + 'の本文');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('保存済み');
  }
  await page.locator('.document-link').filter({ hasText: '前回読んだ記事' }).click();
  await expect(page.locator('.document-link.active')).toContainText('前回読んだ記事');
  await page.reload();
  await expect(page.locator('.document-link.active')).toContainText('前回読んだ記事');
  await expect(page.locator('.tiptap')).toHaveText('前回読んだ記事の本文');
  await expect(page.locator('.tiptap')).toHaveAttribute('contenteditable', 'false');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.document-link.active')).toContainText('最新の記事');
});

test('reconnecting opens the article automatically and preserves an existing draft', async ({ page }) => {
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
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
  await page.getByRole('button', { name: '保存先に再接続' }).click();
  await expect(page.locator('.tiptap')).toHaveText('再接続で開く本文');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.locator('.tiptap').fill('上書きしない下書き');
  await page.getByRole('button', { name: '保存先に再接続' }).click();
  await expect(page.locator('.tiptap')).toHaveText('上書きしない下書き');
  await expect(page.locator('.tiptap')).toHaveAttribute('contenteditable', 'true');
});

