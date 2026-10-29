import { expect, test } from '../helpers/folder-page';

test('reference layout keeps article controls above three columns and fits a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 2048, height: 1160 });
  await page.getByLabel('文書を読み込む').setInputFiles('docs/azure-sql-hyperscale.docsymbi.json');
  await expect(page.locator('.attached-image')).toHaveCount(4);
  const toolbar = (await page.locator('.workspace-toolbar').boundingBox())!;
  const sidebar = (await page.locator('.document-sidebar').boundingBox())!;
  const article = (await page.locator('.editor-host').boundingBox())!;
  const outline = (await page.locator('.document-properties').boundingBox())!;
  expect(toolbar.y + toolbar.height).toBeLessThanOrEqual(article.y);
  expect(sidebar.x + sidebar.width).toBeLessThan(article.x);
  expect(article.x + article.width).toBeLessThan(outline.x);
  await page.screenshot({ path: 'test-results/reference-layout-desktop.png' });
  const section = page.locator('.tiptap h2').nth(1);
  const sectionText = await section.textContent();
  await section.evaluate(element => element.scrollIntoView({ block: 'start' }));
  await expect(page.locator('.outline button[aria-current]')).toHaveText(sectionText!);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('button', { name: '編集', exact: true }).click();
  await expect(page.getByLabel('ブロック操作')).toBeVisible();
  await page.screenshot({ path: 'test-results/reference-layout-edit.png' });
  await page.getByRole('button', { name: '編集を終了', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: '編集', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/reference-layout-mobile.png' });
});

test('library search and sorting work after returning from the document', async ({ page }) => {
  for (const title of ['Alpha', 'Beta']) {
    await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.getByRole('button', { name: '作成して編集を開始', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '保存済み' })).toBeVisible();
    await page.getByLabel('文書名', { exact: true }).fill(title);
    await page.getByLabel('文書名', { exact: true }).press('Tab');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('保存済み');
  }
  await page.getByRole('navigation', { name: 'パンくずリスト' }).getByRole('button', { name: 'ドキュメント', exact: true }).click();
  await expect(page.locator('.document-link').first()).toContainText('Beta');
  await page.getByLabel('文書の並び順').selectOption('oldest');
  await expect(page.locator('.document-link').first()).toContainText('Alpha');
  await page.getByLabel('文書を検索').fill('alpha');
  await expect(page.locator('.document-link')).toHaveCount(1);
  await expect(page.locator('.tiptap')).toHaveCount(0);
  await page.getByLabel('文書を検索').fill('見つからない');
  await expect(page.getByText('一致する文書はありません。検索条件を変更してください。')).toBeVisible();
  await page.getByLabel('文書を検索').clear();
  await expect(page.locator('.document-link')).toHaveCount(2);
  await page.getByRole('button', { name: '使い方', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '使い方' })).toBeVisible();
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
});
