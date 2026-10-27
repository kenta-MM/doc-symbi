import { expect, test, prepareFolder } from '../helpers/folder-page';
import { readFile } from 'node:fs/promises';
import { fixtureDocument, documents } from '../fixtures/documents';
test('all stories work offline and portable data restores into an isolated empty context', async ({ page, context, browser }) => {
  const document = fixtureDocument(1);
  await page.goto('/');
  await expect(page.getByText('オフライン利用の準備完了', { exact: true })).toBeVisible();
  await context.setOffline(true);
  await page.getByLabel('文書を読み込む').setInputFiles({ name: 'fixture.docsymbi.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document)) });
  await page.getByRole('button', { name: '編集', exact: true }).click();
  await page.getByLabel('ブロック操作').getByRole('button', { name: '見出し', exact: true }).click();
  await page.locator('.tiptap > h1').fill('追加した節');
  await page.getByRole('button', { name: '追加した節', exact: true }).click();
  await expect(page.locator('.tiptap > h1')).toBeInViewport();
  await page.locator('.tiptap').focus(); await page.keyboard.press('Control+z');
  await page.locator('.tiptap').focus(); await page.keyboard.press('Control+Shift+z');
  const title = page.getByRole('textbox', { name: '文書名' }); await title.fill('オフライン検証'); await title.press('Tab');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '保存済み' })).toBeVisible();
  await page.getByRole('button', { name: '文書を削除' }).click();
  await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: '文書を取り出す', exact: true }).click();
  const download = await downloading; const path = await download.path(); if (!path) throw new Error('No download');
  const exported = await readFile(path);
  expect(JSON.parse(exported.toString()).id).toBe(document.id);
  await page.screenshot({ path: 'test-results/editor-review.png', fullPage: true });
  const other = await browser.newContext({ serviceWorkers: 'allow' });
  try {
    const restored = await other.newPage(); await prepareFolder(restored);
    await expect(restored.getByText('オフライン利用の準備完了', { exact: true })).toBeVisible();
    await other.setOffline(true);
    await restored.getByLabel('文書を読み込む').setInputFiles({ name: 'restore.docsymbi.json', mimeType: 'application/json', buffer: exported });
    await expect(restored.locator('.document-link.active')).toContainText('オフライン検証');
    const secondDownload = restored.waitForEvent('download');
    await restored.getByRole('button', { name: '文書を取り出す', exact: true }).click();
    const secondPath = await (await secondDownload).path(); if (!secondPath) throw new Error('No restore download');
    expect(JSON.parse(await readFile(secondPath, 'utf8'))).toEqual(JSON.parse(exported.toString()));
  } finally { await other.close(); }
});
test('all 24 fixtures export and restore with every field intact in a separate browser context', async ({ page, browser }, testInfo) => {
  test.setTimeout(120000);
  await page.goto('/');
  const isolated = await browser.newContext({ serviceWorkers: 'allow' });
  const target = await isolated.newPage(); await prepareFolder(target);
  if (testInfo.project.name === 'e2e-offline') {
    await expect(target.getByText('オフライン利用の準備完了', { exact: true })).toBeVisible();
    await isolated.setOffline(true);
    await target.reload();
  }
  try {
    for (const document of documents) {
      await page.getByLabel('文書を読み込む').setInputFiles({ name: 'source.docsymbi.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document)) });
      await expect(page.locator('.document-link.active')).toContainText(document.title);
      const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: '文書を取り出す', exact: true }).click();
      const path = await (await downloadPromise).path(); if (!path) throw new Error('No export');
      const exported = await readFile(path); expect(JSON.parse(exported.toString())).toEqual(document);
      await target.getByLabel('文書を読み込む').setInputFiles({ name: 'restore.docsymbi.json', mimeType: 'application/json', buffer: exported });
      await expect(target.locator('.document-link.active')).toContainText(document.title);
      const restoreDownload = target.waitForEvent('download'); await target.getByRole('button', { name: '文書を取り出す', exact: true }).click();
      const restoredPath = await (await restoreDownload).path(); if (!restoredPath) throw new Error('No restored export');
      expect(JSON.parse(await readFile(restoredPath, 'utf8'))).toEqual(document);
      for (const current of [page, target]) {
        await current.getByRole('button', { name: '編集', exact: true }).click();
        await current.getByRole('button', { name: '文書を削除' }).click(); await current.getByRole('button', { name: '削除する', exact: true }).click();
        await expect(current.locator('.document-link')).toHaveCount(0);
      }
    }
  } finally { await isolated.close(); }
});


