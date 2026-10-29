import { expect, test } from '../helpers/folder-page';
import { fixtureDocument } from '../fixtures/documents';

test('heading applies to highlighted text and supports keyboard history', async ({ page }) => {
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.getByRole('button', { name: '作成して編集を開始', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '保存済み' })).toBeVisible();
  const body = page.locator('.tiptap');
  await body.fill('before selected after');
  await body.focus();
  await body.evaluate(element => {
    const text = element.querySelector('p')!.firstChild!;
    window.getSelection()!.setBaseAndExtent(text, 7, text, 15);
  });
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('selected');
  await page.getByRole('button', { name: '見出し', exact: true }).click();
  await expect(body.locator('h1')).toHaveText('selected');
  await expect(body.locator('p')).toHaveText(['before ', ' after']);
  await page.keyboard.press('Control+z');
  await expect(body.locator('h1')).toHaveCount(0);
  await expect(body).toHaveText('before selected after');
  await page.keyboard.press('Control+Shift+z');
  await expect(body.locator('h1')).toHaveText('selected');
});

test('reverse multi-block selection retains empty edge lines and history', async ({ page }) => {
  const document = fixtureDocument();
  const blocks = ['\n日本語😀', '第二段落\n'].map(text => ({ kind: 'paragraph', id: crypto.randomUUID(), metadata: { source: text }, text }));
  await page.getByLabel('文書を読み込む').setInputFiles({ name: 'selection.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...document, blocks })) });
  await page.getByRole('button', { name: '編集', exact: true }).click();
  await page.locator('.tiptap').evaluate(element => {
    const first = element.firstElementChild!.lastChild!;
    const last = element.lastElementChild!.firstChild!;
    const selection = window.getSelection()!;
    selection.setBaseAndExtent(last, 4, first, 0);
  });
  await page.getByRole('button', { name: '見出し', exact: true }).click();
  await expect(page.locator('.tiptap h1')).toHaveText(['日本語😀', '第二段落']);
  await expect(page.locator('.tiptap p')).toHaveText(['', '']);
  await page.keyboard.press('Control+z');
  await expect(page.locator('.tiptap h1')).toHaveCount(0);
  await expect(page.locator('.tiptap p')).toHaveCount(2);
  await page.keyboard.press('Control+Shift+z');
  await expect(page.locator('.tiptap h1')).toHaveText(['日本語😀', '第二段落']);
});

test('without a highlight heading applies to the cursor line', async ({ page }) => {
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.getByRole('button', { name: '作成して編集を開始', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '保存済み' })).toBeVisible();
  const body = page.locator('.tiptap');
  await body.fill('first');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.insertText('second');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.insertText('third');
  await body.evaluate(element => {
    const line = [...element.querySelector('p')!.childNodes].find(node => node.textContent === 'second')!;
    window.getSelection()!.collapse(line, 2);
  });
  await expect.poll(() => page.evaluate(() => window.getSelection()?.anchorNode?.textContent)).toBe('second');
  await page.getByRole('button', { name: '見出し', exact: true }).click();
  await expect(body.locator('h1')).toHaveText('second');
  await expect(body.locator('p')).toHaveText(['first', 'third']);
  await expect(page.getByRole('button', { name: '元に戻す', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'やり直す', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('button', { name: '保存済み', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '編集を終了', exact: true }).click();
  await expect(page.getByLabel('文書名')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '保存済み', exact: true })).toHaveCount(0);
});
