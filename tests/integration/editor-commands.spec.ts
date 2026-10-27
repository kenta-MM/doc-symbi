import { expect, test } from '@playwright/test';
test('24 documents each survive ten edit/IndexedDB save/reload cycles', async ({ page }) => {
  await page.goto('/tests/harness.html');
  expect(await page.evaluate(() => window.checkEditSaveRoundTrips())).toBe(240);
});

test('structural transactions preserve canonical metadata/IDs and undo history', async ({ page }) => {
  await page.goto('/tests/harness.html');
  const result = await page.evaluate(() => {
    const editor = window.createEditorTest();
    const initial = editor.initial;
    const first = initial.blocks[0]!;
    editor.execute({ type: 'convertParagraphHeading', id: first.id, kind: 'heading' });
    editor.execute({ type: 'setHeadingLevel', id: first.id, level: 6 });
    editor.execute({ type: 'moveBlock', id: first.id, index: 2 });
    const changed = structuredClone(editor.getDocument());
    editor.undo(); editor.undo(); editor.undo();
    const undone = structuredClone(editor.getDocument());
    editor.redo(); editor.redo(); editor.redo();
    const redone = structuredClone(editor.getDocument());
    const errors = [...editor.errors]; editor.dispose();
    return { initial, changed, undone, redone, errors };
  });
  expect(result.errors).toEqual([]);
  expect(result.changed.blocks[2]).toMatchObject({ ...result.initial.blocks[0], kind: 'heading', level: 6 });
  expect(result.undone).toEqual(result.initial);
  expect(result.redone).toEqual(result.changed);
});

test('native split, plain text paste and composition retain stable content and identity', async ({ page }) => {
  await page.goto('/tests/harness.html');
  const initial = await page.evaluate(() => { window.activeEditor = window.createEditorTest(0); return window.activeEditor.initial; });
  const body = page.locator('.tiptap');
  await body.click();
  await page.keyboard.insertText('日本語😀');
  await page.keyboard.press('Enter');
  await page.keyboard.insertText('後半');
  const split = await page.evaluate(() => window.activeEditor.getDocument());
  expect(split.blocks).toHaveLength(2);
  expect(split.blocks[0]!.id).toBe(initial.blocks[0]!.id);
  expect(split.blocks[1]!.id).not.toBe(initial.blocks[0]!.id);
  expect(split.blocks[1]!.metadata).toEqual(initial.blocks[0]!.metadata);
  await body.evaluate(element => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', ' 改行\r\n😀 ');
    clipboardData.setData('text/html', '<b>unwanted markup</b>');
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
  });
  await body.dispatchEvent('compositionstart', { data: '' });
  await page.keyboard.insertText('変換');
  await body.dispatchEvent('compositionend', { data: '変換' });
  const result = await page.evaluate(() => ({ document: window.activeEditor.getDocument(), errors: window.activeEditor.errors }));
  expect(result.errors).toEqual([]);
  expect(result.document.blocks[1]).toMatchObject({ text: '後半 改行\n😀 変換' });
  await expect(body).not.toContainText('unwanted markup');
  expect(await body.innerHTML()).not.toContain('nested');
});
test('100 individual changes undo/redo without losing IDs or metadata', async ({ page }) => {
  await page.goto('/tests/harness.html');
  const result = await page.evaluate(() => {
    const editor = window.createEditorTest();
    const initial = editor.initial;
    const heading = initial.blocks[1]!;
    const list = initial.blocks[3]!; if (list.kind !== 'list') throw new Error('fixture');
    const item = list.items[1]!;
    for (let index = 0; index < 100; index++) {
      const alternate = Math.floor(index / 4) % 2 === 0;
      if (index % 4 === 0) editor.execute({ type: 'replaceText', id: initial.blocks[0]!.id, text: `変更 ${index} 😀` });
      if (index % 4 === 1) editor.execute({ type: 'setHeadingLevel', id: heading.id, level: alternate ? 6 : 1 });
      if (index % 4 === 2) editor.execute({ type: 'moveBlock', id: initial.blocks[0]!.id, index: alternate ? 2 : 0 });
      if (index % 4 === 3) editor.execute({ type: alternate ? 'indentListItem' : 'outdentListItem', id: item.id });
    }
    const final = structuredClone(editor.getDocument());
    for (let index = 0; index < 100; index++) editor.undo();
    const undone = structuredClone(editor.getDocument());
    for (let index = 0; index < 100; index++) editor.redo();
    const redone = structuredClone(editor.getDocument());
    const errors = [...editor.errors]; editor.dispose();
    return { initial, final, undone, redone, errors };
  });
  expect(result.errors).toEqual([]);
  expect(result.undone).toEqual(result.initial);
  expect(result.redone).toEqual(result.final);
});
test('native list join rejects incompatible metadata without losing content or creating history', async ({ page }) => {
  await page.goto('/tests/harness.html');
  await page.evaluate(() => {
    window.activeEditor = window.createEditorTest(1);
    const list = window.activeEditor.getDocument().blocks[3]!;
    if (list.kind !== 'list') throw new Error('fixture');
    // Join adjacent leaf items. With children on the preceding item, Backspace
    // can legitimately reparent the following item without discarding metadata.
    window.activeEditor.execute({ type: 'deleteListItem', id: list.items[0]!.children[0]!.items[0]!.id });
  });
  const item = page.locator('.tiptap > ol > li').last().locator(':scope > p');
  await item.fill('結合候補');
  const before = await page.evaluate(() => window.activeEditor.getDocument());
  await item.click(); await page.keyboard.press('Home'); await page.keyboard.press('Backspace');
  const result = await page.evaluate(() => ({ document: window.activeEditor.getDocument(), errors: window.activeEditor.errors }));
  expect(result.document).toEqual(before); expect(result.errors.length).toBeGreaterThan(0);
});
