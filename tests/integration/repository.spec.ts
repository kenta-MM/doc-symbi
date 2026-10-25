import { expect, test } from '@playwright/test';
import { fixtureDocument } from '../fixtures/documents';
import { validateDocument } from '../../src/domain/validate';
test('real IndexedDB create/read, concurrent CAS and stale deletion protection', async ({ page }) => {
  await page.goto('/tests/harness.html');
  const result = await page.evaluate(() => window.checkRepository());
  expect(result.created.revision).toBe(1);
  expect(result.read).toEqual(result.created);
  expect(result.successCount).toBe(1);
  expect(result.failureCode).toBe('Conflict');
  expect(result.latestRevision).toBe(2);
  expect(result.staleCode).toBe('NotFound');
});
test('two independent pages cannot both save the same revision', async ({ context, page }) => {
  const second = await context.newPage();
  await Promise.all([page.goto('/tests/harness.html'), second.goto('/tests/harness.html')]);
  const document = validateDocument(fixtureDocument());
  await page.evaluate(async text => { await window.createRepositoryTest().create(JSON.parse(text)); }, JSON.stringify(document));
  const save = (target: typeof page, title: string) => target.evaluate(async ({ text, title }) => {
    try { await window.createRepositoryTest().save({ ...JSON.parse(text), title }, 1); return 'success'; }
    catch (error) { return (error as { code: string }).code; }
  }, { text: JSON.stringify(document), title });
  expect((await Promise.all([save(page, 'first'), save(second, 'second')])).sort()).toEqual(['Conflict', 'success']);
});
test('unknown database version is rejected without deleting its contents', async ({ page }) => {
  await page.goto('/tests/harness.html');
  const result = await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('docsymbi', 2);
      request.onupgradeneeded = () => request.result.createObjectStore('sentinel').put('preserved', 'key');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { request.result.close(); resolve(); };
    });
    let code = '';
    try { await window.createRepositoryTest().list(); } catch (error) { code = (error as { code: string }).code; }
    const value = await new Promise<unknown>((resolve, reject) => {
      const request = indexedDB.open('docsymbi', 2);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { const db = request.result; const read = db.transaction('sentinel').objectStore('sentinel').get('key'); read.onsuccess = () => { resolve(read.result); db.close(); }; };
    });
    return { code, value };
  });
  expect(result).toEqual({ code: 'StorageUnavailable', value: 'preserved' });
});
test('quota and abort leave the last successful record unchanged', async ({ page }) => {
  await page.goto('/tests/harness.html');
  const result = await page.evaluate(() => window.checkRepositoryFailures());
  expect(result.codes).toEqual(['QuotaExceeded', 'Aborted']);
  expect(result.stored).toEqual({ document: result.document, revision: 1 });
});
test('blocked notification fails safely and a corrupt record is never silently deleted', async ({ page }) => {
  await page.goto('/tests/harness.html');
  expect(await page.evaluate(() => window.checkBlockedOpen())).toBe('StorageUnavailable');
  const document = validateDocument(fixtureDocument());
  await page.evaluate(async text => { await window.createRepositoryTest().create(JSON.parse(text)); }, JSON.stringify(document));
  const result = await page.evaluate(async id => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('docsymbi', 1);
      request.onsuccess = () => {
        const db = request.result; const transaction = db.transaction('documents', 'readwrite');
        transaction.objectStore('documents').put({ document: { id }, revision: 1 });
        transaction.oncomplete = () => { db.close(); resolve(); }; transaction.onabort = () => reject(transaction.error);
      };
    });
    const codes: string[] = [];
    const repository = window.createRepositoryTest();
    for (const operation of [() => repository.get(id), () => repository.list()]) {
      try { await operation(); } catch (error) { codes.push((error as { code: string }).code); }
    }
    return codes;
  }, document.id);
  expect(result).toEqual(['ValidationFailed', 'ValidationFailed']);
});
