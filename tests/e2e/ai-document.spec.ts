import { test, expect } from '@playwright/test';
import { prepareFolder } from '../helpers/folder-page';

test('AI receives folders and saves a document in Azure while root is selected', async ({ page }) => {
  await page.route('**/api/ai/status', route => route.fulfill({ json: { connected: true, models: [] } }));
  await prepareFolder(page);
  await page.evaluate(async () => {
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('articles');
    await root.getDirectoryHandle('Azure', { create: true });
  });
  await page.getByRole('button', { name: 'フォルダを同期・再接続' }).click();
  await expect(page.getByRole('navigation', { name: 'フォルダ階層' }).getByRole('button', { name: '▱ Azure', exact: true })).toBeVisible();
  await page.route('**/api/ai/chat', route => {
    const context = JSON.parse(route.request().postDataJSON().context);
    expect(context.folders).toContain('Azure');
    expect(context.selectedFolder).toBe('');
    const action = { type: 'create', folderPath: 'Azure', title: 'Azure Policy', blocks: [{ kind: 'paragraph', text: 'Azure Policyの説明です。' }] };
    return route.fulfill({ contentType: 'application/x-ndjson', body: JSON.stringify({ type: 'reply', message: 'Azureフォルダへの作成案です。', action }) + '\n{"type":"done","status":"completed"}\n' });
  });
  await page.getByRole('button', { name: 'AIチャット', exact: true }).click();
  await page.getByRole('textbox', { name: 'AIへの依頼' }).fill('Azureフォルダ以下にAzure Policyという文書を作って');
  await page.getByRole('button', { name: 'AIに送信', exact: true }).click();
  await expect(page.getByText('作成先：Azure', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '文書を作成', exact: true }).click();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('button', { name: '保存済み', exact: true })).toBeDisabled();
  const locations = await page.evaluate(async () => {
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('articles');
    const azure = await root.getDirectoryHandle('Azure');
    const names = async (directory: FileSystemDirectoryHandle) => { const result: string[] = []; for await (const [name, handle] of directory.entries()) if (handle.kind === 'file') result.push(name); return result; };
    return { root: await names(root), azure: await names(azure) };
  });
  expect(locations.azure.some(name => name.includes('Azure Policy'))).toBe(true);
  expect(locations.root.some(name => name.includes('Azure Policy'))).toBe(false);
});

test('creates, saves, edits, undoes and rejects stale AI document proposals', async ({ page }) => {
  await page.route('**/api/ai/status', route => route.fulfill({ json: { connected: true, models: [] } }));
  await page.route('**/api/ai/chat', route => {
    const input = route.request().postDataJSON();
    const current = input.context ? JSON.parse(input.context).document : null;
    const action = current ? { type: 'update', documentId: current.id, title: null, operations: [{ type: 'replace', id: current.blocks[1].id, block: { kind: 'paragraph', text: 'AIが修正した説明です。' } }] } : { type: 'create', folderPath: '', title: 'AI導入ガイド', blocks: [{ kind: 'heading', level: 1, text: 'はじめに' }, { kind: 'paragraph', text: '最初の説明です。' }] };
    return route.fulfill({ contentType: 'application/x-ndjson', body: JSON.stringify({ type: 'reply', message: '文書の案を用意しました。', action }) + '\n' + JSON.stringify({ type: 'done', status: 'completed' }) + '\n' });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'AIチャット', exact: true }).click();
  const send = async (text: string) => {
    await page.getByRole('textbox', { name: 'AIへの依頼' }).fill(text);
    await page.getByRole('button', { name: 'AIに送信', exact: true }).click();
  };
  await send('導入ガイドを新規作成して');
  await page.getByRole('button', { name: '文書を作成', exact: true }).click();
  const body = page.getByRole('textbox', { name: '文書本文', exact: true });
  await expect(page.getByRole('textbox', { name: '文書名', exact: true })).toHaveValue('AI導入ガイド');
  await expect(body).toContainText('最初の説明です。');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('button', { name: '保存済み', exact: true })).toBeDisabled();
  await send('説明を修正して');
  await page.getByRole('button', { name: '変更を適用', exact: true }).click();
  await expect(body).toContainText('AIが修正した説明です。');
  await body.press('Control+z');
  await expect(body).toContainText('最初の説明です。');
  await body.press('Control+Shift+z');
  await expect(body).toContainText('AIが修正した説明です。');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('button', { name: '保存済み', exact: true })).toBeDisabled();
  await send('もう一度修正して');
  const apply = page.getByRole('button', { name: '変更を適用', exact: true });
  await expect(apply).toBeVisible();
  await body.press('Control+End');
  await body.pressSequentially(' manual');
  await apply.click();
  await expect(page.getByRole('alert')).toContainText('変更されました');
  await expect(body).toContainText('manual');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('button', { name: '保存済み', exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('textbox', { name: '文書本文', exact: true })).toContainText('AIが修正した説明です。 manual');
});

test('does not offer actions from incomplete or failed responses', async ({ page }) => {
  await page.route('**/api/ai/status', route => route.fulfill({ json: { connected: true, models: [] } }));
  const reply = JSON.stringify({ type: 'reply', message: '作成案', action: { type: 'create', folderPath: '', title: '未完成', blocks: [{ kind: 'paragraph', text: '本文' }] } }) + '\n';
  await page.goto('/');
  await page.getByRole('button', { name: 'AIチャット', exact: true }).click();
  for (const suffix of ['', '{"type":"done","status":"interrupted"}\n', '{"type":"error","message":"接続失敗"}\n{"type":"done","status":"completed"}\n']) {
    await page.route('**/api/ai/chat', route => route.fulfill({ contentType: 'application/x-ndjson', body: reply + suffix }));
    await page.getByRole('textbox', { name: 'AIへの依頼' }).fill('作成して');
    await page.getByRole('button', { name: 'AIに送信', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('button', { name: '文書を作成', exact: true })).toHaveCount(0);
  }
});
