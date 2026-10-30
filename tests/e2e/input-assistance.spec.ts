import { expect, test } from '../helpers/folder-page';
import type { Page } from '@playwright/test';

async function paste(page: Page, text: string) {
  await page.locator('.tiptap').evaluate((node, value) => {
    const data = new DataTransfer(); data.setData('text/plain', value);
    node.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }));
  }, text);
}
test.beforeEach(async ({ page }) => {
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.getByRole('button', { name: '作成して編集を開始', exact: true }).click();
  await expect(page.getByRole('status', { name: '保存状態' })).toContainText('保存済み');
  await page.locator('.tiptap').click();
});

test('headings 1–6, lists and fences convert only on their completion and Backspace restores literal input', async ({ page }) => {
  const body = page.locator('.tiptap');
  for (const [marker, selector] of [['#', 'h1'], ['##', 'h2'], ['###', 'h3'], ['####', 'h4'], ['#####', 'h5'], ['######', 'h6'], ['-', 'ul'], ['1.', 'ol'], ['```', 'pre']]) {
    await body.press('Control+a'); await body.press('Backspace');
    await body.pressSequentially(marker!);
    await expect(body.locator(':scope > p')).toHaveText(marker!);
    await body.press(marker === '```' ? 'Enter' : 'Space');
    await expect(body.locator(selector!)).toHaveCount(1);
    await expect(body).toHaveText('');
    await body.press('Backspace');
    const literal = marker + (marker === '```' ? '' : ' ');
    await expect(body.locator(':scope > p')).toHaveText(literal, { useInnerText: false });
    await body.pressSequentially('literal');
    await expect(body.locator(':scope > p')).toHaveText(literal + 'literal');
  }
});

test('heading Enter becomes a paragraph; code Enter and Mod-Enter retain existing semantics; undo and redo are lossless', async ({ page }) => {
  const body = page.locator('.tiptap');
  await body.pressSequentially('## ');
  await body.press('Control+z');
  await expect(body.locator('h2')).toHaveCount(0);
  await expect(body).toHaveText('##');
  await body.press('Control+y');
  await expect(body.locator('h2')).toHaveCount(1);
  await body.pressSequentially('見出し'); await body.press('Enter');
  await body.pressSequentially('本文');
  await expect(body.locator('h2')).toHaveText('見出し');
  await expect(body.locator(':scope > p')).toHaveText('本文');
  await body.press('Enter'); await body.pressSequentially('```'); await body.press('Enter');
  await body.pressSequentially('# code'); await body.press('Enter'); await body.pressSequentially('next');
  await expect(body.locator('pre')).toHaveText('# code\nnext');
  await body.press('Control+Enter'); await body.pressSequentially('通常');
  await expect(body.locator(':scope > p').last()).toHaveText('通常');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status', { name: '保存状態' })).toContainText('保存済み');
  await page.reload();
  await expect(body.locator('h2')).toHaveText('見出し');
  await expect(body.locator('pre')).toHaveText('# code\nnext');
});

test('pasted symbols, mid-paragraph markers, disabled preference and IME Enter remain literal', async ({ page }) => {
  const body = page.locator('.tiptap');
  await paste(page, '#'); await body.press('Space');
  await expect(body.locator('h1')).toHaveCount(0);
  await body.fill('text'); await body.pressSequentially(' # ');
  await expect(body.locator('h1')).toHaveCount(0);
  await body.press('Control+a'); await body.press('Backspace'); await body.pressSequentially('1');
  await expect(body.locator('ol')).toHaveCount(0);
  await page.getByLabel('記号の自動変換').uncheck();
  await body.press('Control+a'); await body.press('Backspace'); await body.pressSequentially('# ');
  await expect(body.locator('h1')).toHaveCount(0);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status', { name: '保存状態' })).toContainText('保存済み');
  await page.reload(); await page.getByRole('button', { name: '編集', exact: true }).click();
  await expect(page.getByLabel('記号の自動変換')).not.toBeChecked();
  await page.getByLabel('記号の自動変換').check();
  await body.press('Control+a'); await body.press('Backspace'); await body.pressSequentially('/ta');
  await body.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true, keyCode: 229 });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(body).toHaveText('/ta');
  await body.press('Escape');
  await body.pressSequentially(' is literal');
  await expect(body).toHaveText('/ta is literal');
});

