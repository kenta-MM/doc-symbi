import { test as base, expect, type Page } from '@playwright/test';

// Exercise real browser file reads/writes and handle persistence with an isolated
// OPFS directory. Only the OS folder picker is substituted in automated tests.
export async function prepareFolder(page: Page, url = 'http://localhost:4173/') {
  await page.goto(url);
  await page.evaluate(() => {
    Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: async () =>
      (await navigator.storage.getDirectory()).getDirectoryHandle('articles', { create: true }) });
  });
  await page.getByRole('button', { name: /保存フォルダーを(選択|変更)/ }).click();
  await expect(page.locator('.document-sidebar')).toContainText('保存先: articles');
}
export const test = base.extend({
  page: async ({ page, context }, use, testInfo) => {
    await prepareFolder(page);
    if (testInfo.project.name === 'e2e-offline') {
      await expect(page.getByText('オフライン利用の準備完了', { exact: true })).toBeVisible();
      await context.setOffline(true);
      await page.reload();
    }
    await use(page);
  },
});
export { expect };
