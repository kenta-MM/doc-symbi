import { test as base, expect, type Page } from '@playwright/test';

// Exercise real browser file reads/writes and handle persistence with an isolated
// OPFS directory. Only the OS folder picker is substituted in automated tests.
export async function prepareFolder(page: Page, url = 'http://localhost:4173/') {
  await page.goto(url);
  await page.evaluate(() => {
    Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: async () =>
      (await navigator.storage.getDirectory()).getDirectoryHandle('articles', { create: true }) });
  });
  await page.getByRole('button', { name: 'フォルダを同期・再接続' }).click();
  await expect(page.getByRole('navigation', { name: 'フォルダ階層' }).getByRole('button', { name: '▱ articles', exact: true })).toBeVisible();
}
export const test = base.extend({
  page: async ({ page, context }, use, testInfo) => {
    await prepareFolder(page);
    if (testInfo.project.name === 'e2e-offline') {
      await page.evaluate(async () => { await navigator.serviceWorker.ready; });
      await context.setOffline(true);
      await page.reload();
    }
    await use(page);
  },
});
export { expect };
