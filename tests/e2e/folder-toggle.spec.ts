import { expect, test } from '../helpers/folder-page';

test('disclosure toggles an unselected folder without changing the selection', async ({ page }) => {
  await page.evaluate(async () => {
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('articles');
    const parent = await root.getDirectoryHandle('親フォルダ', { create: true });
    await parent.getDirectoryHandle('子フォルダ', { create: true });
  });
  await page.getByRole('button', { name: 'フォルダを同期・再接続' }).click();
  const root = page.getByRole('button', { name: '▱ articles', exact: true });
  const parent = page.getByRole('button', { name: '▱ 親フォルダ', exact: true });
  const child = page.getByRole('button', { name: '▱ 子フォルダ', exact: true });
  await page.getByRole('button', { name: '親フォルダを折りたたむ', exact: true }).click();
  await expect(child).toHaveCount(0);
  await expect(root).toHaveAttribute('aria-current', 'page');
  await expect(page.getByLabel('フォルダで絞り込み')).toHaveValue('');
  await page.getByRole('button', { name: '親フォルダを展開', exact: true }).press('Enter');
  await expect(child).toBeVisible();
  await expect(root).toHaveAttribute('aria-current', 'page');
  await parent.click();
  await expect(parent).toHaveAttribute('aria-current', 'page');
  await expect(child).toBeVisible();
  await parent.click();
  await expect(child).toHaveCount(0);
  await expect(parent).toHaveAttribute('aria-current', 'page');
});
