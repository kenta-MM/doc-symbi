import { expect, test } from '../helpers/folder-page';

test('context destinations, folder validation, keyboard and menu dismissal', async ({ page }) => {
  const tree = page.getByRole('navigation', { name: 'フォルダ階層' });
  const root = tree.getByRole('button', { name: '▱ articles', exact: true });
  await root.click({ button: 'right' });
  await expect(page.getByRole('menu')).toContainText('作成先: articles/');
  await page.getByRole('menuitem', { name: 'フォルダを作成' }).click();
  await page.getByLabel('フォルダ名', { exact: true }).fill('CON');
  await page.getByRole('button', { name: '実行', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
  await page.getByLabel('フォルダ名', { exact: true }).fill('設計');
  await page.getByRole('button', { name: '実行', exact: true }).click();
  const child = tree.getByRole('button', { name: '▱ 設計', exact: true });
  await expect(child).toHaveAttribute('aria-current', 'page');
  await page.getByLabel('フォルダで絞り込み').selectOption('');
  await child.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'ドキュメントを作成' }).click();
  await expect(page.getByLabel('保存先フォルダ', { exact: true })).toHaveValue('設計');
  await page.getByLabel('新しいドキュメント名').fill('子文書');
  await page.getByRole('button', { name: '作成して編集を開始' }).click();
  await expect(page.getByRole('status')).toContainText('保存済み');
  await page.getByRole('navigation', { name: 'パンくずリスト' }).getByRole('button', { name: 'ドキュメント', exact: true }).click();
  await page.getByRole('region', { name: 'ドキュメント一覧' }).getByRole('button', { name: '子文書', exact: true }).click({ button: 'right' });
  await expect(page.getByRole('menu')).toContainText('保存先: articles/設計');
  await expect(page.getByRole('menuitem')).toHaveText(['ファイル名を変更', 'ファイルを削除']);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await root.focus(); await page.keyboard.press('Shift+F10');
  await expect(page.getByRole('menu')).toBeVisible();
  await page.getByRole('heading', { name: 'DocSymbi', exact: true }).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await page.locator('.catalog-table').click({ button: 'right', position: { x: 10, y: 170 } });
  await expect(page.getByRole('menu')).toContainText('作成先: articles/');
  await page.getByRole('menuitem', { name: 'ドキュメントを作成' }).click();
  await page.getByLabel('新しいドキュメント名').fill('ルート文書');
  await page.getByRole('button', { name: '作成して編集を開始' }).click();
  await expect(page.getByRole('status')).toContainText('保存済み');
  await page.getByRole('navigation', { name: 'パンくずリスト' }).getByRole('button', { name: 'ドキュメント', exact: true }).click();
  await page.getByLabel('文書を検索', { exact: true }).fill('文書');
  await page.locator('.catalog-table').focus(); await page.keyboard.press('Shift+F10');
  await page.getByRole('menuitem', { name: 'ドキュメントを作成' }).click();
  await expect(page.getByRole('dialog', { name: '作成先フォルダの選択' })).toBeVisible();
  await page.getByLabel('作成先フォルダ', { exact: true }).selectOption('設計');
  await page.getByRole('button', { name: '次へ' }).click();
  await expect(page.getByLabel('保存先フォルダ', { exact: true })).toHaveValue('設計');
  const paths = await page.evaluate(async () => {
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('articles');
    const paths: string[] = [];
    for (const [dir, prefix] of [[root, ''], [await root.getDirectoryHandle('設計'), '設計/']] as const) {
      for await (const entry of (dir as unknown as { values(): AsyncIterable<FileSystemHandle> }).values()) if (entry.kind === 'file') paths.push(prefix + entry.name);
    }
    return paths;
  });
  expect(paths.some(path => path.startsWith('設計/子文書--'))).toBe(true);
  expect(paths.some(path => path.startsWith('ルート文書--'))).toBe(true);
});

test('permission loss blocks folder and document creation', async ({ page }) => {
  await page.getByRole('button', { name: '選択中のフォルダの作成メニュー' }).click();
  await page.getByRole('menuitem', { name: 'フォルダを作成' }).click();
  await page.getByLabel('フォルダ名', { exact: true }).fill('作らない');
  await page.evaluate(() => {
    const prototype = FileSystemHandle.prototype as unknown as { queryPermission: () => Promise<string> };
    prototype.queryPermission = async () => 'denied';
  });
  await page.getByRole('button', { name: '実行', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('再接続');
  await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.getByRole('button', { name: '作成して編集を開始' }).click();
  await expect(page.getByRole('alert')).toContainText('再接続');
  expect(await page.evaluate(async () => {
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('articles');
    const entries = []; for await (const item of (dir as unknown as { values(): AsyncIterable<FileSystemHandle> }).values()) entries.push(item.name);
    return entries;
  })).toEqual([]);
});

test('unset storage never creates a physical folder and keeps browser saving', async ({ page }) => {
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('docsymbi-folder');
      request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
    });
  });
  await page.reload();
  await page.getByRole('button', { name: '選択中のフォルダの作成メニュー' }).click();
  await page.getByRole('menuitem', { name: 'フォルダを作成' }).click();
  await expect(page.getByRole('alert')).toContainText('保存フォルダーを選択');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await expect(page.getByText('保存先フォルダが未設定のため、', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '作成して編集を開始' }).click();
  await expect(page.getByRole('status')).toContainText('保存済み');
  expect(await page.evaluate(async () => {
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('articles');
    const entries = []; for await (const item of (dir as unknown as { values(): AsyncIterable<FileSystemHandle> }).values()) entries.push(item.name);
    return entries;
  })).toEqual([]);
});

test('disconnected directory prompts reconnect without creating a document', async ({ page }) => {
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.evaluate(() => {
    const prototype = FileSystemDirectoryHandle.prototype as unknown as { values: () => AsyncIterable<FileSystemHandle> };
    prototype.values = () => ({ [Symbol.asyncIterator]: () => ({ next: async () => { throw new DOMException('保存先が見つかりません', 'NotFoundError'); } }) });
  });
  await page.getByRole('button', { name: '作成して編集を開始' }).click();
  await expect(page.getByRole('alert')).toContainText('再接続');
  await expect(page.locator('.tiptap')).toHaveCount(0);
});
