import { expect, test } from '../helpers/folder-page';

test('single click selects row information and double click opens the document', async ({ page }) => {
  for (const [title, tag] of [['選択文書A', 'タグA'], ['選択文書B', 'タグB']]) {
    await page.getByRole('button', { name: '新規作成', exact: true }).click();
    await page.getByLabel('新しいドキュメント名').fill(title!);
    await page.getByLabel('タグ', { exact: true }).fill(tag!);
    await page.getByRole('button', { name: '作成して編集を開始' }).click();
    await expect(page.getByRole('status')).toContainText('保存済み');
    await page.getByRole('navigation', { name: 'パンくずリスト' }).getByRole('button', { name: 'ドキュメント', exact: true }).click();
  }
  if (await page.locator('#ai-side-panel').isVisible()) await page.getByRole('button', { name: 'サイドパネルを閉じる' }).click();
  const first = page.locator('.catalog-table tbody tr').filter({ hasText: '選択文書A' });
  const second = page.locator('.catalog-table tbody tr').filter({ hasText: '選択文書B' });
  await first.locator('td').last().click();
  await expect(page.locator('#ai-side-panel')).toBeHidden();
  await expect(page.locator('.document-properties')).toContainText('タグA');
  await expect(first).toHaveClass('selected');
  await expect(page.locator('.tiptap')).toHaveCount(0);
  await page.getByRole('button', { name: 'AIチャット', exact: true }).click();
  await second.getByRole('button').click();
  await expect(page.getByRole('tab', { name: 'AIチャット', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.document-properties')).toContainText('タグB');
  await page.getByRole('tab', { name: '文書情報', exact: true }).click();
  await expect(page.locator('.document-properties')).toBeVisible();
  await first.locator('td').last().click();
  await expect(page.locator('.document-properties')).toContainText('タグA');
  await expect(page.locator('.document-properties')).toBeVisible();
  await second.getByRole('button').click();
  await expect(first).not.toHaveClass('selected');
  await expect(page.getByRole('region', { name: 'ドキュメント一覧' })).toBeVisible();
  await second.locator('td').last().dblclick();
  await expect(page.locator('.document-title')).toHaveText('選択文書B');
  await expect(page.locator('.tiptap')).toBeVisible();
});
