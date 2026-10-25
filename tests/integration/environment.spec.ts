import { chromium, expect, test } from '@playwright/test';
import { makeProfile, testOrigin } from '../helpers/browser-environment';

test('production page and isolated persistent browser profiles', async () => {
  const firstProfile = await makeProfile();
  const secondProfile = await makeProfile();
  expect(firstProfile).not.toBe(secondProfile);
  const first = await chromium.launchPersistentContext(firstProfile, { headless: true, serviceWorkers: 'allow' });
  try {
    const page = await first.newPage();
    await page.goto(testOrigin);
    await expect(page.getByRole('heading', { name: 'DocSymbi', exact: true })).toBeVisible();
    await page.evaluate(() => localStorage.setItem('profile-probe', 'first'));
  } finally { await first.close(); }
  const second = await chromium.launchPersistentContext(secondProfile, { headless: true, serviceWorkers: 'allow' });
  try {
    const page = await second.newPage();
    await page.goto(testOrigin);
    expect(await page.evaluate(() => localStorage.getItem('profile-probe'))).toBeNull();
  } finally { await second.close(); }
});
