import { expect, test } from '../helpers/folder-page';
test('history crosses save, keeps renamed title, clears redo on new edit and isolates documents', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await expect(page.getByRole('button', { name: '元に戻す', exact: true })).toHaveCount(0);
  await page.locator('.tiptap').fill('履歴の本文');
  const title = page.getByRole('textbox', { name: '文書名' }); await title.fill('名前を保持'); await title.press('Tab');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '保存済み' })).toBeVisible();
  await page.locator('.tiptap').focus(); await page.keyboard.press('Control+z');
  await expect(page.locator('.tiptap')).not.toContainText('履歴の本文');
  await expect(title).toHaveValue('名前を保持');
  await expect(page.getByRole('status').filter({ hasText: '未保存' })).toBeVisible();
  await page.locator('.tiptap').focus(); await page.keyboard.press('Control+Shift+z');
  await expect(page.locator('.tiptap')).toContainText('履歴の本文');
  await page.locator('.tiptap').click(); await page.keyboard.press('Control+z');
  await page.keyboard.insertText('別の編集');
  await expect(page.getByRole('button', { name: 'やり直す', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.getByRole('button', { name: '破棄して移動', exact: true }).click();
  await expect(page.getByRole('button', { name: '元に戻す', exact: true })).toHaveCount(0);
  await expect(page.locator('.tiptap')).toHaveText('');
});

