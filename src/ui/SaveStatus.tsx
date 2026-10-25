import type { SessionState } from '../application/document-session';
export function SaveStatus({ state }: { state: SessionState }) {
  const label = { unsaved: '未保存', saving: '保存中…', saved: '保存済み', error: '保存失敗' }[state.saveState];
  return <span className={`save-status ${state.saveState}`} role="status">{label}</span>;
}
