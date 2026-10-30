import { readFileSync } from 'node:fs';
import { expect, test, prepareFolder } from '../helpers/folder-page';
import { emptyImageSemantics } from '../../src/domain/image';

test('attach SVG, describe, undo/redo, save, export and restore in a clean profile', async ({ page, browser }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.getByRole('button', { name: '作成して編集を開始', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '保存済み' })).toBeVisible();
  await page.getByLabel('画像ファイル').setInputFiles('docs/hyperscale-figures/figure-4.svg');
  await page.getByRole('button', { name: '画像情報を適用' }).click();
  const image = page.locator('.attached-image img');
  await expect(image).toBeVisible();
  await expect(image).toHaveJSProperty('naturalWidth', 1000);
  await image.click({ button: 'right' });
  await page.getByRole('menuitem', { name: '画像の詳細設定' }).click();
  await page.getByLabel('キャプション', { exact: true }).fill('図4：地域障害への備え');
  await page.getByLabel('代替テキスト', { exact: true }).fill('共有ストレージと独立ストレージを比較する');
  await page.getByText('構成要素・関係・出典', { exact: true }).click();
  const semantics = { ...emptyImageSemantics(), purpose: 'レプリカの違いを説明する', entities: [{ id: 'primary', label: 'Primary', role: '読み書き処理' }], readingOrder: ['primary'] };
  await page.getByLabel('画像の目的').fill(semantics.purpose);
  await page.getByRole('button', { name: '構成要素を追加', exact: true }).click();
  await page.getByLabel('名称', { exact: true }).fill('Primary');
  await page.getByLabel('役割', { exact: true }).fill('読み書き処理');
  await page.getByRole('button', { name: '読み順を追加', exact: true }).click();
  await page.getByRole('button', { name: '画像情報を適用' }).click();
  await expect(page.locator('figcaption')).toHaveText('図4：地域障害への備え');
  await page.locator('.tiptap').focus(); await page.keyboard.press('Control+z');
  await expect(page.locator('figcaption')).toHaveText('figure-4.svg');
  await page.locator('.tiptap').focus(); await page.keyboard.press('Control+Shift+z');
  await expect(image).toHaveAttribute('alt', '共有ストレージと独立ストレージを比較する');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('保存済み');
  await page.reload();
  await page.getByRole('navigation', { name: 'パンくずリスト' }).getByRole('button', { name: 'ドキュメント', exact: true }).click();
  await page.locator('.document-link').first().dblclick();
  await expect(image).toHaveJSProperty('naturalWidth', 1000);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '文書を取り出す', exact: true }).click();
  const download = await downloadPromise;
  const buffer = readFileSync((await download.path())!);
  const exported = JSON.parse(buffer.toString());
  expect(exported.schemaVersion).toBe(2);
  const actual = exported.blocks.find((b: { kind: string }) => b.kind === 'image').semantics;
  semantics.entities[0]!.id = actual.entities[0].id; semantics.readingOrder[0] = actual.entities[0].id;
  expect(actual).toEqual(semantics);
  const context = await browser.newContext();
  const restored = await context.newPage();
  await prepareFolder(restored);
  await restored.getByLabel('文書を読み込む').setInputFiles({ name: 'restored.json', mimeType: 'application/json', buffer });
  await expect(restored.locator('.attached-image img')).toHaveJSProperty('naturalWidth', 1000);
  await expect(restored.locator('figcaption')).toHaveText('図4：地域障害への備え');
  await context.close();
});

test('four diagrams render, preserve content on explicit update, and SVG stays in image context', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  const doc = JSON.parse(readFileSync('docs/azure-sql-hyperscale.docsymbi.json', 'utf8'));
  await page.getByLabel('文書を読み込む').setInputFiles({ name: 'hyperscale.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await expect(page.locator('.attached-image')).toHaveCount(4);
  for (let i = 0; i < 4; i++) {
    await expect(page.locator('.attached-image img').nth(i)).toHaveJSProperty('naturalWidth', 1000);
    await page.locator('.attached-image').nth(i).screenshot({ path: `test-results/hyperscale-figure-${i+1}.png` });
  }
  doc.blocks.find((b: { kind: string }) => b.kind === 'image').caption = '更新した構成図';
  await page.getByRole('button', { name: '編集', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '現在の文書をファイルで更新' }).click();
  await (await chooser).setFiles({ name: 'updated.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await expect(page.locator('figcaption').first()).toHaveText('更新した構成図');
  await expect(page.locator('.document-title')).toHaveCount(1);
  await expect(page.getByRole('button', { name: '保存済み', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '編集', exact: true }).click();
  // An attached SVG is never inserted as executable DOM, nor can it fetch remote content.
  const requests: string[] = [];
  page.on('request', request => { if (request.url().includes('example.invalid')) requests.push(request.url()); });
  await page.getByLabel('画像ファイル').setInputFiles({ name: 'untrusted.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><script>window.pwned=1</script><image href="https://example.invalid/track.png"/><rect width="100" height="100" fill="red"/></svg>') });
  await page.getByRole('button', { name: '画像情報を適用' }).click();
  await expect(page.locator('.attached-image')).toHaveCount(5);
  await expect(page.locator('.attached-image img').first()).toHaveJSProperty('naturalWidth', 100);
  expect(await page.evaluate(() => 'pwned' in window)).toBe(false);
  expect(requests).toEqual([]);
  await expect(page.locator('.tiptap svg,.tiptap object,.tiptap iframe')).toHaveCount(0);
});

