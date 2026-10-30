import { test, expect } from '../helpers/folder-page';
import { fixtureDocument } from '../fixtures/documents';

test('moving preserves the revision and canonical document and refuses stale revisions', async ({ page }) => {
  await page.goto('/tests/harness.html');
  const result = await page.evaluate(async text => {
    const repository = window.createFileRepositoryTest();
    const document = JSON.parse(text);
    const saved = await repository.create(document);
    await repository.createFolder('target');
    await repository.move(document.id, 'target', saved.revision);
    const after = await repository.get(document.id);
    const rows = await repository.list();
    const changed = await repository.save({ ...document, title: '外部更新' }, saved.revision);
    let error = '';
    try { await repository.move(document.id, '', saved.revision); } catch (failure) { error = (failure as Error).message; }
    return { saved, after, rows, error, final: await repository.get(document.id), changed, finalRows: await repository.list() };
  }, JSON.stringify(fixtureDocument()));
  expect(result.after).toEqual(result.saved);
  expect(result.rows[0]?.folderPath).toBe('target');
  expect(result.error).toContain('変更');
  expect(result.final).toEqual(result.changed);
  expect(result.finalRows[0]?.folderPath).toBe('target');
});

test('a denied destination write leaves the original intact', async ({ page }) => {
  await page.goto('/tests/harness.html');
  const result = await page.evaluate(async text => {
    const repository = window.createFileRepositoryTest();
    const saved = await repository.create(JSON.parse(text));
    await repository.createFolder('target');
    const original = FileSystemFileHandle.prototype.createWritable;
    FileSystemFileHandle.prototype.createWritable = async () => { throw new DOMException('write denied', 'NotAllowedError'); };
    let error = '';
    try { await repository.move(saved.document.id, 'target', saved.revision); } catch (failure) { error = (failure as Error).message; }
    finally { FileSystemFileHandle.prototype.createWritable = original; }
    return { saved, actual: await repository.get(saved.document.id), rows: await repository.list(), error };
  }, JSON.stringify(fixtureDocument()));
  expect(result.error).not.toBe('');
  expect(result.actual).toEqual(result.saved);
  expect(result.rows).toHaveLength(1);
  expect(result.rows[0]?.folderPath).toBe('');
});
