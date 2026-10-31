import { expect, test } from '../helpers/folder-page';

test.beforeEach(async ({ page }) => {
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.getByRole('button', { name: '作成して編集を開始', exact: true }).click();
  await page.locator('.tiptap').click();
});

test('button applies inline code only to the selection, survives undo and reload', async ({ page }) => {
  const body = page.locator('.tiptap');
  await body.pressSequentially('before value after');
  await body.locator('p').evaluate(node => window.getSelection()!.setBaseAndExtent(node.firstChild!, 7, node.firstChild!, 12));
  await page.getByRole('button', { name: 'インラインコードブロック', exact: true }).click();
  await expect(body.locator('p > code.inline-code')).toHaveText('value');
  await expect(body.locator('p')).toHaveText('before value after');
  await expect(body.locator('pre')).toHaveCount(0);
  await body.press('Control+z'); await expect(body.locator('.inline-code')).toHaveCount(0);
  await body.press('Control+y'); await expect(body.locator('.inline-code')).toHaveText('value');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status', { name: '保存状態' })).toContainText('保存済み');
  await page.reload();
  await expect(body.locator('p > code.inline-code')).toHaveText('value');
});

test('double quotes start and end inline code in a paragraph', async ({ page }) => {
  const body = page.locator('.tiptap');
  await body.pressSequentially('before ""value"" after');
  await expect(body.locator('p')).toHaveText('before value after');
  await expect(body.locator('.inline-code')).toHaveText('value');
  await expect(body.locator('pre')).toHaveCount(0);
  await body.press('Control+z'); await body.press('Control+y');
  await expect(body.locator('.inline-code')).toHaveText('value');
});

test('button starts typing inline code without selection and toggles off', async ({ page }) => {
  const body = page.locator('.tiptap');
  const button = page.getByRole('button', { name: 'インラインコードブロック', exact: true });
  await button.click(); await page.keyboard.type('value');
  await button.click(); await page.keyboard.type(' normal');
  await expect(body.locator('.inline-code')).toHaveText('value');
  await expect(body.locator('p')).toHaveText('value normal');
});

test('inline code keeps heading and block shortcut symbols literal', async ({ page }) => {
  const body = page.locator('.tiptap');
  await body.pressSequentially('""# title""');
  await expect(body.locator('p > code.inline-code')).toHaveText('# title');
  await expect(body.locator('h1')).toHaveCount(0);
  await body.press('Enter');
  await body.pressSequentially('""``literal""');
  await expect(body.locator('p > code.inline-code').last()).toHaveText('``literal');
  await expect(body.locator('pre')).toHaveCount(0);
});

test('double quotes preserve selected text and remain literal in code blocks or with shortcuts disabled', async ({ page }) => {
  const body = page.locator('.tiptap');
  await body.pressSequentially('value');
  await body.locator('p').evaluate(node => window.getSelection()!.setBaseAndExtent(node.firstChild!, 0, node.firstChild!, 5));
  await expect(page.getByRole('button', { name: 'リンクの挿入', exact: true })).toBeEnabled();
  await body.pressSequentially('""');
  await expect(body.locator('.inline-code')).toHaveText('value');
  await body.press('Control+End'); await body.press('Enter');
  await page.getByLabel('記号の自動変換').uncheck();
  await body.locator('p').last().click(); await body.pressSequentially('""');
  await expect(body.locator('p').last()).toHaveText('""');
  await page.getByLabel('記号の自動変換').check();
  await body.locator('p').last().click(); await body.press('End'); await body.press('Enter');
  await body.pressSequentially('``""');
  await expect(body.locator('pre')).toHaveText('""');
});
