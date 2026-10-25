import type { DocumentSession, SessionState } from './document-session';
export function requiresNavigationGuard(state: SessionState): boolean {
  return state.dirty || state.saveState === 'saving' || state.saveState === 'error';
}
export async function resolveNavigation(choice: 'save' | 'discard' | 'cancel', session: DocumentSession, action: () => void | Promise<void>): Promise<void> {
  if (choice === 'cancel') return;
  if (choice === 'save') await session.save();
  if (choice === 'discard' && session.state.saveState === 'saving') throw new Error('保存の完了を待ってください');
  await action();
}
