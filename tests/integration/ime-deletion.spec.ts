import { expect, test } from '@playwright/test';
import { fixtureDocument } from '../fixtures/documents';

for (const kind of ['paragraph', 'code'] as const) {
for (const selectionStart of [0, 4]) {
test(`Chrome composition can shrink and continue without committing (${kind}, selection ${selectionStart})`, async ({ page }) => {
  await page.goto('/tests/harness.html');
  const fixture = fixtureDocument();
  const document = { ...fixture, blocks: [{ ...fixture.blocks[0], kind }] };
  await page.evaluate(value => { window.activeEditor = window.createEditorTest(0, value); }, document);
  const body = page.locator('.tiptap');
  await body.click();
  await body.evaluate(element => {
    element.setAttribute('data-composition-ends', '0');
    element.addEventListener('compositionend', () => {
      element.setAttribute('data-composition-ends', String(Number(element.getAttribute('data-composition-ends')) + 1));
    });
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text: 'にほんご', selectionStart, selectionEnd: 4 });
  await expect(body).toHaveText('にほんご');
  await cdp.send('Input.imeSetComposition', { text: 'にほん', selectionStart: 3, selectionEnd: 3 });
  await expect(body).toHaveText('にほん');
  await expect(body).toHaveAttribute('data-composition-ends', '0');
  await cdp.send('Input.imeSetComposition', { text: '日本語', selectionStart: 0, selectionEnd: 3 });
  await expect(body).toHaveText('日本語');
  await expect(body).toHaveAttribute('data-composition-ends', '0');
  await cdp.send('Input.insertText', { text: '日本語' });
  await expect(body).toHaveAttribute('data-composition-ends', '1');
  const result = await page.evaluate(() => ({ document: window.activeEditor.getDocument(), errors: window.activeEditor.errors }));
  expect(result.errors).toEqual([]);
  expect(result.document.blocks[0]).toMatchObject({ text: '日本語' });
});
}
}
