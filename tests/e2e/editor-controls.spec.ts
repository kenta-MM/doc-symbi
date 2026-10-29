import { expect, test } from '../helpers/folder-page';

test.beforeEach(async ({ page }) => {
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.getByRole('button', { name: '作成して編集を開始', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '保存済み' })).toBeVisible();
});

test('delete a whole table or every remaining row/column and undo', async ({ page }) => {
  await page.getByRole('button', { name: '表を挿入' }).click();
  await page.getByLabel('行数', { exact: true }).fill('2');
  await page.getByLabel('列数', { exact: true }).fill('1');
  await page.getByRole('button', { name: '挿入', exact: true }).click();
  await page.locator('.tiptap th p').fill('保持するセル');
  await page.getByRole('button', { name: '表を削除', exact: true }).click();
  await expect(page.locator('.tiptap table')).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(page.locator('.tiptap table')).toContainText('保持するセル');
  await page.locator('.tiptap td p').click();
  await page.getByRole('button', { name: '行を削除', exact: true }).click();
  await expect(page.locator('.tiptap tr')).toHaveCount(1);
  await page.getByRole('button', { name: '行を削除', exact: true }).click();
  await expect(page.locator('.tiptap table')).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await page.locator('.tiptap th p').click();
  await page.getByRole('button', { name: '列を削除', exact: true }).click();
  await expect(page.locator('.tiptap table')).toHaveCount(0);
});

test('resize image corners, undo/redo and persist dimensions in view mode', async ({ page }) => {
  await page.getByLabel('画像ファイル').setInputFiles('docs/hyperscale-figures/figure-4.svg');
  await page.getByRole('button', { name: '画像情報を適用' }).click();
  const img = page.locator('.attached-image img');
  for (const corner of ['右下', '左上', '右上', '左下']) {
    const handle = page.getByRole('button', { name: `画像サイズ変更（${corner}）` });
    await handle.evaluate(element => element.scrollIntoView({ block: 'center' }));
    const before = await img.boundingBox();
    const box = (await handle.boundingBox())!;
    expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('aria-label'), { x: box.x + box.width / 2, y: box.y + box.height / 2 })).toBe(`画像サイズ変更（${corner}）`);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + (corner.startsWith('右') ? -60 : 60), box.y + box.height / 2 + (corner.endsWith('下') ? -40 : 40), { steps: 5 });
    await page.mouse.up();
    await expect(img).toHaveCSS('width', `${Math.round(before!.width - 60)}px`);
  }
  const size = await img.getAttribute('style');
  await page.keyboard.press('Control+z');
  await expect(img).not.toHaveAttribute('style', size!);
  await page.keyboard.press('Control+y');
  await expect(img).toHaveAttribute('style', size!);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '保存済み' })).toBeVisible();
  await page.reload();
  await expect(img).toHaveAttribute('style', size!);
  await expect(page.locator('.image-resize-handle:visible')).toHaveCount(0);
});

test('editing controls remain visible when scrolling a long document', async ({ page }) => {
  await page.locator('.tiptap').fill(Array.from({ length: 100 }, (_, i) => `本文 ${i}`).join('\n'));
  await page.evaluate(() => window.scrollTo(0, 1000));
  const toolbar = page.locator('.sticky-editor-tools');
  await expect.poll(async () => (await toolbar.boundingBox())!.y).toBe(0);
  await expect(page.getByRole('button', { name: '見出し', exact: true })).toBeInViewport();
});
