import { expect, test } from '../helpers/folder-page';
import { fixtureDocument } from '../fixtures/documents';
test('import validates before storage, preserves IDs and rejects collisions', async ({ page }) => {
  await page.goto('/');
  const input = page.getByLabel('文書を読み込む');
  const document = fixtureDocument(1);
  await input.setInputFiles({ name: 'fixture.docsymbi.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document)) });
  await expect(page.locator('.document-title')).toContainText(document.title);
  await input.setInputFiles({ name: 'duplicate.docsymbi.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document)) });
  await expect(page.getByRole('alert')).toContainText('同じ ID');
  await expect(page.locator('.document-title')).toHaveCount(1);
});

