import { expect, test } from '../helpers/folder-page';
test('editing and saving require no external requests or document upload', async ({ page, context }) => {
  const unexpected: string[] = [];
  context.on('request', request => {
    if (!request.url().startsWith('http://localhost:4173/') || request.method() !== 'GET') unexpected.push(`${request.method()} ${request.url()}`);
  });
  await page.goto('/'); await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.locator('.tiptap').fill('外部に送信しない本文');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '保存済み' })).toBeVisible();
  expect(unexpected).toEqual([]);
});
