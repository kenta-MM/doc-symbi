import { expect, test } from '../helpers/folder-page';

test('folder and file menus rename, delete, create children and refresh external changes', async ({ page }) => {
  const tree = page.getByRole('navigation', { name: 'フォルダ階層' });
  const folderMenu = async (name: string) => tree.getByRole('button', { name: `▱ ${name}`, exact: true }).click({ button: 'right' });
  const confirm = async () => { await page.getByRole('button', { name: '実行', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0); };
  const refresh = async () => { await page.getByRole('button', { name: '選択中のフォルダの作成メニュー' }).click(); await page.getByRole('menuitem', { name: '更新', exact: true }).click(); };
  await expect(page.getByRole('button', { name: '一覧を再読み込み', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '一覧の作成メニュー' })).toHaveCount(0);
  await folderMenu('articles');
  await expect(page.getByRole('menuitem', { name: 'フォルダを削除' })).toBeDisabled();
  await page.getByRole('menuitem', { name: 'フォルダを作成' }).click();
  await page.getByLabel('フォルダ名', { exact: true }).fill('設計'); await confirm();
  await folderMenu('設計');
  await expect(page.getByRole('menuitem')).toHaveText(['フォルダを作成', 'ドキュメントを作成', 'フォルダ名を変更', 'フォルダを削除']);
  await page.getByRole('menuitem', { name: 'ドキュメントを作成' }).click();
  await expect(page.getByLabel('保存先フォルダ', { exact: true })).toHaveValue('設計');
  await page.getByLabel('新しいドキュメント名').fill('旧文書');
  await page.getByRole('button', { name: '作成して編集を開始' }).click();
  await expect(page.getByRole('status')).toContainText('保存済み');
  await page.getByRole('navigation', { name: 'パンくずリスト' }).getByRole('button', { name: 'ドキュメント', exact: true }).click();
  await tree.getByRole('button', { name: '旧文書', exact: true }).click({ button: 'right' });
  await expect(page.getByRole('menuitem')).toHaveText(['ファイル名を変更', 'ファイルを削除']);
  await page.getByRole('menuitem', { name: 'ファイル名を変更' }).click();
  await page.getByLabel('ファイル名', { exact: true }).fill('新文書'); await confirm();
  await expect(tree.getByRole('button', { name: '新文書', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('articles');
    const dir = await root.getDirectoryHandle('設計');
    const child = await dir.getDirectoryHandle('子', { create: true });
    const stream = await (await child.getFileHandle('note.txt', { create: true })).createWritable();
    await stream.write('外部ファイルも保持'); await stream.close();
  });
  await refresh(); await expect(tree.getByRole('button', { name: '▱ 子', exact: true })).toBeVisible();
  await folderMenu('設計'); await page.getByRole('menuitem', { name: 'フォルダ名を変更' }).click();
  await page.getByLabel('フォルダ名', { exact: true }).fill('変更後'); await confirm();
  await expect(tree.getByRole('button', { name: '▱ 変更後', exact: true })).toHaveAttribute('aria-current', 'page');
  const contents = await page.evaluate(async () => {
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('articles');
    const dir = await root.getDirectoryHandle('変更後');
    const names = []; for await (const item of (dir as unknown as { values(): AsyncIterable<FileSystemHandle> }).values()) names.push(item.name);
    return { names, note: await (await (await dir.getDirectoryHandle('子')).getFileHandle('note.txt')).getFile().then(file => file.text()) };
  });
  expect(contents.names.some(name => name.startsWith('新文書--'))).toBe(true); expect(contents.note).toBe('外部ファイルも保持');
  await tree.getByRole('button', { name: '新文書', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'ファイルを削除' }).click();
  await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await expect(tree.getByRole('button', { name: '新文書', exact: true })).toBeVisible();
  await tree.getByRole('button', { name: '新文書', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'ファイルを削除' }).click(); await confirm();
  await expect(tree.getByRole('button', { name: '新文書', exact: true })).toHaveCount(0);
  await folderMenu('変更後'); await page.getByRole('menuitem', { name: 'フォルダを削除' }).click();
  await expect(page.getByRole('dialog')).toContainText('配下のすべて'); await confirm();
  await expect(tree.getByRole('button', { name: '▱ 変更後', exact: true })).toHaveCount(0);
  expect(await page.evaluate(async () => {
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('articles');
    const names = []; for await (const item of (dir as unknown as { values(): AsyncIterable<FileSystemHandle> }).values()) names.push(item.name); return names;
  })).toEqual([]);
});
