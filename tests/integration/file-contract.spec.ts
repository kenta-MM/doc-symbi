import { expect, test } from '../helpers/folder-page';
import { fixtureDocument } from '../fixtures/documents';
import { validateDocument } from '../../src/domain/validate';

test('24 documents survive ten editor/file save/read cycles', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/tests/harness.html');
  expect(await page.evaluate(() => window.checkEditSaveRoundTrips('files'))).toBe(240);
});

test('two pages share file CAS and stale delete/save never restores deleted content', async ({ page, context }) => {
  await page.goto('/tests/harness.html');
  const initial = await page.evaluate(async json => JSON.stringify(await window.createFileRepositoryTest().create(JSON.parse(json))), JSON.stringify(validateDocument(fixtureDocument())));
  const other = await context.newPage(); await other.goto('/tests/harness.html');
  const results = await Promise.all([page, other].map((target, index) => target.evaluate(async ({ initial, index }) => {
    const stored = JSON.parse(initial);
    try { await window.createFileRepositoryTest().save({ ...stored.document, title: `writer ${index}` }, stored.revision); return 'saved'; }
    catch (error) { return (error as { code: string }).code; }
  }, { initial, index })));
  expect(results.sort()).toEqual(['Conflict', 'saved']);
  const failures = await page.evaluate(async json => {
    const initial = JSON.parse(json);
    const repository = window.createFileRepositoryTest();
    const latest = await repository.get(initial.document.id);
    const codes: string[] = [];
    try { await repository.delete(initial.document.id, initial.revision); } catch (error) { codes.push((error as { code: string }).code); }
    await repository.delete(latest.document.id, latest.revision);
    try { await repository.save(initial.document, initial.revision); } catch (error) { codes.push((error as { code: string }).code); }
    return { codes, remaining: await repository.list() };
  }, initial);
  expect(failures).toEqual({ codes: ['Conflict', 'NotFound'], remaining: [] });
  await other.close();
});

test('quota, abort and malformed files expose typed failures without corrupting saved data', async ({ page }) => {
  await page.goto('/tests/harness.html');
  const result = await page.evaluate(async json => {
    const document = JSON.parse(json);
    const repository = window.createFileRepositoryTest();
    const stored = await repository.create(document);
    const original = FileSystemFileHandle.prototype.createWritable;
    const codes: string[] = [];
    for (const name of ['QuotaExceededError', 'AbortError']) {
      FileSystemFileHandle.prototype.createWritable = async function (...args) {
        if (name === 'QuotaExceededError') throw new DOMException('full', name);
        const stream = await original.apply(this, args);
        stream.close = async () => { throw new DOMException('interrupted', name); };
        return stream;
      };
      try { await repository.save({ ...document, title: 'must not persist' }, stored.revision); }
      catch (error) { codes.push((error as { code: string }).code); }
      finally { FileSystemFileHandle.prototype.createWritable = original; }
    }
    const unchanged = await repository.get(document.id);
    const directory = await (await navigator.storage.getDirectory()).getDirectoryHandle('articles');
    const bad = await directory.getFileHandle('broken.docsymbi.json', { create: true });
    const writer = await bad.createWritable(); await writer.write('{broken'); await writer.close();
    const errors: { code: string; message: string }[] = [];
    for (const read of [() => repository.list(), () => repository.get(document.id)]) {
      try { await read(); } catch (error) { errors.push({ code: (error as { code: string }).code, message: (error as Error).message }); }
    }
    return { codes, unchanged, stored, errors, badText: await (await bad.getFile()).text() };
  }, JSON.stringify(validateDocument(fixtureDocument())));
  expect(result.codes).toEqual(['QuotaExceeded', 'Aborted']);
  expect(result.unchanged).toEqual(result.stored);
  expect(result.errors).toHaveLength(2);
  for (const error of result.errors) { expect(error.code).toBe('ValidationFailed'); expect(error.message).toContain('broken.docsymbi.json'); }
  expect(result.badText).toBe('{broken');
});
