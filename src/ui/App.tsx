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
import type { FolderStorage } from '../application/ports/folder-storage';
import { Icon } from './Icon';

export function App({ session, createEditor, storage }: { session: DocumentSession; createEditor: (host: HTMLElement) => EditorPort; storage?: FolderStorage }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [editor, setEditor] = useState<EditorPort | null>(null);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [pending, setPending] = useState<(() => void | Promise<void>) | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [folder, setFolder] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState(!storage);
  const [storageBusy, setStorageBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const editable = !!state.document && editingId === state.document.id;
  useUnsavedWarning(requiresNavigationGuard(state));
  const connect = useCallback((value: EditorPort | null) => setEditor(value), []);
  const refresh = useCallback(async () => { setDocuments(await session.repository.list()); }, [session]);
  const resume = useCallback(async () => {
    const initial = session.state;
    const available = await session.repository.list();
    setDocuments(available);
    if (initial.document || session.state !== initial) return;
    let lastId: string | null = null;
    try { lastId = localStorage.getItem(`docsymbi:last-document:${storage?.name ?? 'browser'}`); } catch { /* Remembering is optional. */ }
    const target = available.find(document => document.id === lastId) ?? available[0];
    if (target) { setEditingId(null); await session.load(target.id, initial); }
  }, [session, storage]);
  const report = useCallback((error: unknown) => setError(error instanceof Error ? error.message : '操作を完了できません'), []);
  const save = useCallback(async () => { try { if (session.state.document && title !== session.state.document.title) session.rename(title); await session.save(); await refresh(); setError(''); } catch (error) { report(error); } }, [session, title, refresh, report]);
  useEffect(() => {
    void (async () => {
      try { await storage?.restore(); setFolder(storage?.name ?? null); await resume(); }
      catch (error) { report(error); }
      finally { setStorageReady(true); }
    })();
  }, [storage, resume, report]);
  useEffect(() => {
    if (!state.document || state.baseRevision === null) return;
    try { localStorage.setItem(`docsymbi:last-document:${storage?.name ?? 'browser'}`, state.document.id); } catch { /* Reading and editing still work without preferences. */ }
  }, [state.document, state.baseRevision, storage, folder]);
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
  function execute(command: EditorCommand) { try { if (!editable) return; editor?.execute(command, session.environment); setError(''); } catch (error) { report(error); } }
  async function chooseFolder() {
    if (!storage) return;
    const changingFolder = storage.name !== null;
    setStorageBusy(true);
    try {
      await storage.choose();
      // Initial selection must keep the draft that needs a save destination.
      if (changingFolder) session.close();
      setFolder(storage.name); setDocuments([]);
      await resume(); setError(''); setNotice('');
    } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) report(error); }
    finally { setStorageBusy(false); }
  }
  return <div className="app-shell">
    <header className="app-header"><div><span className="brand-mark">D</span><h1>DocSymbi</h1><span className="tagline">構造から、伝わるドキュメントへ。</span></div>
      <div className="header-actions"><button className="icon-button" aria-label="使い方" onClick={() => setHelp(true)}><Icon name="help" /></button><button className="primary" disabled={storageBusy} onClick={() => navigate(() => { session.create('無題の文書'); setEditingId(session.state.document!.id); })}>新規作成</button></div></header>
    <div className="workspace-toolbar">
    {storage && <div className="storage-status" aria-label="記事の保存先">
      <span className="folder-label" title={folder ?? '保存フォルダー未選択'}><Icon name="folder" /><span>保存先: <strong>{folder ?? '未選択'}</strong></span></span>
      <button disabled={!storageReady || storageBusy || state.saveState === 'saving' || !storage.supported} onClick={() => {
        if (storage.name) navigate(chooseFolder);
        else void chooseFolder();
      }}><Icon name="folder" />{folder ? '保存フォルダーを変更' : '保存フォルダーを選択'}</button>
      {folder && <><button disabled={storageBusy} onClick={() => {
        setStorageBusy(true);
        void storage.reconnect().then(resume).then(() => setError('')).catch(report).finally(() => setStorageBusy(false));
      }}><Icon name="refresh" />保存先に再接続</button>
        <button disabled={storageBusy || state.saveState === 'saving'} onClick={() => {
          setStorageBusy(true);
          void storage.migrate().then(async count => { await refresh(); setNotice(`${count}件をコピーしました。同じIDの記事はスキップし、ブラウザ内の元データは保持します。`); }).catch(report).finally(() => setStorageBusy(false));
        }}><Icon name="file" />ブラウザ内の記事をコピー</button></>}
    </div>}
    {state.document && <div className="document-heading">{editable && <input aria-label="文書名" title={title} value={title} onChange={event => setTitle(event.target.value)} onBlur={() => { if (!editable) return; try { session.rename(title); } catch (error) { report(error); setTitle(state.document!.title); } }} />}
      <div className="document-actions"><span className="mode-label">{editable ? '編集モード' : 'ビューモード'}</span><button onClick={() => setEditingId(editable ? null : state.document!.id)}>{editable ? '編集を終了' : '編集'}</button><SaveStatus editable={editable} state={state} titleChanged={title !== state.document.title} save={() => void save()} />{editable && <button onClick={() => setDeleting(true)}>文書を削除</button>}</div>
    </div>}
    </div>
    {storage && !storage.supported && <p className="storage-warning">フォルダー保存にはデスクトップ版ChromeまたはEdgeを使用してください。</p>}
    {notice && <p className="storage-warning" role="status">{notice}</p>}
    {storage?.warning && <p className="storage-warning" role="note">{storage.warning}</p>}
    <div className="workspace"><DocumentList documents={documents} activeId={state.document?.id} open={id => navigate(async () => { await session.load(id); setEditingId(null); })} storageLabel={storage ? (folder ? `保存先: ${folder}` : '保存フォルダー未選択') : 'このブラウザに保存'} /><main className="document-main">
      {(error || state.error) && <div role="alert" className="error-banner">{error || state.error?.message}{state.document && state.saveState === 'error' && <button onClick={() => void save()}>保存を再試行</button>}</div>}
      {!state.document ? <div className="welcome"><span className="eyebrow">YOUR LOCAL WORKSPACE</span><h2>考えを、構造に。</h2><p>文書を選ぶか、新しい文書を作成してください。</p><p className="muted">{storage ? '選択したフォルダーに、1記事1ファイルで保存します。' : '文書はこのブラウザ内に保存されます。'}</p></div> : <>
        <div className="editing-layout"><div className="document-canvas">
          {editable && <HistoryToolbar editor={editor} />}
          {editable && <BlockToolbar key={state.document.id} document={state.document} execute={execute} environment={session.environment} applyHeading={() => editor?.applyHeading()} />}
          <EditorPane editable={editable} document={state.document} createEditor={createEditor} connect={connect} />
        </div><Outline key={state.document.id} document={state.document} focus={id => editor?.focusHeading(id)} /></div>
      </>}
    </main></div>
    <footer className="app-footer"><FileTransfer editable={editable} loaded={() => setEditingId(null)} session={session} navigate={navigate} refreshed={refresh} report={report} />{!storage && <StorageStatus />}<OfflineStatus updateSafely={update => navigate(() => { session.close(); update(); })} /></footer>
    {help && <DocumentDialog label="使い方"><h2>DocSymbiの使い方</h2><p>左の一覧で文書を選び、右のアウトラインから読みたい節に移動できます。文書名の検索と並び替えも使えます。</p><p>「編集」で本文や文書名を変更し、「保存」で保存します。「編集を終了」は閲覧への切り替えで、自動保存はしません。</p><p>保存先へのアクセス許可を求められたときは「保存先に再接続」を選んでください。接続後は前回の記事を自動で開きます。</p><button onClick={() => setHelp(false)}>閉じる</button></DocumentDialog>}
    {pending && <DocumentDialog label="未保存の変更"><h2>変更を保存しますか？</h2><p>移動前に、編集中の文書の扱いを選んでください。</p>
      <button onClick={() => setPending(null)}>キャンセル</button>
      <button disabled={state.saveState === 'saving'} onClick={() => { const action = pending; setPending(null); void Promise.resolve().then(action).catch(report); }}>破棄して移動</button>
      <button className="primary" onClick={() => { void resolveNavigation('save', session, async () => { await refresh(); const action = pending; setPending(null); await action(); }).catch(report); }}>保存して移動</button>
    </DocumentDialog>}
    {deleting && state.document && <DocumentDialog label="文書の削除"><h2>「{state.document.title}」を削除しますか？</h2><p>{state.document.id}</p><p>{storage ? '保存先の記事ファイルと未保存の変更を削除します。この操作は元に戻せません。' : '未保存の変更も削除されます。'}</p><button onClick={() => setDeleting(false)}>キャンセル</button><button onClick={() => {

      void deleteCurrentDocument(session).then(() => { setDeleting(false); return refresh(); }).catch(report);
    }}>削除する</button></DocumentDialog>}
  </div>;
}

