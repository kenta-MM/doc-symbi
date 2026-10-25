import { expect, test } from '@playwright/test';
import { serveTestBuild } from '../helpers/static-server';
test('waiting service worker does not reload unsaved edits and update uses the guard', async ({ page }) => {
  const server = await serveTestBuild();
  try {
    await page.goto(server.origin);
    await expect(page.getByText('オフライン利用の準備完了', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '新規作成', exact: true }).click();
    await page.locator('.tiptap').fill('更新前の未保存本文');
    server.update();
    await page.evaluate(async () => { const registration = await navigator.serviceWorker.getRegistration(); await registration?.update(); });
    await expect(page.getByRole('button', { name: '更新版を適用' })).toBeVisible();
    await expect(page.locator('.tiptap')).toContainText('更新前の未保存本文');
    await page.getByRole('button', { name: '更新版を適用' }).click();
    await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
    await expect(page.locator('.tiptap')).toContainText('更新前の未保存本文');
    await page.getByRole('button', { name: '更新版を適用' }).click();
    await page.getByRole('button', { name: '保存して移動' }).click();
    await expect(page.getByText('考えを、構造に。')).toBeVisible();
    await page.getByRole('button', { name: /無題の文書/ }).click();
    await expect(page.locator('.tiptap')).toContainText('更新前の未保存本文');
  } finally { await server.close(); }
});
