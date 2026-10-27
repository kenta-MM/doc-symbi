import { expect, test } from '../helpers/folder-page';

test('reference layout keeps article controls above three columns and fits a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 2048, height: 1160 });
  await page.getByLabel('文書を読み込む').setInputFiles('docs/azure-sql-hyperscale.docsymbi.json');
  await expect(page.locator('.attached-image')).toHaveCount(4);
  const toolbar = (await page.locator('.workspace-toolbar').boundingBox())!;
  const sidebar = (await page.locator('.document-sidebar').boundingBox())!;
  const article = (await page.locator('.editor-host').boundingBox())!;
  const outline = (await page.locator('.outline').boundingBox())!;
  expect(toolbar.y + toolbar.height).toBeLessThanOrEqual(article.y);
  expect(sidebar.x + sidebar.width).toBeLessThan(article.x);
  expect(article.x + article.width).toBeLessThan(outline.x);
  await page.screenshot({ path: 'test-results/reference-layout-desktop.png' });
  await page.getByRole('button', { name: '編集', exact: true }).click();
  await expect(page.getByLabel('ブロック操作')).toBeVisible();
  await page.screenshot({ path: 'test-results/reference-layout-edit.png' });
  await page.getByRole('button', { name: '編集を終了', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: '編集', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/reference-layout-mobile.png' });
});

test('sidebar search and sorting work without changing the open article', async ({ page }) => {
  for (const title of ['Alpha', 'Beta']) {
    await page.getByRole('button', { name: '新規作成', exact: true }).click();
    await page.getByLabel('文書名', { exact: true }).fill(title);
    await page.getByLabel('文書名', { exact: true }).press('Tab');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('保存済み');
  }
  await expect(page.locator('.document-link').first()).toContainText('Beta');
  await page.getByLabel('文書の並び順').selectOption('oldest');
  await expect(page.locator('.document-link').first()).toContainText('Alpha');
  await page.getByLabel('文書を検索').fill('alpha');
  await expect(page.locator('.document-link')).toHaveCount(1);
  await expect(page.getByLabel('文書名', { exact: true })).toHaveValue('Beta');
  await page.getByLabel('文書を検索').fill('見つからない');
  await expect(page.getByText('一致する文書はありません。')).toBeVisible();
  await page.getByLabel('文書を検索').clear();
  await expect(page.locator('.document-link')).toHaveCount(2);
  await page.getByRole('button', { name: '使い方', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '使い方' })).toBeVisible();
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
});
