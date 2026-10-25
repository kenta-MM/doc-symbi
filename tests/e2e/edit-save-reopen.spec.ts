import { expect, test } from '@playwright/test';
test('create, edit Japanese and emoji, save and reopen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.getByRole('textbox', { name: '文書名' }).fill('はじめての文書');
  await page.getByRole('textbox', { name: '文書名' }).press('Tab');
  await page.locator('.tiptap').fill('日本語 😀\n  本文');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '保存済み' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /はじめての文書/ }).click();
  await expect(page.locator('.tiptap')).toContainText('日本語 😀');
});
test('storage failure displays failure and preserves current and saved content', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.locator('.tiptap').fill('正常保存');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '保存済み' })).toBeVisible();
  await page.locator('.tiptap').fill('現在の編集');
  await page.evaluate(() => { IDBObjectStore.prototype.put = function () { throw new DOMException('容量不足', 'QuotaExceededError'); }; });
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '保存失敗' })).toBeVisible();
  await expect(page.locator('.tiptap')).toContainText('現在の編集');
  page.on('dialog', dialog => dialog.accept());
  await page.reload();
  await page.getByRole('button', { name: /無題の文書/ }).click();
  await expect(page.locator('.tiptap')).toContainText('正常保存');
});
