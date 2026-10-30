import { test, expect } from '@playwright/test';

test('streams a reply, continues the conversation, and keeps Claude disabled', async ({ page }) => {
  await page.route('**/api/ai/status', route => route.fulfill({ json: { connected: true, models: [{ id: 'test-model', name: 'Test model', isDefault: true }] } }));
  const requests: { conversationId: string; message: string; model: string }[] = [];
  await page.route('**/api/ai/chat', async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ contentType: 'application/x-ndjson', body: '{"type":"delta","text":"文書の案です。","itemId":"reply"}\n{"type":"done","status":"completed"}\n' });
  });
  await page.goto('/');
  await page.getByLabel('AIモデル').selectOption('test-model');
  const input = page.getByRole('textbox', { name: 'AIへの依頼' });
  await input.fill('導入文を書いて');
  await page.getByRole('button', { name: 'AIに送信', exact: true }).click();
  await expect(page.locator('.ai-message-assistant')).toHaveText('Codex文書の案です。');
  await input.fill('短くして');
  await input.press('Control+Enter');
  await expect(page.locator('.ai-message-assistant')).toHaveCount(2);
  expect(requests[1]?.conversationId).toBe(requests[0]?.conversationId);
  expect(requests[0]?.model).toBe('test-model');
  await page.getByRole('button', { name: '新しい会話' }).click();
  await expect(page.locator('.ai-message')).toHaveCount(0);
  await page.getByLabel('チャットで使うAI').selectOption('claude');
  await input.fill('依頼');
  await expect(page.getByRole('button', { name: 'AIに送信', exact: true })).toBeDisabled();
});

test('shows connection failures and can reconnect', async ({ page }) => {
  await page.route('**/api/ai/status', route => route.fulfill({ json: { connected: false, models: [], error: 'codex login を実行してください。' } }));
  await page.goto('/');
  await expect(page.getByText('codex login を実行してください。', { exact: true })).toBeVisible();
  await page.route('**/api/ai/status', route => route.fulfill({ json: { connected: true, models: [] } }));
  await page.getByRole('button', { name: '再接続', exact: true }).click();
  await expect(page.getByText('接続済み', { exact: true })).toBeVisible();
});

test('can stop a pending response and shows interrupted streams as errors', async ({ page }) => {
  await page.route('**/api/ai/status', route => route.fulfill({ json: { connected: true, models: [] } }));
  await page.route('**/api/ai/chat', () => {});
  await page.goto('/');
  await expect(page.getByText('接続済み', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'AIへの依頼' }).fill('文書を書いて');
  await page.getByRole('button', { name: 'AIに送信', exact: true }).click();
  await page.getByRole('button', { name: '停止', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('生成を停止しました。');
  await page.route('**/api/ai/chat', route => route.fulfill({ contentType: 'application/x-ndjson', body: '{"type":"delta","text":"途中の応答","itemId":"reply"}\n' }));
  await page.getByRole('textbox', { name: 'AIへの依頼' }).fill('もう一度');
  await page.getByRole('button', { name: 'AIに送信', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('応答の途中で接続が切れました。');
});
