import { expect, test } from '@playwright/test';
test('outline labels update and select the correct heading', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.getByRole('button', { name: '見出し', exact: true }).click();
  await expect(page.getByRole('button', { name: '無題の見出し', exact: true })).toBeVisible();
  await page.locator('.tiptap h1').fill('目的の節');
  await page.getByRole('button', { name: '目的の節', exact: true }).click();
  await expect(page.locator('.tiptap h1')).toBeInViewport();
  await page.getByRole('button', { name: 'ブロック削除', exact: true }).click();
  await expect(page.getByText('見出しはまだありません')).toBeVisible();
});
