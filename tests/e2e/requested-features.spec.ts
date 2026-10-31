import { expect, test } from '../helpers/folder-page';

test.beforeEach(async ({ page }) => {
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.getByRole('button', { name: '作成して編集を開始', exact: true }).click();
  await expect(page.getByRole('status', { name: '保存状態' })).toContainText('保存済み');
});
test('numbered headings remain headings and slash choices accept Tab', async ({ page }) => {
  const body = page.locator('.tiptap'); await body.click(); await body.pressSequentially('# 1. title');
  await expect(body.locator('h1')).toHaveText('1. title'); await expect(body.locator('ol')).toHaveCount(0);
  await body.press('Enter'); await body.pressSequentially('/heading'); await body.press('Tab'); await body.pressSequentially('2. title');
  await expect(body.locator('h1')).toHaveCount(2); await expect(body.locator('ol')).toHaveCount(0);
});
test('document lock persists and blocks editing until manually unlocked', async ({ page }) => {
  await page.getByRole('button', { name: 'ロック', exact: true }).click();
  await expect(page.getByRole('button', { name: '編集', exact: true })).toBeDisabled();
  await expect(page.locator('.tiptap')).toHaveAttribute('contenteditable', 'false');
  await page.reload(); await expect(page.getByRole('button', { name: '編集', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'ロックを解除', exact: true }).click();
  await page.getByRole('button', { name: '編集', exact: true }).click(); await expect(page.locator('.tiptap')).toHaveAttribute('contenteditable', 'true');
});
test('dark mode and custom save shortcut persist', async ({ page }) => {
  await page.getByRole('button', { name: '設定', exact: true }).click(); const dialog = page.getByRole('dialog', { name: '設定', exact: true });
  await dialog.getByLabel('ダークモード').check(); await dialog.getByLabel('保存のショートカット', { exact: true }).press('Control+Alt+s');
  await dialog.getByRole('button', { name: '保存', exact: true }).click(); await dialog.getByRole('button', { name: '設定を閉じる' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const body = page.locator('.tiptap'); await body.click(); await body.pressSequentially('saved by shortcut'); await body.press('Control+Alt+s');
  await expect(page.getByRole('status', { name: '保存状態' })).toContainText('保存済み'); await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark'); await expect(body).toContainText('saved by shortcut');
  await page.screenshot({ path: 'test-results/dark-mode-review.png' });
});
test('checkbox quizzes require all correct options and can be deleted from context menu and undone', async ({ page }) => {
  await page.getByRole('button', { name: 'クイズを追加', exact: true }).click();
  await page.getByLabel('問題1の回答形式').selectOption('multiple');
  await page.getByLabel('問題1の問題文', { exact: true }).fill('Choose both');
  await page.getByLabel('問題1の選択肢1', { exact: true }).fill('A'); await page.getByLabel('問題1の選択肢2', { exact: true }).fill('B');
  await page.getByLabel('問題1の解説', { exact: true }).fill('Both are correct');
  await page.getByRole('dialog').getByRole('checkbox', { name: '選択肢 2' }).check();
  await page.getByRole('button', { name: 'クイズを適用', exact: true }).click();
  const quiz = page.locator('.quiz-block'); await quiz.getByRole('checkbox', { name: 'A', exact: true }).check(); await expect(quiz.locator('.quiz-feedback')).toContainText('不正解');
  await quiz.getByRole('checkbox', { name: 'B', exact: true }).check(); await expect(quiz.locator('.quiz-feedback')).toContainText('〇 正解');
  await quiz.click({ button: 'right' }); await quiz.getByRole('menuitem', { name: 'クイズを削除' }).click(); await expect(quiz).toHaveCount(0);
  await page.locator('.tiptap').focus(); await page.keyboard.press('Control+z'); await expect(quiz).toHaveCount(1);
  await quiz.getByRole('button', { name: 'クイズを削除', exact: true }).click(); await expect(quiz).toHaveCount(0);
});

test('folder locks protect descendants and prevent creation and deletion', async ({ page }) => {
  await page.getByRole('navigation', { name: 'パンくずリスト' }).getByRole('button', { name: 'ドキュメント', exact: true }).click();
  const root = page.getByRole('navigation', { name: 'フォルダ階層' }).getByRole('button', { name: '▱ articles', exact: true });
  await root.click({ button: 'right' }); await page.getByRole('menuitem', { name: 'ロック', exact: true }).click();
  await page.getByRole('navigation', { name: 'フォルダ階層' }).getByRole('button', { name: '無題の文書', exact: true }).dblclick();
  await expect(page.getByRole('button', { name: '編集', exact: true })).toBeDisabled();
  await page.getByRole('navigation', { name: 'パンくずリスト' }).getByRole('button', { name: 'ドキュメント', exact: true }).click();
  const file = page.getByRole('navigation', { name: 'フォルダ階層' }).getByRole('button', { name: '無題の文書', exact: true });
  await file.click({ button: 'right' }); await page.getByRole('menuitem', { name: 'ファイルを削除' }).click(); await page.getByRole('button', { name: '実行', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('ロック'); await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await root.click({ button: 'right' }); await page.getByRole('menuitem', { name: 'ロックを解除', exact: true }).click();
  await file.dblclick(); await expect(page.getByRole('button', { name: '編集', exact: true })).toBeEnabled();
});
