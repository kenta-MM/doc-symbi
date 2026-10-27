import type { SessionState } from '../application/document-session';
export function SaveStatus({ state, titleChanged, save, editable = true }: { state: SessionState; titleChanged: boolean; save: () => void; editable?: boolean }) {
  const saving = state.saveState === 'saving';
  const saved = state.saveState === 'saved' && !state.dirty && !titleChanged;
  if (!editable && saved) return null;
  return <span className="save-control" role="status">
    {state.saveState === 'error' ? <span className="sr-only">保存失敗</span> : !saved && !saving && <span className="sr-only">未保存</span>}
    <button className="primary" disabled={saving || saved} onClick={save}>{saving ? '保存中…' : saved ? '保存済み' : '保存'}</button>
  </span>;
}
