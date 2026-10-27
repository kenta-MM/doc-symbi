import { chromium } from '@playwright/test';
import { expect, test, prepareFolder } from '../helpers/folder-page';
import { makeProfile } from '../helpers/browser-environment';
import { serveTestBuild } from '../helpers/static-server';
test('prepared app survives offline reload and editing', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByText('オフライン利用の準備完了', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.locator('.tiptap').fill('オフラインの本文');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '保存済み' })).toBeVisible();
  await context.setOffline(true); await page.reload();
  await page.getByRole('button', { name: /無題の文書/ }).click();
  await expect(page.locator('.tiptap')).toContainText('オフラインの本文');
  await page.getByRole('button', { name: '編集', exact: true }).click();
  await page.locator('.tiptap').fill('オフラインで追記');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '保存済み' })).toBeVisible();
});
test('cold start after browser shutdown and server shutdown uses the same isolated profile', async () => {
  const server = await serveTestBuild();
  const profile = await makeProfile();
  let serverClosed = false;
  let browser = await chromium.launchPersistentContext(profile, { headless: true, serviceWorkers: 'allow' });
  try {
    const page = await browser.newPage(); await prepareFolder(page, server.origin);
    await expect(page.getByText('オフライン利用の準備完了', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '新規作成', exact: true }).click();
    await page.locator('.tiptap').fill('再起動で保持');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: '保存済み' })).toBeVisible();
    await browser.close(); await server.close(); serverClosed = true;
    browser = await chromium.launchPersistentContext(profile, { headless: true, serviceWorkers: 'allow', offline: true });
    const reopened = await browser.newPage(); await reopened.goto(server.origin);
    await reopened.getByRole('button', { name: /無題の文書/ }).click();
    await expect(reopened.locator('.tiptap')).toContainText('再起動で保持');
    await reopened.getByRole('button', { name: '編集', exact: true }).click();
    await reopened.locator('.tiptap').fill('サーバーなしで編集');
    await reopened.getByRole('button', { name: '保存', exact: true }).click();
    await expect(reopened.getByRole('status').filter({ hasText: '保存済み' })).toBeVisible();
  } finally { await browser.close(); if (!serverClosed) await server.close(); }
});
