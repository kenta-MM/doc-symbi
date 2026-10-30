import { test, expect } from '../helpers/folder-page';

test('drag a document into a folder, nested folder and back to root without changing its contents', async ({ page }) => {
  await page.evaluate(async () => {
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('articles');
    const destination = await root.getDirectoryHandle('移動先', { create: true });
    await destination.getDirectoryHandle('子フォルダ', { create: true });
  });
  await page.getByRole('button', { name: 'フォルダを同期・再接続' }).click();
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.getByRole('button', { name: '作成して編集を開始', exact: true }).click();
  await page.locator('.tiptap').fill('移動しても内容を保持');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status', { name: '保存状態' })).toContainText('保存済み');
  const id = new URLSearchParams(new URL(page.url()).hash.slice(1)).get('article')!;
  await page.getByRole('button', { name: 'DocSymbi', exact: true }).click();
  for (const name of ['移動先', '子フォルダ', 'articles']) {
    await page.locator('.tree-document').dragTo(page.getByRole('button', { name: `▱ ${name}`, exact: true }));
    await expect(page.getByRole('button', { name: `▱ ${name}`, exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.catalog-table tbody tr')).toHaveCount(1);
  }
  await page.reload();
  await expect(page.locator('.tree-document')).toHaveCount(1);
  await page.locator('.tree-document').click();
  await expect(page.locator('.tiptap')).toHaveText('移動しても内容を保持');
  expect(new URLSearchParams(new URL(page.url()).hash.slice(1)).get('article')).toBe(id);
});
