import { expect, test } from '../helpers/folder-page';
test('unsaved navigation cancellation and confirmed deletion target the correct document', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.locator('.tiptap').fill('保持する本文');
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '未保存の変更' })).toBeVisible();
  await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await expect(page.locator('.tiptap')).toContainText('保持する本文');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '保存済み' })).toBeVisible();
  await page.getByRole('button', { name: '文書を削除' }).click();
  await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await expect(page.locator('.tiptap')).toContainText('保持する本文');
  await page.getByRole('button', { name: '文書を削除' }).click();
  await page.getByRole('button', { name: '削除する', exact: true }).click();
  await expect(page.locator('.document-link')).toHaveCount(0);
});
test('same-name documents remain distinct after rename and reload; blank name is rejected', async ({ page }) => {
  await page.goto('/');
  for (const text of ['first body', 'second body']) {
    await page.getByRole('button', { name: '新規作成', exact: true }).click();
    await page.locator('.tiptap').fill(text);
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: '保存済み' })).toBeVisible();
  }
  await expect(page.locator('.document-link')).toHaveCount(2);
  const name = page.getByRole('textbox', { name: '文書名' });
  await name.fill('  '); await name.press('Tab');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(name).toHaveValue('無題の文書');
  await name.fill('名前変更'); await name.press('Tab');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '保存済み' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /名前変更/ }).click();
  await expect(page.locator('.tiptap')).toContainText('second body');
  await page.getByRole('button', { name: /無題の文書/ }).click();
  await expect(page.locator('.tiptap')).toContainText('first body');
});
