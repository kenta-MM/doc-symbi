import { expect, test } from '@playwright/test';
import { fixtureDocument } from '../fixtures/documents';
test('list ordering and rename/delete CAS preserve other documents', async ({ page }) => {
  await page.goto('/tests/harness.html');
  const first = fixtureDocument();
  const second = { ...fixtureDocument(1), id: 'ffffffff-ffff-4fff-8fff-ffffffffffff' };
  const result = await page.evaluate(async text => {
    const [first, second] = JSON.parse(text);
    const repository = window.createRepositoryTest();
    await repository.create(first); await repository.create(second);
    const initial = await repository.list();
    await repository.save({ ...first, title: 'renamed', updatedAt: '2027-01-01T00:00:00Z' }, 1);
    let staleDelete = '';
    try { await repository.delete(first.id, 1); } catch (error) { staleDelete = (error as { code: string }).code; }
    const ordered = await repository.list();
    await repository.delete(first.id, 2);
    return { initial, ordered, staleDelete, remaining: (await repository.get(second.id)).document };
  }, JSON.stringify([first, second]));
  expect(result.initial.map(value => value.id)).toEqual([first.id, second.id]);
  expect(result.ordered[0]!.title).toBe('renamed');
  expect(result.staleDelete).toBe('Conflict'); expect(result.remaining).toEqual(second);
});
