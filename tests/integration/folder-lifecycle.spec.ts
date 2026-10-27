import { test, expect } from '../helpers/folder-page';
import { fixtureDocument } from '../fixtures/documents';
import { test as freshTest } from '@playwright/test';

freshTest('first selection remains usable when remembering the folder fails, preserving the unsaved draft', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.locator('.tiptap').fill('保存先未選択から復旧した本文');
  await page.keyboard.press('Control+s');
  await expect(page.getByRole('alert')).toContainText('記事の保存フォルダーを選択してください');
  await page.evaluate(() => {
    Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: async () =>
      (await navigator.storage.getDirectory()).getDirectoryHandle('first-selection', { create: true }) });
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'settings') throw new DOMException('Handle cannot be cloned', 'DataCloneError');
      return original.apply(this, args);
    };
  });
  await page.getByRole('button', { name: '保存フォルダーを選択' }).click();
  await expect(page.getByRole('note')).toContainText('次回用の保存先を記憶できませんでした');
  await expect(page.locator('.document-sidebar')).toContainText('保存先: first-selection');
  await expect(page.locator('.tiptap')).toContainText('保存先未選択から復旧した本文');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('保存済み');
  const contents = await page.evaluate(async () => {
    const directory = await (await navigator.storage.getDirectory()).getDirectoryHandle('first-selection');
    const values: string[] = [];
    for await (const handle of (directory as unknown as { values(): AsyncIterable<FileSystemFileHandle> }).values()) {
      values.push(await (await handle.getFile()).text());
    }
    return values;
  });
  expect(contents).toHaveLength(1);
  expect(JSON.parse(contents[0]!).blocks[0].text).toBe('保存先未選択から復旧した本文');
});

test('a new repository restores the selected folder before saving without UI initialization', async ({ page }) => {
  await page.goto('/tests/harness.html');
  const result = await page.evaluate(async text => {
    const repository = window.createFileRepositoryTest();
    await repository.create(JSON.parse(text));
    return { name: repository.name, documents: await repository.list() };
  }, JSON.stringify(fixtureDocument()));
  expect(result.name).toBe('articles');
  expect(result.documents).toHaveLength(1);
  await page.goto('/');
  await page.locator('.document-link').click();
  await expect(page.getByRole('status')).toContainText('保存済み');
});

test('reinitialization does not clear an active folder selection when remembered data is absent', async ({ page }) => {
  await page.goto('/tests/harness.html');
  const result = await page.evaluate(async text => {
    const repository = window.createFileRepositoryTest();
    await repository.restore();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('docsymbi-folder', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction('settings', 'readwrite');
        transaction.objectStore('settings').delete('directory');
        transaction.oncomplete = () => { db.close(); resolve(); };
        transaction.onabort = () => { db.close(); reject(transaction.error); };
      };
    });
    await repository.restore();
    await repository.create(JSON.parse(text));
    return { name: repository.name, documents: await repository.list() };
  }, JSON.stringify(fixtureDocument()));
  expect(result.name).toBe('articles');
  expect(result.documents).toHaveLength(1);
});

test('folder handle persistence failure preserves selection and a later retry clears the warning', async ({ page }) => {
  await expect(page.locator('.document-sidebar')).toContainText('保存先: articles');
  await expect(page.locator('.document-sidebar')).not.toContainText('このブラウザに保存');
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'settings') {
        IDBObjectStore.prototype.put = original;
        throw new DOMException('保存先を記憶できません', 'DataCloneError');
      }
      return original.apply(this, args);
    };
  });
  await page.getByRole('button', { name: '保存フォルダーを変更' }).click();
  await expect(page.getByRole('note')).toContainText('保存先を記憶できません');
  await expect(page.getByRole('button', { name: '新規作成', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '保存フォルダーを変更' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('note')).toHaveCount(0);
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.locator('.tiptap').fill('フォルダー選択後の新規文書');
  await page.keyboard.press('Control+s');
  await expect(page.getByRole('status')).toContainText('保存済み');
});

test('legacy migration copies once and retains the IndexedDB original', async ({ page }) => {
  await page.goto('/tests/harness.html');
  await page.evaluate(async text => { await window.createRepositoryTest().create(JSON.parse(text)); }, JSON.stringify(fixtureDocument()));
  await page.goto('/');
  await page.getByRole('button', { name: 'ブラウザ内の記事をコピー' }).click();
  await expect(page.getByRole('status')).toContainText('1件をコピー');
  await expect(page.locator('.document-link')).toHaveCount(1);
  await page.getByRole('button', { name: 'ブラウザ内の記事をコピー' }).click();
  await expect(page.getByRole('status')).toContainText('0件をコピー');
  await page.goto('/tests/harness.html');
  expect(await page.evaluate(async () => (await window.createRepositoryTest().list()).length)).toBe(1);
});

test('folder change guards unsaved edits and picker cancellation retains the original', async ({ page }) => {
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.locator('.tiptap').fill('変更中の本文');
  await page.getByRole('button', { name: '保存フォルダーを変更' }).click();
  await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await expect(page.locator('.tiptap')).toContainText('変更中の本文');
  await page.evaluate(() => {
    Object.defineProperty(window, 'showDirectoryPicker', { value: async () => { throw new DOMException('Cancelled', 'AbortError'); } });
  });
  await page.getByRole('button', { name: '保存フォルダーを変更' }).click();
  await page.getByRole('button', { name: '破棄して移動' }).click();
  await expect(page.getByRole('button', { name: '保存フォルダーを変更' })).toBeEnabled();
  await expect(page.locator('.document-sidebar')).toContainText('保存先: articles');
  await expect(page.locator('.tiptap')).toContainText('変更中の本文');
  await page.keyboard.press('Control+s');
  await expect(page.getByRole('status')).toContainText('保存済み');
});

test('revoked permission keeps edits and reconnect enables retry', async ({ page }) => {
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.locator('.tiptap').fill('権限復旧まで保持');
  await page.evaluate(() => {
    const prototype = FileSystemHandle.prototype as FileSystemHandle & {
      queryPermission: () => Promise<string>; requestPermission: () => Promise<string>;
    };
    const original = prototype.queryPermission;
    prototype.queryPermission = async () => 'denied';
    prototype.requestPermission = async () => { prototype.queryPermission = original; return 'granted'; };
  });
  await page.keyboard.press('Control+s');
  await expect(page.getByRole('status')).toContainText('保存失敗');
  await expect(page.locator('.tiptap')).toContainText('権限復旧まで保持');
  await page.getByRole('button', { name: '保存先に再接続' }).click();
  await page.keyboard.press('Control+s');
  await expect(page.getByRole('status')).toContainText('保存済み');
});
