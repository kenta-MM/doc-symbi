import { expect, test } from '../helpers/folder-page';

test('app name returns home, resets search and guards unsaved edits', async ({ page }) => {
  const home = page.getByRole('button', { name: 'DocSymbi', exact: true });
  await page.getByLabel('文書を検索', { exact: true }).fill('検索条件');
  await page.getByLabel('種類で絞り込み').selectOption('article');
  await home.click();
  await expect(page.getByLabel('文書を検索', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('種類で絞り込み')).toHaveValue('');
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await home.click();
  await expect(page.getByRole('region', { name: 'ドキュメント一覧' })).toBeVisible();
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.getByRole('button', { name: '作成して編集を開始' }).click();
  await expect(page.getByRole('status')).toContainText('保存済み');
  await page.locator('.tiptap').fill('未保存の本文');
  await home.click();
  await expect(page.getByRole('dialog', { name: '未保存の変更' })).toBeVisible();
  await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await expect(page.locator('.tiptap')).toContainText('未保存の本文');
  await home.focus(); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '保存して移動', exact: true }).click();
  await expect(page.getByRole('region', { name: 'ドキュメント一覧' })).toBeVisible();
  await expect(page.getByLabel('フォルダで絞り込み')).toHaveValue('');
  await expect(page).not.toHaveURL(/article=/);
  await page.locator('.document-link').dblclick();
  await expect(page.locator('.tiptap')).toContainText('未保存の本文');
});
