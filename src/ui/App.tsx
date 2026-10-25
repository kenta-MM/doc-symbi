import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { DocumentSession } from '../application/document-session';
import type { DocumentSummary } from '../application/ports/document-repository';
import type { EditorPort, EditorCommand } from '../application/ports/editor';
import { EditorPane } from './EditorPane';
import { SaveStatus } from './SaveStatus';
import { BlockToolbar } from './BlockToolbar';
import { DocumentList } from './DocumentList';
import { DocumentDialog } from './DocumentDialogs';
import { useUnsavedWarning } from './use-unsaved-warning';
import { requiresNavigationGuard, resolveNavigation } from '../application/navigation-guard';
import { deleteCurrentDocument } from '../application/document-management';
import { FileTransfer } from './FileTransfer';
import { StorageStatus } from './StorageStatus';
import { OfflineStatus } from './OfflineStatus';
import { Outline } from './Outline';
import { HistoryToolbar } from './HistoryToolbar';

export function App({ session, createEditor }: { session: DocumentSession; createEditor: (host: HTMLElement) => EditorPort }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [editor, setEditor] = useState<EditorPort | null>(null);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [pending, setPending] = useState<(() => void | Promise<void>) | null>(null);
  const [deleting, setDeleting] = useState(false);
  useUnsavedWarning(requiresNavigationGuard(state));
  const connect = useCallback((value: EditorPort | null) => setEditor(value), []);
  const refresh = useCallback(async () => { setDocuments(await session.repository.list()); }, [session]);
  const report = useCallback((error: unknown) => setError(error instanceof Error ? error.message : '操作を完了できません'), []);
  const save = useCallback(async () => { try { await session.save(); await refresh(); setError(''); } catch (error) { report(error); } }, [session, refresh, report]);
  useEffect(() => { void refresh().catch(report); }, [refresh, report]);
  useEffect(() => {
    const rejected = (event: Event) => report(new Error((event as CustomEvent<string>).detail));
    window.addEventListener('editor-error', rejected);
    return () => window.removeEventListener('editor-error', rejected);
  }, [report]);
  useEffect(() => { setTitle(state.document?.title ?? ''); }, [state.document?.title]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); if (state.document) void save(); } };
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('keydown', key); };
  }, [state.dirty, state.saveState, state.document, save]);
  function navigate(action: () => void | Promise<void>) {
    if (requiresNavigationGuard(state)) setPending(() => action);
    else void Promise.resolve().then(action).catch(report);
  }
  function execute(command: EditorCommand) { try { editor?.execute(command, session.environment); setError(''); } catch (error) { report(error); } }
  return <div className="app-shell">
    <header className="app-header"><div><span className="brand-mark">D</span><h1>DocSymbi</h1><span className="tagline">構造から、伝わるドキュメントへ。</span></div>
      <button className="primary" onClick={() => navigate(() => session.create('無題の文書'))}>新規作成</button></header>
    <div className="workspace"><DocumentList documents={documents} activeId={state.document?.id} open={id => navigate(() => session.load(id))} /><main className="document-main">
      {(error || state.error) && <div role="alert" className="error-banner">{error || state.error?.message}<button onClick={() => void save()}>保存を再試行</button></div>}
      {!state.document ? <div className="welcome"><span className="eyebrow">YOUR LOCAL WORKSPACE</span><h2>考えを、構造に。</h2><p>文書を選ぶか、新しい文書を作成してください。</p><p className="muted">文書はこのブラウザ内に保存されます。</p></div> : <>
        <div className="document-heading"><input aria-label="文書名" value={title} onChange={event => setTitle(event.target.value)} onBlur={() => { try { session.rename(title); } catch (error) { report(error); setTitle(state.document!.title); } }} />
          <div className="document-actions"><SaveStatus state={state} /><button className="primary" disabled={state.saveState === 'saving'} onClick={() => void save()}>保存</button><button onClick={() => setDeleting(true)}>文書を削除</button></div>
        </div>
        <HistoryToolbar editor={editor} />
        <BlockToolbar document={state.document} execute={execute} environment={session.environment} />
        <div className="editing-layout"><EditorPane document={state.document} createEditor={createEditor} connect={connect} /><Outline document={state.document} focus={id => editor?.focusHeading(id)} /></div>
      </>}
    </main></div>
    <footer className="app-footer"><FileTransfer session={session} navigate={navigate} refreshed={refresh} report={report} /><StorageStatus /><OfflineStatus updateSafely={update => navigate(() => { session.close(); update(); })} /></footer>
    {pending && <DocumentDialog label="未保存の変更"><h2>変更を保存しますか？</h2><p>移動前に、編集中の文書の扱いを選んでください。</p>
      <button onClick={() => setPending(null)}>キャンセル</button>
      <button disabled={state.saveState === 'saving'} onClick={() => { const action = pending; setPending(null); void Promise.resolve().then(action).catch(report); }}>破棄して移動</button>
      <button className="primary" onClick={() => { void resolveNavigation('save', session, async () => { await refresh(); const action = pending; setPending(null); await action(); }).catch(report); }}>保存して移動</button>
    </DocumentDialog>}
    {deleting && state.document && <DocumentDialog label="文書の削除"><h2>「{state.document.title}」を削除しますか？</h2><p>{state.document.id}</p><p>未保存の変更も削除されます。</p><button onClick={() => setDeleting(false)}>キャンセル</button><button onClick={() => {

      void deleteCurrentDocument(session).then(() => { setDeleting(false); return refresh(); }).catch(report);
    }}>削除する</button></DocumentDialog>}
  </div>;
}