test('slash menu filters both languages, cancels losslessly and inserts a table at the original command position', async ({ page }) => {
  const body = page.locator('.tiptap');
  await body.pressSequentially('before'); await body.press('Enter');
  await body.press('Enter'); await body.pressSequentially('after');
  await body.locator(':scope > p').nth(1).click();
  await body.pressSequentially('/ta');
  await expect(page.getByRole('listbox', { name: '挿入メニュー' }).getByRole('option')).toHaveText(['表']);
  await body.press('Enter');
  await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await expect(body).toContainText('/ta');
  await body.locator(':scope > p').nth(1).click(); await body.press('End');
  await body.press('Backspace'); await body.press('Backspace'); await body.press('Backspace');
  await body.pressSequentially('/表');
  await expect(page.getByRole('listbox', { name: '挿入メニュー' }).getByRole('option')).toHaveText(['表']);
  await body.press('Enter');
  await page.getByLabel('行数', { exact: true }).fill('2'); await page.getByLabel('列数', { exact: true }).fill('2');
  await page.getByRole('button', { name: '挿入', exact: true }).click();
  await expect(body.locator(':scope > *')).toHaveCount(3);
  await expect(body.locator(':scope > p').first()).toHaveText('before');
  await expect(body.locator(':scope > table')).toHaveCount(1);
  await expect(body.locator(':scope > p').last()).toHaveText('after');
  await body.press('Control+z'); await expect(body).toContainText('/表');
  await body.press('Control+y'); await expect(body.locator('table')).toHaveCount(1);
  await body.locator('th p').first().click(); await page.keyboard.type('# ');
  await expect(body.locator('h1')).toHaveCount(0);
});

test('quiz selection, cancellation, unknown commands and list restrictions', async ({ page }) => {
  const body = page.locator('.tiptap');
  await body.pressSequentially('/'); await body.press('ArrowDown'); await body.press('Enter');
  await expect(page.getByRole('dialog', { name: 'クイズ設定' })).toBeVisible();
  await page.getByRole('dialog').press('Escape'); await expect(body).toHaveText('/');
  await body.press('Control+a'); await body.press('Backspace'); await body.pressSequentially('/qu'); await body.press('Enter');
  await page.getByLabel('問題1の問題文', { exact: true }).fill('質問');
  await page.getByLabel('問題1の選択肢1', { exact: true }).fill('正解');
  await page.getByLabel('問題1の選択肢2', { exact: true }).fill('不正解');
  await page.getByLabel('問題1の解説', { exact: true }).fill('解説');
  await page.getByRole('button', { name: 'クイズを適用', exact: true }).click();
  await expect(body.getByRole('region', { name: '選択クイズ' })).toHaveCount(1);
  await expect(body).not.toContainText('/qu');
  await body.press('Control+z'); await expect(body).toHaveText('/qu');
  await body.press('Control+a'); await body.press('Backspace'); await body.pressSequentially('/unknown'); await body.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(body.locator(':scope > p')).toHaveCount(2);
  await body.pressSequentially('- '); await body.pressSequentially('# ');
  await expect(body.locator('h1')).toHaveCount(0);
  await expect(body.locator('li')).toHaveText('# ');
});

test('images paste and drop at a visible target, validate files and survive undo/redo and reload', async ({ page }) => {
  const body = page.locator('.tiptap');
  await body.pressSequentially('before'); await body.press('Enter'); await body.pressSequentially('after');
  await body.press('Home');
  await body.evaluate(node => {
    const data = new DataTransfer(); data.items.add(new File(['<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="red"/></svg>'], 'test.svg', { type: 'image/svg+xml' }));
    node.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }));
  });
  await expect(body.locator('img')).toHaveCount(1);
  await body.press('Control+z'); await expect(body.locator('img')).toHaveCount(0);
  await body.press('Control+y'); await expect(body.locator('img')).toHaveCount(1);
  await body.evaluate(node => {
    const target = node.querySelector('p')!; const rect = target.getBoundingClientRect();
    const data = new DataTransfer(); data.items.add(new File(['<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'], 'drop.svg', { type: 'image/svg+xml' }));
    node.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: data, clientX: rect.left + 4, clientY: rect.top + 4 }));
  });
  await expect(page.getByLabel('画像の挿入位置')).toBeVisible();
  await body.evaluate(node => {
    const rect = node.querySelector('p')!.getBoundingClientRect();
    const data = new DataTransfer(); data.items.add(new File(['<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'], 'drop.svg', { type: 'image/svg+xml' }));
    node.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data, clientX: rect.left + 4, clientY: rect.top + 4 }));
  });
  await expect(body.locator('img')).toHaveCount(2);
  await expect(page.getByLabel('画像の挿入位置')).toHaveCount(0);
  await body.evaluate(node => {
    const data = new DataTransfer(); data.items.add(new File(['broken'], 'bad.png', { type: 'image/png' }));
    node.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }));
  });
  await expect(page.getByRole('alert')).toContainText('有効な画像');
  await expect(body.locator('img')).toHaveCount(2);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status', { name: '保存状態' })).toContainText('保存済み');
  await page.reload(); await expect(body.locator('img')).toHaveCount(2);
  await paste(page, '# readonly');
  await expect(body).not.toContainText('readonly');
});
