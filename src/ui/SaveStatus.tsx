import type { SessionState } from '../application/document-session';
export function SaveStatus({ state, titleChanged, save, editable = true }: { state: SessionState; titleChanged: boolean; save: () => void; editable?: boolean }) {
  const saving = state.saveState === 'saving';
  const saved = state.saveState === 'saved' && !state.dirty && !titleChanged;
  const label = state.saveState === 'error' ? '保存失敗' : saving ? '保存中…' : saved ? '保存済み' : '未保存';
  return <span className="save-control" role="status" aria-label="保存状態">
    {(!editable || !saved) && <span className={`save-status ${state.saveState}`}>{label}</span>}
    {(editable || !saved) && <button className="primary" disabled={saving || saved} onClick={save}>{saving ? '保存中…' : saved ? '保存済み' : '保存'}</button>}
  </span>;
}
