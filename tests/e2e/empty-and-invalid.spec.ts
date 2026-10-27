import { expect, test } from '../helpers/folder-page';
import { fixtureDocument } from '../fixtures/documents';

test('empty documents reopen, unsupported imports leave saved data untouched, and editing can resume', async ({ page }) => {
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await expect(page.locator('.tiptap')).toHaveText('');
  await expect(page.getByText('見出しはまだありません')).toBeVisible();
  await page.keyboard.press('Control+s');
  await expect(page.getByRole('status')).toContainText('保存済み');
  await page.reload();
  await expect(page.locator('.tiptap')).toHaveText('');
  await expect(page.locator('.document-link')).toHaveCount(1);
  const base = fixtureDocument();
  for (const [text, reason] of [
    ['{broken', 'JSON'],
    [JSON.stringify({ ...base, schemaVersion: 999 }), 'バージョン'],
    [JSON.stringify({ ...base, blocks: [{ ...base.blocks[0], kind: 'table' }] }), ''],
  ]) {
    await page.getByLabel('文書を読み込む').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from(text!) });
    await expect(page.getByRole('alert')).toBeVisible();
    if (reason) await expect(page.getByRole('alert')).toContainText(reason);
    await expect(page.locator('.document-link')).toHaveCount(1);
    await expect(page.locator('.tiptap')).toHaveText('');
  }
  await page.reload();
  await expect(page.locator('.tiptap')).toHaveText('');
  await page.getByRole('button', { name: '編集', exact: true }).click();
  await page.locator('.tiptap').fill('空文書から編集を再開');
  await expect(page.locator('.tiptap')).toHaveText('空文書から編集を再開');
});
