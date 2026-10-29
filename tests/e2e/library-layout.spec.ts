import { expect, test } from '../helpers/folder-page';
import { fixtureDocument } from '../fixtures/documents';

test('library resizes and scrolls its lists without scrolling the page', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/tests/harness.html');
  await page.evaluate(async text => {
    const document = JSON.parse(text);
    const repository = window.createFileRepositoryTest();
    for (let i = 0; i < 45; i++) {
      await repository.create({ ...document, id: crypto.randomUUID(), title: `文書 ${i}` });
    }
  }, JSON.stringify(fixtureDocument()));
  await page.goto('/');
  await expect(page.locator('.catalog-table tbody tr')).toHaveCount(45);
  await expect(page.locator('.app-footer')).toHaveCount(0);
  const sidebar = page.locator('.library-sidebar');
  const handle = page.getByRole('separator', { name: 'フォルダビューの幅' });
  const before = (await sidebar.boundingBox())!.width;
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + 40);
  await page.mouse.up();
  expect((await sidebar.boundingBox())!.width).toBeCloseTo(before + 100, 0);
  await handle.press('ArrowLeft');
  expect((await sidebar.boundingBox())!.width).toBeCloseTo(before + 90, 0);
  for (const selector of ['.folder-tree', '.catalog-table']) {
    const list = page.locator(selector);
    await list.hover();
    await page.mouse.wheel(0, 500);
    await expect.poll(() => list.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  }
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(720);
  await page.setViewportSize({ width: 390, height: 720 });
  await expect(handle).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(720);
});
