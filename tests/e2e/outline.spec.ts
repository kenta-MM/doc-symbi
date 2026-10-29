import { expect, test } from '../helpers/folder-page';
import { fixtureDocument } from '../fixtures/documents';
test('outline labels update and select the correct heading', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.getByRole('button', { name: '作成して編集を開始', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '保存済み' })).toBeVisible();
  await page.getByRole('button', { name: '見出し', exact: true }).click();
  await expect(page.getByRole('button', { name: '無題の見出し', exact: true })).toBeVisible();
  await page.locator('.tiptap h1').fill('目的の節');
  await page.getByRole('button', { name: '目的の節', exact: true }).click();
  await expect(page.locator('.tiptap h1')).toBeInViewport();
  await page.getByRole('button', { name: 'ブロック削除', exact: true }).click();
  await expect(page.getByText('見出しはまだありません')).toBeVisible();
});

test('duplicate, empty and skipped-level headings navigate by identity and update after structure changes', async ({ page }) => {
  const document = fixtureDocument(1);
  const blocks = [1, 3, 3, 6].map((level, index) => ({ kind: 'heading', id: crypto.randomUUID(), metadata: {}, level, text: index === 3 ? '' : '同名' }));
  await page.getByLabel('文書を読み込む').setInputFiles({ name: 'outline.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...document, blocks })) });
  const outline = page.locator('.outline button');
  await expect(outline).toHaveText(['同名', '同名', '同名', '無題の見出し']);
  // Separate the identical headings spatially so a wrong target cannot pass
  // merely because both headings were already in the viewport.
  await page.addStyleTag({ content: '.tiptap > h1,.tiptap > h3,.tiptap > h6{margin-bottom:1200px}' });
  for (let index = 0; index < 4; index++) {
    await outline.nth(index).click();
    await expect(page.locator('.tiptap > *').nth(index)).toBeInViewport();
  }
  await page.getByRole('button', { name: '編集', exact: true }).click();
  await page.locator('.tiptap > *').nth(1).click();
  await page.getByLabel('見出しレベル').selectOption('2');
  await expect(page.locator('.tiptap > h2')).toHaveText('同名');
  await page.getByRole('button', { name: '上へ', exact: true }).click();
  await expect(page.locator('.tiptap > *').first()).toHaveJSProperty('tagName', 'H2');
  await page.getByRole('button', { name: 'ブロック削除', exact: true }).click();
  await expect(outline).toHaveCount(3);
  await expect(page.locator('.tiptap > h2')).toHaveCount(0);
});
