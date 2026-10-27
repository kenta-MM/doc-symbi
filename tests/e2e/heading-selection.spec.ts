import { expect, test } from '../helpers/folder-page';

test('heading applies to highlighted text and supports keyboard history', async ({ page }) => {
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  const body = page.locator('.tiptap');
  await body.fill('before selected after');
  await page.keyboard.press('Home');
  for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowRight');
  for (let i = 0; i < 8; i++) await page.keyboard.press('Shift+ArrowRight');
  await page.getByRole('button', { name: '見出し', exact: true }).click();
  await expect(body.locator('h1')).toHaveText('selected');
  await expect(body.locator('p')).toHaveText(['before ', ' after']);
  await page.keyboard.press('Control+z');
  await expect(body.locator('h1')).toHaveCount(0);
  await expect(body).toHaveText('before selected after');
  await page.keyboard.press('Control+Shift+z');
  await expect(body.locator('h1')).toHaveText('selected');
});

test('without a highlight heading applies to the cursor line', async ({ page }) => {
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  const body = page.locator('.tiptap');
  await body.fill('first');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.insertText('second');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.insertText('third');
  for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowLeft');
  await page.getByRole('button', { name: '見出し', exact: true }).click();
  await expect(body.locator('h1')).toHaveText('second');
  await expect(body.locator('p')).toHaveText(['first', 'third']);
  await expect(page.getByRole('button', { name: '元に戻す', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'やり直す', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('button', { name: '保存済み', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '編集を終了', exact: true }).click();
  await expect(page.getByLabel('文書名')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '保存済み', exact: true })).toHaveCount(0);
});
