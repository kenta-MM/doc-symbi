import { useState } from 'react';
import { DocumentDialog } from './DocumentDialogs';

export function SaveTemplate({ title, save, close }: { title: string; save: (name: string) => Promise<void>; close: () => void }) {
  const [name, setName] = useState(`${title}（テンプレート）`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <DocumentDialog label="テンプレートとして保存" close={() => { if (!busy) close(); }}>
    <h2>テンプレートとして保存</h2>
    <p>現在の本文（未保存の編集を含む）を、同じフォルダにひな形として保存します。一覧から開いて編集・削除できます。</p>
    <form onSubmit={event => {
      event.preventDefault(); setBusy(true); setError('');
      void save(name.trim()).then(close).catch(error => setError(error instanceof Error ? error.message : '保存できません')).finally(() => setBusy(false));
    }}><label>テンプレート名<input aria-label="テンプレート名" value={name} onChange={event => setName(event.target.value)} required disabled={busy} /></label>
      {error && <p role="alert">{error}</p>}
      <button type="button" disabled={busy} onClick={close}>キャンセル</button>
      <button type="submit" disabled={busy || !name.trim()}>{busy ? '保存中…' : 'テンプレートを保存'}</button>
    </form>
  </DocumentDialog>;
}
