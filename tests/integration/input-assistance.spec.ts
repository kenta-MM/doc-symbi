import { test, expect } from '@playwright/test';
import { fixtureDocument } from '../fixtures/documents';

test('prefix conversion preserves identity, metadata and suffix formatting through undo/redo and storage', async ({ page }) => {
  await page.goto('/tests/harness.html');
  const fixture = fixtureDocument();
  const original = { ...fixture, schemaVersion: 3, blocks: [{ ...fixture.blocks[0]!, text: 'payload', formatting: [{ from: 0, to: 7, bold: true }] }] };
  await page.evaluate(value => { window.activeEditor = window.createEditorTest(0, value); }, original);
  const body = page.locator('.tiptap');
  await body.click(); await body.press('Control+Home'); await body.pressSequentially('### ');
  let document = await page.evaluate(() => window.activeEditor.getDocument());
  expect(document.blocks[0]).toMatchObject({ kind: 'heading', level: 3, id: original.blocks[0]!.id, metadata: original.blocks[0]!.metadata, text: 'payload', formatting: [{ from: 0, to: 7, bold: true }] });
  await body.press('Backspace');
  document = await page.evaluate(() => window.activeEditor.getDocument());
  expect(document.blocks[0]).toMatchObject({ kind: 'paragraph', id: original.blocks[0]!.id, metadata: original.blocks[0]!.metadata, text: '### payload' });
  await body.pressSequentially('literal');
  expect((await page.evaluate(() => window.activeEditor.getDocument())).blocks[0]).toMatchObject({ kind: 'paragraph', text: '### literalpayload' });
  await body.press('Control+z'); await body.press('Control+y');
  const result = await page.evaluate(async () => {
    const expected = window.activeEditor.getDocument();
    const repository = window.createRepositoryTest();
    await repository.create(expected);
    return { expected, stored: (await repository.get(expected.id)).document, errors: window.activeEditor.errors };
  });
  expect(result.stored).toEqual(result.expected); expect(result.errors).toEqual([]);
});

test('list conversion preserves block metadata and history; readonly input does not convert', async ({ page }) => {
  await page.goto('/tests/harness.html');
  await page.evaluate(() => { window.activeEditor = window.createEditorTest(0); });
  const body = page.locator('.tiptap'); await body.click();
  const original = await page.evaluate(() => window.activeEditor.getDocument());
  await body.pressSequentially('- '); await body.pressSequentially('item');
  const list = (await page.evaluate(() => window.activeEditor.getDocument())).blocks[0]!;
  expect(list).toMatchObject({ kind: 'list', id: original.blocks[0]!.id, metadata: original.blocks[0]!.metadata, items: [{ text: 'item' }] });
  await body.press('Control+z'); await body.press('Control+y');
  expect((await page.evaluate(() => window.activeEditor.getDocument())).blocks[0]).toEqual(list);
  await page.evaluate(() => window.activeEditor.setEditable(false));
  await body.dispatchEvent('beforeinput', { inputType: 'insertText', data: '# ' });
  await body.dispatchEvent('keydown', { key: 'Enter' });
  expect((await page.evaluate(() => window.activeEditor.getDocument())).blocks[0]).toEqual(list);
  expect(await page.evaluate(() => window.activeEditor.errors)).toEqual([]);
});

for (const marker of ['- ', '1. ']) {
  test(`${marker.trim()} conversion preserves formatted suffix and restores it with Backspace`, async ({ page }) => {
    await page.goto('/tests/harness.html');
    const fixture = fixtureDocument();
    const original = { ...fixture, schemaVersion: 3, blocks: [{ ...fixture.blocks[0]!, text: 'payload', formatting: [{ from: 0, to: 7, bold: true, href: 'https://example.com/' }] }] };
    await page.evaluate(value => { window.activeEditor = window.createEditorTest(0, value); }, original);
    const body = page.locator('.tiptap');
    await body.click(); await body.press('Control+Home'); await body.pressSequentially(marker);
    expect((await page.evaluate(() => window.activeEditor.getDocument())).blocks[0]).toMatchObject({
      kind: 'list', style: marker === '- ' ? 'bullet' : 'ordered',
      id: original.blocks[0]!.id, metadata: original.blocks[0]!.metadata,
      items: [{ text: 'payload', formatting: original.blocks[0]!.formatting }],
    });
    await body.press('Backspace');
    expect((await page.evaluate(() => window.activeEditor.getDocument())).blocks[0]).toMatchObject({
      kind: 'paragraph', text: marker + 'payload', id: original.blocks[0]!.id,
    });
    await body.press('Control+z');
    expect((await page.evaluate(() => window.activeEditor.getDocument())).blocks[0]).toMatchObject({ kind: 'list', items: [{ text: 'payload', formatting: original.blocks[0]!.formatting }] });
    expect(await page.evaluate(() => window.activeEditor.errors)).toEqual([]);
  });
}
