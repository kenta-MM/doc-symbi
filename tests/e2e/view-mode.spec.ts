import { expect, test } from '../helpers/folder-page';

test('view mode prevents changes, retains unsaved content and history, and is the default on reopen', async ({ page }) => {
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  const body = page.locator('.tiptap');
  await expect(body).toHaveAttribute('contenteditable', 'true');
  await body.fill('保存前の本文');
  await page.getByRole('button', { name: '編集を終了', exact: true }).click();
  await expect(body).toHaveAttribute('contenteditable', 'false');
  await expect(page.getByLabel('文書名')).toHaveCount(0);
  await expect(page.getByLabel('ブロック操作')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '元に戻す', exact: true })).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('未保存');
  await body.click();
  await page.keyboard.press('Control+z');
  await page.keyboard.type('should not appear');
  await expect(body).toHaveText('保存前の本文');
  await page.getByRole('button', { name: '編集', exact: true }).click();
  await page.locator('.tiptap').focus(); await page.keyboard.press('Control+z');
  await expect(body).not.toContainText('保存前の本文');
  await page.locator('.tiptap').focus(); await page.keyboard.press('Control+Shift+z');
  await expect(body).toHaveText('保存前の本文');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('保存済み');
  await page.reload();
  await page.locator('.document-link').click();
  await expect(body).toHaveAttribute('contenteditable', 'false');
  await expect(body).toHaveText('保存前の本文');
  await page.getByRole('button', { name: '編集', exact: true }).click();
  await body.fill('保存失敗でも保持');
  await page.evaluate(() => { FileSystemFileHandle.prototype.createWritable = async () => { throw new DOMException('容量不足', 'QuotaExceededError'); }; });
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('保存失敗');
  await page.getByRole('button', { name: '編集を終了', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('保存失敗');
  await expect(body).toHaveText('保存失敗でも保持');
});

