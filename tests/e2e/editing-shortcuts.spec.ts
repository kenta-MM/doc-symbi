import { expect, test } from '../helpers/folder-page';

test.beforeEach(async ({ page }) => {
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.getByRole('button', { name: '作成して編集を開始', exact: true }).click();
  await page.locator('.tiptap').click();
});

test('Ctrl+X cuts the cursor line and keeps explicit selections', async ({ page }) => {
  const body = page.locator('.tiptap');
  await body.pressSequentially('first'); await body.press('Enter');
  await body.pressSequentially('second'); await body.press('Enter');
  await body.pressSequentially('third'); await body.locator('p').nth(1).click();
  await body.press('Control+x');
  await expect(body.locator('p')).toHaveText(['first', 'third']);
  await body.press('Control+End'); await body.press('Enter'); await body.press('Control+v');
  await expect(body.locator('p').last()).toContainText('second');
  await body.press('Control+z');
  await body.press('Control+Home'); await body.press('Shift+ArrowRight');
  await body.press('Control+x');
  await expect(body.locator('p').first()).toHaveText('irst');
});

test('heading markers can be used again after deleting heading text', async ({ page }) => {
  const body = page.locator('.tiptap');
  await body.pressSequentially('# title');
  for (let index = 0; index < 5; index++) await body.press('Backspace');
  await expect(body.locator('h1')).toHaveText('');
  await body.pressSequentially('## replacement');
  await expect(body.locator('h2')).toHaveText('replacement');
  await expect(body.locator('h1')).toHaveCount(0);
});

test('Ctrl+X removes one line inside code and undo restores it', async ({ page }) => {
  const body = page.locator('.tiptap');
  await body.pressSequentially('``first'); await body.press('Enter');
  await body.pressSequentially('second'); await body.press('Enter');
  await body.pressSequentially('third');
  await body.press('Control+x');
  await expect(body.locator('pre')).toHaveText('first\nsecond');
  await body.press('Control+z');
  await expect(body.locator('pre')).toHaveText('first\nsecond\nthird');
});

test('code applies only to highlighted text and preserves surrounding formatting', async ({ page }) => {
  const body = page.locator('.tiptap');
  await body.pressSequentially('before selected after');
  await body.press('Control+a'); await body.press('Control+b');
  await body.locator('p').evaluate(element => {
    const text = element.querySelector('strong')!.firstChild!;
    window.getSelection()!.setBaseAndExtent(text, 7, text, 15);
  });
  await page.getByRole('button', { name: 'コード', exact: true }).click();
  await expect(body.locator('pre')).toHaveText('selected');
  await expect(body.locator('pre strong')).toHaveCount(0);
  await expect(body.locator(':scope > p strong')).toHaveText(['before ', ' after'], { useInnerText: false });
  await expect(body.locator(':scope > p')).toHaveText(['before ', ' after'], { useInnerText: false });
  await body.press('Control+z');
  await expect(body.locator('pre')).toHaveCount(0);
  await expect(body).toHaveText('before selected after');
});

test('two backticks create code; width is undoable and persists after save', async ({ page }) => {
  const body = page.locator('.tiptap');
  await body.pressSequentially('``');
  await expect(body.locator('pre')).toHaveCount(1);
  await body.pressSequentially('const answer = 42;');
  const frame = body.locator('.code-resize-frame');
  const handle = page.getByRole('button', { name: 'コードブロックの幅を変更' });
  const before = (await frame.boundingBox())!;
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + 5, box.y + 10); await page.mouse.down();
  await page.mouse.move(box.x - 115, box.y + 10, { steps: 4 }); await page.mouse.up();
  await expect(frame).toHaveCSS('width', `${Math.round(before.width - 120)}px`);
  const style = await frame.getAttribute('style');
  await body.press('Control+z'); await expect(frame).not.toHaveAttribute('style', style!);
  await body.press('Control+y'); await expect(frame).toHaveAttribute('style', style!);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status', { name: '保存状態' })).toContainText('保存済み');
  await page.reload();
  await expect(frame).toHaveAttribute('style', style!);
  await expect(body.locator('pre')).toHaveText('const answer = 42;');
  await expect(handle).toBeHidden();
});
