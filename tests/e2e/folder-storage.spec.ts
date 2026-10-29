import { test, expect } from '../helpers/folder-page';

test('rename retains one portable file and external changes reject stale saves', async ({ page }) => {
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.getByRole('button', { name: '作成して編集を開始', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '保存済み' })).toBeVisible();
  await page.locator('.tiptap').fill('最初の本文');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('保存済み');
  const originalName = await page.evaluate(async () => {
    const directory = await (await navigator.storage.getDirectory()).getDirectoryHandle('articles');
    const names: string[] = [];
    for await (const key of (directory as unknown as { keys(): AsyncIterable<string> }).keys()) names.push(key);
    return names[0]!;
  });
  await page.getByLabel('文書名').fill('変更したタイトル');
  await page.getByLabel('文書名').press('Tab');
  await page.keyboard.press('Control+s');
  await expect(page.getByRole('status')).toContainText('保存済み');
  await page.evaluate(async name => {
    const directory = await (await navigator.storage.getDirectory()).getDirectoryHandle('articles');
    const file = await directory.getFileHandle(name);
    const document = JSON.parse(await (await file.getFile()).text());
    if (document.title !== '変更したタイトル') throw new Error('Filename changed or write was not committed');
    document.title = '外部の変更';
    const writer = await file.createWritable(); await writer.write(JSON.stringify(document)); await writer.close();
  }, originalName);
  await page.locator('.tiptap').fill('編集中の内容');
  await page.keyboard.press('Control+s');
  await expect(page.getByRole('status')).toContainText('保存失敗');
  await expect(page.locator('.tiptap')).toContainText('編集中の内容');
  await expect(page.getByRole('alert')).toContainText('外部で変更');
  page.on('dialog', dialog => dialog.accept());
  await page.reload();
  await expect(page.locator('.document-title')).toHaveText('外部の変更');
  await expect(page.locator('.document-title')).toHaveCount(1);
  await expect(page.locator('.tiptap')).toContainText('最初の本文');
});

test('failed first write can be retried without an empty corrupt article', async ({ page }) => {
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.evaluate(() => {
    const original = FileSystemFileHandle.prototype.createWritable;
    FileSystemFileHandle.prototype.createWritable = async function () {
      FileSystemFileHandle.prototype.createWritable = original;
      throw new DOMException('容量不足', 'QuotaExceededError');
    };
  });
  await page.getByRole('button', { name: '作成して編集を開始', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('保存失敗');
  await expect(page.getByRole('button', { name: '保存を再試行' })).toBeVisible();
  await page.locator('.tiptap').fill('失わない本文');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('保存済み');
  await page.reload();
  await page.getByRole('navigation', { name: 'パンくずリスト' }).getByRole('button', { name: 'ドキュメント', exact: true }).click();
  await page.locator('.document-link').click();
  await expect(page.locator('.tiptap')).toContainText('失わない本文');
});
