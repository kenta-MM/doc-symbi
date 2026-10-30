import { expect, test } from '../helpers/folder-page';

test('discard and reload of the same ID replaces body and resets history', async ({ page }) => {
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.getByRole('button', { name: '作成して編集を開始', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '保存済み' })).toBeVisible();
  const body = page.locator('.tiptap');
  await body.fill('saved body');
  await page.keyboard.press('Control+s');
  await expect(page.getByRole('status')).toContainText('保存済み');
  await body.fill('discard me');
  await page.getByRole('navigation', { name: 'パンくずリスト' }).getByRole('button', { name: 'ドキュメント', exact: true }).click();
  await page.getByRole('button', { name: '破棄して移動' }).click();
  await page.locator('.document-link').dblclick();
  await expect(body).toHaveText('saved body');
  await page.evaluate(async () => {
    const directory = await (await navigator.storage.getDirectory()).getDirectoryHandle('articles');
    for await (const name of (directory as unknown as { keys(): AsyncIterable<string> }).keys()) {
      const file = await directory.getFileHandle(name);
      const document = JSON.parse(await (await file.getFile()).text());
      document.blocks[0].text = 'external body';
      const writer = await file.createWritable(); await writer.write(JSON.stringify(document)); await writer.close();
    }
  });
  await page.getByRole('navigation', { name: 'パンくずリスト' }).getByRole('button', { name: 'ドキュメント', exact: true }).click();
  await page.locator('.document-link').dblclick();
  await expect(body).toHaveText('external body');
  await page.getByRole('button', { name: '編集', exact: true }).click();
  await body.focus(); await page.keyboard.press('Control+z');
  await expect(body).toHaveText('external body');
});

test('title draft is guarded before blur and save-and-move preserves it', async ({ page }) => {
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.getByRole('button', { name: '作成して編集を開始', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '保存済み' })).toBeVisible();
  await page.keyboard.press('Control+s');
  await expect(page.getByRole('status')).toContainText('保存済み');
  await page.getByLabel('文書名', { exact: true }).fill('未確定の名前');
  const prevented = await page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event); return event.defaultPrevented;
  });
  expect(prevented).toBe(true);
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '未保存の変更' })).toBeVisible();
  await page.getByRole('button', { name: '保存して移動' }).click();
  await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await expect(page.locator('.document-link')).toContainText('未確定の名前');
});

test('save-and-move stops when body changes while the write is pending', async ({ page }) => {
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.getByRole('button', { name: '作成して編集を開始', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '保存済み' })).toBeVisible();
  await page.locator('.tiptap').fill('first draft');
  await page.evaluate(() => {
    const original = FileSystemFileHandle.prototype.createWritable;
    FileSystemFileHandle.prototype.createWritable = async function (...args) {
      const stream = await original.apply(this, args);
      const write = stream.write.bind(stream);
      stream.write = async data => { await new Promise<void>(resolve => window.addEventListener('release-write', () => resolve(), { once: true })); await write(data); };
      return stream;
    };
  });
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.getByRole('button', { name: '保存して移動' }).click();
  await expect(page.getByRole('status')).toContainText('保存中');
  await page.locator('.tiptap').fill('changed during save');
  await page.evaluate(() => window.dispatchEvent(new Event('release-write')));
  await expect(page.getByRole('alert')).toContainText('変更');
  await expect(page.locator('.tiptap')).toHaveText('changed during save');
  await expect(page.getByRole('dialog', { name: '未保存の変更' })).toBeVisible();
});
