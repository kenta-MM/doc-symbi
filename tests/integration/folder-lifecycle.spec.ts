import { test, expect } from '../helpers/folder-page';
import { fixtureDocument } from '../fixtures/documents';
import { test as freshTest } from '@playwright/test';

freshTest('browser storage survives initial folder selection and can be copied when handle persistence fails', async ({ page }) => {
  await page.goto('/tests/harness.html');
  await page.evaluate(async text => { await window.createRepositoryTest().create(JSON.parse(text)); }, JSON.stringify(fixtureDocument()));
  await page.evaluate(() => {
    Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: async () =>
      (await navigator.storage.getDirectory()).getDirectoryHandle('first-selection', { create: true }) });
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'settings') throw new DOMException('Handle cannot be cloned', 'DataCloneError');
      return original.apply(this, args);
    };
  });
  const result = await page.evaluate(async () => {
    const repository = window.createFileRepositoryTest(true);
    await repository.choose();
    const count = await repository.migrate();
    const rows = await repository.list();
    return { name: repository.name, warning: repository.warning, count, document: (await repository.get(rows[0]!.id)).document };
  });
  expect(result.warning).toContain('次回用の保存先を記憶できませんでした');
  expect(result.name).toBe('first-selection');
  expect(result.count).toBe(1);
  expect(result.document).toEqual(fixtureDocument());
  expect(await page.evaluate(async () => (await window.createRepositoryTest().list()).length)).toBe(1);
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
  await expect(page.locator('.tiptap')).toHaveAttribute('contenteditable', 'false');
  await expect(page.locator('.document-title')).toContainText(fixtureDocument().title);
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
  await page.goto('/tests/harness.html');
  await page.evaluate(() => {
    Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: async () =>
      (await navigator.storage.getDirectory()).getDirectoryHandle('articles', { create: true }) });
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'settings') {
        IDBObjectStore.prototype.put = original;
        throw new DOMException('保存先を記憶できません', 'DataCloneError');
      }
      return original.apply(this, args);
    };
  });
  const result = await page.evaluate(async text => {
    const document = JSON.parse(text);
    const repository = window.createFileRepositoryTest();
    await repository.choose();
    const warning = repository.warning;
    await repository.create(document);
    await repository.choose();
    return { warning, after: repository.warning, name: repository.name, document: (await repository.get(document.id)).document };
  }, JSON.stringify(fixtureDocument()));
  expect(result.warning).toContain('保存先を記憶できません');
  expect(result.after).toBeNull();
  expect(result.name).toBe('articles');
  expect(result.document).toEqual(fixtureDocument());
});

test('legacy migration copies once and retains the IndexedDB original', async ({ page }) => {
  await page.goto('/tests/harness.html');
  await page.evaluate(async text => { await window.createRepositoryTest().create(JSON.parse(text)); }, JSON.stringify(fixtureDocument()));
  const counts = await page.evaluate(async () => {
    const repository = window.createFileRepositoryTest(true);
    await repository.restore();
    return [await repository.migrate(), await repository.migrate(), (await repository.list()).length];
  });
  expect(counts).toEqual([1, 0, 1]);
  expect(await page.evaluate(async () => (await window.createRepositoryTest().list()).length)).toBe(1);
});

test('returning to folders guards unsaved edits and picker cancellation retains the original', async ({ page }) => {
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.getByRole('button', { name: '作成して編集を開始', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '保存済み' })).toBeVisible();
  await page.locator('.tiptap').fill('変更中の本文');
  await page.getByRole('button', { name: 'DocSymbi', exact: true }).click();
  await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await expect(page.locator('.tiptap')).toContainText('変更中の本文');
  await page.keyboard.press('Control+s');
  await expect(page.getByRole('status')).toContainText('保存済み');
  await page.goto('/tests/harness.html');
  const result = await page.evaluate(async () => {
    const repository = window.createFileRepositoryTest();
    await repository.restore();
    const before = await repository.list();
    Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: async () => { throw new DOMException('Cancelled', 'AbortError'); } });
    let error = '';
    try { await repository.choose(); } catch (failure) { error = (failure as Error).name; }
    return { error, name: repository.name, before, after: await repository.list() };
  });
  expect(result.error).toBe('AbortError');
  expect(result.name).toBe('articles');
  expect(result.after).toEqual(result.before);
});

test('revoked permission keeps edits and reconnect enables retry', async ({ page }) => {
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.getByRole('button', { name: '作成して編集を開始', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '保存済み' })).toBeVisible();
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
