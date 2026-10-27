import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { cpus, totalmem, version, release } from 'node:os';
import { performanceDocument } from '../fixtures/performance-document';
test('20 raw measurements of 1000-block / 100000-character editing', async ({ page, browser }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  const document = performanceDocument();
  await page.goto('/');
  await page.getByLabel('文書を読み込む').setInputFiles({ name: 'performance.docsymbi.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document)) });
  await expect(page.getByRole('textbox', { name: '文書名' })).toHaveValue(document.title);
  await expect(page.locator('.document-link')).toBeVisible();
  page.on('dialog', dialog => dialog.accept());
  const rows: { run: number; display: number; navigation: number; input: number }[] = [];
  const now = () => page.evaluate(() => performance.now());
  const painted = () => page.evaluate(() => new Promise<number>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now())))));
  for (let run = 1; run <= 20; run++) {
    await page.reload(); await expect(page.locator('.document-link')).toBeVisible();
    const start = await now(); await page.locator('.document-link').click();
    await expect(page.locator('.tiptap > *')).toHaveCount(1000);
    const display = await painted() - start;
    await page.getByRole('button', { name: '編集', exact: true }).click();
    const navigationStart = await now(); await page.locator('.outline button').last().click();
    await expect(page.locator('.tiptap > h1, .tiptap > h2, .tiptap > h3, .tiptap > h4, .tiptap > h5, .tiptap > h6').last()).toBeInViewport();
    const navigation = await painted() - navigationStart;
    await page.evaluate(() => {
      performance.clearMarks('input-start'); performance.clearMarks('input-painted'); performance.clearMeasures('input-latency');
      window.document.addEventListener('beforeinput', () => {
        performance.mark('input-start');
        requestAnimationFrame(() => requestAnimationFrame(() => {
          performance.mark('input-painted'); performance.measure('input-latency', 'input-start', 'input-painted');
        }));
      }, { once: true });
    });
    await page.keyboard.insertText('あ');
    await expect.poll(() => page.evaluate(() => performance.getEntriesByName('input-latency').length)).toBe(1);
    const input = await page.evaluate(() => performance.getEntriesByName('input-latency')[0]!.duration);
    rows.push({ run, display, navigation, input });
  }
  const counts = { display: rows.filter(row => row.display <= 2000).length, navigation: rows.filter(row => row.navigation <= 1000).length, input: rows.filter(row => row.input <= 100).length };
  const environment = { os: version(), release: release(), cpu: cpus()[0]?.model, memoryGiB: totalmem() / 1024 ** 3, browser: browser.version(), viewport: '1920x1080', mode: 'headless Chromium, production-mode test build', measuredAt: new Date().toISOString() };
  const report = { environment, counts, rows };
  await writeFile('specs/001-structured-editor-mvp/validation/performance.json', JSON.stringify(report, null, 2));
  await writeFile('specs/001-structured-editor-mvp/validation/performance.md', `# Performance measurements\n\nActual environment (not automatically the specified reference machine):\n\n\`\`\`json\n${JSON.stringify(environment, null, 2)}\n\`\`\`\n\nCounts within display 2000ms / navigation 1000ms / input 100ms: ${JSON.stringify(counts)}.\n\n| Run | Display ms | Navigation ms | Input ms |\n| --- | ---: | ---: | ---: |\n${rows.map(row => `| ${row.run} | ${row.display.toFixed(2)} | ${row.navigation.toFixed(2)} | ${row.input.toFixed(2)} |`).join('\n')}\n\nAll raw values retained. Display/navigation include Playwright interaction; input measures browser beforeinput to the second animation frame.\nReference-device acceptance, AC/power mode and real stable Chrome/Edge remain unverified.\n`);
  expect(counts.display).toBeGreaterThanOrEqual(19); expect(counts.navigation).toBeGreaterThanOrEqual(19); expect(counts.input).toBeGreaterThanOrEqual(19);
});
