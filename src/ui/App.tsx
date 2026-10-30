import type { CSSProperties } from 'react';
import { SidebarResizeHandle } from './SidebarResizeHandle';
import { registerOffline } from '../offline/register';
import { renameDocument } from '../domain/document';
import { CreationMenu, type CreationTarget } from './CreationMenu';
import { documentProperties, pathParts } from '../domain/catalog';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { DocumentSession } from '../application/document-session';
import type { DocumentSummary } from '../application/ports/document-repository';
import type { EditorPort } from '../application/ports/editor';
import { EditorPane } from './EditorPane';
import { SaveStatus } from './SaveStatus';
import { BlockToolbar } from './BlockToolbar';
import { DocumentCatalog } from './DocumentCatalog';
import { FolderNavigation } from './FolderNavigation';
import { DocumentProperties } from './DocumentProperties';
import { NewDocument } from './NewDocument';
import { DocumentDialog } from './DocumentDialogs';
import { useUnsavedWarning } from './use-unsaved-warning';
import { requiresNavigationGuard, resolveNavigation } from '../application/navigation-guard';
import { deleteCurrentDocument } from '../application/document-management';
import { Outline } from './Outline';
import { HistoryToolbar } from './HistoryToolbar';
import type { FolderStorage } from '../application/ports/folder-storage';
import { Icon } from './Icon';
import { AiSettings } from './AiSettings';
import { AiChatPanel } from './AiChatPanel';
import { loadAiProviderId } from '../platform/ai-preferences';

export function App({ session, createEditor, storage }: { session: DocumentSession; createEditor: (host: HTMLElement) => EditorPort; storage?: FolderStorage }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  useEffect(() => registerOffline(() => {}).dispose, []);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [propertiesWidth, setPropertiesWidth] = useState(380);
  const [chatWidth, setChatWidth] = useState(254);
  const [sidePanel, setSidePanel] = useState<'chat' | 'properties' | null>(null);
  const [aiProvider, setAiProvider] = useState(loadAiProviderId);
  const [aiDrafts, setAiDrafts] = useState<Record<string, string>>({});
  const [menu, setMenu] = useState<CreationTarget | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const [destinationChoice, setDestinationChoice] = useState<'document' | 'folder' | null>(null);
  const [creationFolder, setCreationFolder] = useState('');
  const [fileAction, setFileAction] = useState<{ action: 'rename' | 'delete' | 'addTags'; file: DocumentSummary } | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileError, setFileError] = useState('');
  const [fileBusy, setFileBusy] = useState(false);
  const [folderTarget, setFolderTarget] = useState('');
  const [creating, setCreating] = useState(false);
  const [folders, setFolders] = useState<string[]>(['']);
  const [selectedFolder, setSelectedFolder] = useState('');
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState('');
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [folderAction, setFolderAction] = useState<'create' | 'rename' | 'delete' | null>(null);
  const [folderName, setFolderName] = useState('');
  const [folderError, setFolderError] = useState('');
  const [folderBusy, setFolderBusy] = useState(false);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const selectedDocument = documents.find(row => row.id === selectedDocumentId);
  const [editor, setEditor] = useState<EditorPort | null>(null);
  const [error, setError] = useState('');
  const title = state.draftTitle ?? state.document?.title ?? '';
  const setTitle = (value: string) => session.setTitleDraft(value);
  const [pending, setPending] = useState<(() => void | Promise<void>) | null>(null);
  const navigationRequest = useRef(0);
  const [deleting, setDeleting] = useState(false);
  const [folder, setFolder] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState(!storage);
  const [storageBusy, setStorageBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [aiSettings, setAiSettings] = useState(false);
  const previousDocumentId = useRef<string | null>(null);
  const editable = !!state.document && editingId === state.document.id;
  useUnsavedWarning(requiresNavigationGuard(state));
  const connect = useCallback((value: EditorPort | null) => setEditor(value), []);
  const refresh = useCallback(async () => {
    const [rows, paths] = await Promise.all([session.repository.list(), storage?.folders?.() ?? Promise.resolve([''])]);
    setDocuments(rows); setFolders(paths); setSelectedFolder(previous => paths.includes(previous) ? previous : '');
  }, [session, storage]);
  const resume = useCallback(async () => {
    const initial = session.state;
    const available = await session.repository.list();
    setDocuments(available);
    if (initial.document || session.state !== initial) return;
    setFolders(await storage?.folders?.() ?? ['']);
    const requestedId = new URLSearchParams(window.location.hash.slice(1)).get('article');
    const target = requestedId ? available.find(document => document.id === requestedId) : undefined;
    if (requestedId && !target) setNotice('リンク先の記事が保存先に見つかりません。記事を保存したフォルダーを選択してください。');
    if (target) { setEditingId(null); await session.load(target.id, initial); }
  }, [session, storage]);
  const report = useCallback((error: unknown) => setError(error instanceof Error ? error.message : '操作を完了できません'), []);
  const save = useCallback(async () => { try { await session.save(); await refresh(); setError(''); } catch (error) { report(error); } }, [session, refresh, report]);
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
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); if (state.document) void save(); } };
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('keydown', key); };
  }, [state.dirty, state.saveState, state.document, save]);
  function navigate(action: () => void | Promise<void>) {
    navigationRequest.current++;
    if (requiresNavigationGuard(session.state)) setPending(() => action);
    else {
      const initial = session.state;
      void Promise.resolve().then(() => {
        if (!session.isCurrent(initial)) throw new Error('文書が変更されたため移動を中止しました');
        return action();
      }).catch(report);
    }
  }
  useEffect(() => {
    if (state.document) window.history.replaceState(null, '', `#article=${state.document.id}`);
    else if (previousDocumentId.current) window.history.replaceState(null, '', window.location.pathname + window.location.search);
    previousDocumentId.current = state.document?.id ?? null;
  }, [state.document?.id]);
  useEffect(() => {
    const openArticle = (id: string) => {
      if (id === session.state.document?.id) return;
      navigate(async () => { if (await session.load(id)) setEditingId(null); });
    };
    const hash = () => {
      const id = new URLSearchParams(window.location.hash.slice(1)).get('article');
      if (session.state.document) window.history.replaceState(null, '', `#article=${session.state.document.id}`);
      if (id) openArticle(id);
    };
    const click = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest('a[href]');
      if (!anchor || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
      const url = new URL(anchor.getAttribute('href')!, window.location.href);
      const id = new URLSearchParams(url.hash.slice(1)).get('article');
      if (id && url.origin === window.location.origin && url.pathname === window.location.pathname) { event.preventDefault(); openArticle(id); }
    };
    window.addEventListener('hashchange', hash); window.addEventListener('click', click);
    return () => { window.removeEventListener('hashchange', hash); window.removeEventListener('click', click); };
  });
  async function moveDocument(id: string, path: string, revision: number) {
    if (storageBusy || !storageReady || !session.repository.move) return;
    setStorageBusy(true); setMenu(null);
    try {
      await session.repository.move(id, path, revision);
      await refresh(); setSelectedFolder(path); setError('');
    } catch (error) { report(error); }
    finally { setStorageBusy(false); }
  }
  async function synchronizeFolders() {
    if (storageBusy || !storageReady) return;
    setMenu(null); setStorageBusy(true);
    try {
      if (storage) {
        if (storage.name) await storage.reconnect();
        else await storage.choose();
        setFolder(storage.name);
      }
      await refresh();
      setError(''); setNotice('');
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) report(error);
    } finally { setStorageBusy(false); }
  }
  function beginCreation(kind: 'document' | 'folder', path: string | null) {
    setMenu(null);
    if (storageBusy || !storageReady) return;
    if (kind === 'folder' && (!storage?.name || !storage.createFolder)) { report(new Error('フォルダ作成には保存フォルダーを選択してください')); return; }
    if (path === null) { setCreationFolder(selectedFolder); setDestinationChoice(kind); return; }
    if (kind === 'document') navigate(() => { session.close(); setCreationFolder(path); setCreating(true); });
    else { setFolderTarget(path); setFolderAction('create'); setFolderName(''); setFolderError(''); }
  }
  return <div className="app-shell">
    <header className="app-header"><div><span className="brand-mark">D</span><h1><button className="brand-home" title="ドキュメント一覧に戻る" onClick={() => navigate(() => {
        session.close(); setEditingId(null); setCreating(false); setSelectedFolder(''); setTagFilter(''); setMenu(null); setCatalogVersion(version => version + 1);
      })}>DocSymbi</button></h1><span className="tagline">構造から、伝わるドキュメントへ。</span></div>
      <div className="header-actions"><button aria-expanded={sidePanel === 'chat'} aria-controls="ai-side-panel" onClick={() => setSidePanel(sidePanel === 'chat' ? null : 'chat')}>AIチャット</button><button className="settings-trigger" aria-haspopup="dialog" onClick={() => setAiSettings(true)}><Icon name="settings" />設定</button><button className="icon-button" aria-label="使い方" onClick={() => setHelp(true)}><Icon name="help" /></button><button className="primary" disabled={storageBusy || !storageReady} onClick={() => beginCreation('document', selectedFolder)}>新規作成</button></div></header>
    {aiSettings && <AiSettings close={() => { setAiSettings(false); setAiProvider(loadAiProviderId()); }} />}
    {storage && !storage.supported && <p className="storage-warning">フォルダー保存にはデスクトップ版ChromeまたはEdgeを使用してください。</p>}
    {notice && <p className="storage-warning" role="status">{notice}</p>}
    {storage?.warning && <p className="storage-warning" role="note">{storage.warning}</p>}
    {state.document && <nav className="breadcrumbs" aria-label="パンくずリスト">
      <button onClick={() => navigate(() => { session.close(); setSelectedFolder(''); })}>ドキュメント</button>
      {(documents.find(row => row.id === state.document!.id)?.folderPath ?? '').split('/').filter(Boolean).map((part, index, parts) => <span key={index}> / <button onClick={() => navigate(() => { session.close(); setSelectedFolder(parts.slice(0, index + 1).join('/')); })}>{part}</button></span>)}
      <span> / {title}</span>
      <div className="document-actions"><button onClick={() => setSidePanel('properties')}>文書情報</button><span className="mode-label">{editable ? '編集モード' : 'ビューモード'}</span><button onClick={() => setEditingId(editable ? null : state.document!.id)}>{editable ? '編集を終了' : '編集'}</button><SaveStatus editable={editable} state={state} titleChanged={title !== state.document.title} save={() => void save()} />{editable && <button className="danger" onClick={() => setDeleting(true)}>文書を削除</button>}</div>
    </nav>}
    <div style={{ '--folder-width': `${sidebarWidth}px`, '--ai-panel-width': `${sidePanel === 'chat' ? chatWidth : propertiesWidth}px` } as CSSProperties} className={`workspace ai-workspace ${sidePanel ? 'has-ai-panel' : ''} ${state.document ? 'reading-workspace' : 'library-workspace'}`}>
      {state.document ? <aside className="document-sidebar outline-sidebar"><div className="outline-scroll"><Outline key={state.document.id} document={state.document} focus={id => editor?.focusHeading(id)} /></div><SidebarResizeHandle width={sidebarWidth} resize={setSidebarWidth} label="アウトラインの幅" /></aside> :
      <FolderNavigation move={folder && session.repository.move ? (id, path, revision) => void moveDocument(id, path, revision) : undefined} width={sidebarWidth} resize={setSidebarWidth} synchronize={() => void synchronizeFolders()} busy={storageBusy || !storageReady} documents={documents} open={id => navigate(async () => { if (await session.load(id)) { setEditingId(null); setCreating(false); } })} menu={setMenu} rootName={folder ?? (storage ? '保存先未設定' : 'ブラウザ内保存')} folders={folders} selected={selectedFolder} select={path => { setSelectedFolder(path); setCreating(false); }} />}
      <main className="document-main">
       {(error || state.error) && <div role="alert" className="error-banner">{error || state.error?.message}{storage && state.document && <button disabled={storageBusy || !storageReady} onClick={() => void synchronizeFolders()}>保存先に再接続</button>}{state.document && state.saveState === 'error' && <button onClick={() => void save()}>保存を再試行</button>}</div>}
      {creating && !folder && <p className="storage-warning">保存先フォルダが未設定のため、ドキュメントはブラウザ内に保存します。実ディレクトリに保存するには保存フォルダーを選択してください。</p>}
      {creating ? <NewDocument key={creationFolder} folders={folders} folder={creationFolder} cancel={() => setCreating(false)} create={async values => {
        if (storage?.name) await storage.folders?.();
        session.create(values.title, values.folder);
        session.accept({ ...session.state.document!, metadata: { ...session.state.document!.metadata, type: values.type, tags: values.tags, status: values.status } });
        setEditingId(session.state.document!.id); setCreating(false);
        try { await session.save(); await refresh(); setError(''); } catch (error) { report(error); }
      }} /> : !state.document ? <>
        <DocumentCatalog selectedId={selectedDocumentId} select={setSelectedDocumentId} key={catalogVersion} menu={setMenu} rootName={folder ?? 'ブラウザ内保存'} documents={documents} folders={folders} folder={selectedFolder} selectFolder={setSelectedFolder} tagFilter={tagFilter} setTagFilter={setTagFilter} open={id => navigate(async () => { if (await session.load(id)) { setEditingId(null); setCreating(false); } })} />
      </> : <>
        <div className="editing-layout" style={{ '--properties-width': `${propertiesWidth}px` } as CSSProperties}><div className="document-canvas">
          {editable ? <div className="document-title document-heading"><input aria-label="文書名" title={title} value={title} onChange={event => setTitle(event.target.value)} onBlur={() => { if (!editable) return; try { session.rename(title); } catch (error) { report(error); setTitle(state.document!.title); } }} /></div> : <h2 className="document-title">{title}</h2>}
          {editable && <div className="sticky-editor-tools"><HistoryToolbar editor={editor} />
          <BlockToolbar key={state.document.id} document={state.document} editor={editor} environment={session.environment} /></div>}
          <EditorPane key={state.loadVersion} editable={editable} document={state.document} createEditor={createEditor} connect={connect} />
        </div></div>
      </>}
    </main>
      <AiChatPanel open={sidePanel !== null} tab={sidePanel ?? 'chat'} selectTab={setSidePanel} close={() => setSidePanel(null)} width={sidePanel === 'chat' ? chatWidth : propertiesWidth} resize={sidePanel === 'chat' ? setChatWidth : setPropertiesWidth}
        providerId={aiProvider} settings={() => setAiSettings(true)} documentTitle={state.document ? title : null} documentId={state.document?.id ?? null} documentContext={state.document ? JSON.stringify({ ...state.document, title }, (key, value) => key === 'file' ? undefined : value) : ''}
        draft={aiDrafts[JSON.stringify([state.document?.id ?? null, aiProvider])] ?? ''}
        changeDraft={value => setAiDrafts(previous => ({ ...previous, [JSON.stringify([state.document?.id ?? null, aiProvider])]: value }))}>
        {state.document ? <DocumentProperties document={state.document} folder={documents.find(row => row.id === state.document!.id)?.folderPath ?? selectedFolder} editable={editable} change={values => {
          try { const current = session.state.document!; session.accept({ ...current, metadata: { ...current.metadata, ...values }, updatedAt: session.environment.clock() }); } catch (error) { report(error); }
        }} /> : selectedDocument ? <DocumentProperties document={selectedDocument} folder={selectedDocument.folderPath ?? ''} editable={false} change={() => {}} /> : <p className="ai-empty-properties">一覧で文書を選択すると、文書情報を確認できます。</p>}
      </AiChatPanel>
    </div>
    {folderAction && <DocumentDialog label="フォルダ操作" close={() => { if (!folderBusy) setFolderAction(null); }}><h2>{folderAction === 'create' ? 'フォルダ作成' : folderAction === 'rename' ? 'フォルダ名を変更' : 'フォルダを削除'}</h2>
      <p>対象: {folder ?? 'ルート'}/{folderTarget}</p>{folderAction === 'delete' ? <p>このフォルダと配下のすべてのフォルダ・ファイルを削除します。この操作は元に戻せません。</p> : <label>フォルダ名<input aria-label="フォルダ名" value={folderName} onChange={event => setFolderName(event.target.value)} /></label>}
      {folderError && <p role="alert">{folderError}</p>}<button disabled={folderBusy} onClick={() => setFolderAction(null)}>キャンセル</button><button className={folderAction === 'delete' ? 'danger' : undefined} disabled={folderBusy || (folderAction !== 'delete' && !folderName.trim())} onClick={() => {
        setFolderBusy(true); setFolderError('');
        void (async () => {
          if (folderAction !== 'delete' && pathParts(folderName).length !== 1) throw new Error('フォルダ名は1つの名前で入力してください');
          const newPath = [folderTarget, folderName].filter(Boolean).join('/');
          if (folderAction === 'create') {
            if (!storage?.name || !storage.createFolder) throw new Error('保存フォルダーを選択してください');
            await storage.createFolder(newPath);
          }
          if (folderAction === 'rename') {
            await storage?.renameFolder?.(folderTarget, folderName);
          }
          if (folderAction === 'delete') await storage?.deleteFolder?.(folderTarget, true);
          await refresh(); if (folderAction === 'create') { setSelectedFolder(newPath); setCreating(false); }
          if (folderAction === 'rename') setSelectedFolder([...folderTarget.split('/').slice(0, -1), folderName].join('/'));
          if (folderAction === 'delete') setSelectedFolder(folderTarget.split('/').slice(0, -1).join('/'));
          setFolderAction(null);
        })().catch(error => setFolderError(error instanceof Error ? error.message : '操作できません')).finally(() => setFolderBusy(false));
      }}>実行</button></DocumentDialog>}
    {menu && <CreationMenu target={menu} root={folder ?? 'ブラウザ内保存'} close={closeMenu} choose={kind => beginCreation(kind, menu.folder)} manage={action => {
      const target = menu; setMenu(null);
      if (target.kind === 'file') {
        const file = documents.find(item => item.id === target.id);
        if (!file) { report(new Error('対象ファイルが見つかりません。一覧を再読み込みしてください')); return; }
        setFileAction({ action, file }); setFileName(action === 'addTags' ? '' : file.title); setFileError('');
      } else if (target.folder && action !== 'addTags') {
        setFolderTarget(target.folder); setFolderAction(action); setFolderName(target.folder.split('/').at(-1)!); setFolderError('');
      }
    }} refresh={() => void synchronizeFolders()} busy={storageBusy || !storageReady} />}
    {fileAction && <DocumentDialog label="ファイル操作" close={() => { if (!fileBusy) setFileAction(null); }}><h2>{fileAction.action === 'rename' ? 'ファイル名を変更' : fileAction.action === 'addTags' ? 'タグの追加' : 'ファイルを削除'}</h2><p>対象: {folder ?? 'ブラウザ内保存'}/{fileAction.file.folderPath ? fileAction.file.folderPath + '/' : ''}{fileAction.file.title}</p>
      {fileAction.action === 'rename' ? <label>ファイル名<input aria-label="ファイル名" value={fileName} onChange={event => setFileName(event.target.value)} /></label> : fileAction.action === 'addTags' ? <label className="tag-entry">追加するタグ<input aria-label="追加するタグ" placeholder="カンマ区切り" value={fileName} onChange={event => setFileName(event.target.value)} /></label> : <p>このファイルを削除します。この操作は元に戻せません。</p>}
      {fileError && <p role="alert">{fileError}</p>}<button disabled={fileBusy} onClick={() => setFileAction(null)}>キャンセル</button><button className={fileAction.action === 'delete' ? 'danger' : undefined} disabled={fileBusy || (fileAction.action === 'rename' && !fileName.trim()) || (fileAction.action === 'addTags' && !fileName.split(/[,、]/).some(tag => tag.trim()))} onClick={() => {
        setFileBusy(true); setFileError('');
        void (async () => {
          const { file, action } = fileAction;
          if (action === 'delete') await session.repository.delete(file.id, file.revision);
          else if (action === 'addTags') {
            const current = await session.repository.get(file.id);
            if (current.revision !== file.revision) throw new Error('ファイルが外部で変更されています。一覧を再読み込みしてください');
            const tags = [...new Set([...documentProperties(current.document).tags, ...fileName.split(/[,、]/).map(tag => tag.trim()).filter(Boolean)])];
            await session.repository.save({ ...current.document, updatedAt: session.environment.clock(), metadata: { ...current.document.metadata, tags } }, file.revision);
          } else {
            if (pathParts(fileName).length !== 1) throw new Error('ファイル名は1つの名前で入力してください');
            const current = await session.repository.get(file.id);
            if (current.revision !== file.revision) throw new Error('ファイルが外部で変更されています。一覧を再読み込みしてください');
            const renamed = renameDocument(current.document, fileName, session.environment.clock);
            if (session.repository.rename) await session.repository.rename(renamed, file.revision);
            else await session.repository.save(renamed, file.revision);
          }
          await refresh(); setFileAction(null);
        })().catch(error => setFileError(error instanceof Error ? error.message : '操作できません')).finally(() => setFileBusy(false));
      }}>実行</button></DocumentDialog>}
    {destinationChoice && <DocumentDialog label="作成先フォルダの選択" close={() => setDestinationChoice(null)}><h2>作成先フォルダを選択</h2><p>検索結果から作成先を一意に決定できません。</p><label>作成先フォルダ<select aria-label="作成先フォルダ" value={creationFolder} onChange={event => setCreationFolder(event.target.value)}>{folders.map(path => <option key={path} value={path}>{folder ?? 'ブラウザ内保存'}/{path}</option>)}</select></label><button onClick={() => setDestinationChoice(null)}>キャンセル</button><button onClick={() => { const kind = destinationChoice; setDestinationChoice(null); beginCreation(kind, creationFolder); }}>次へ</button></DocumentDialog>}
    {help && <DocumentDialog label="使い方"><h2>DocSymbiの使い方</h2><p>一覧から文書を開き、左のアウトラインから節に移動できます。検索欄の末尾に / を付けると、保存先ルートからのフォルダパスを検索できます。</p><p>「編集」で本文や文書情報を変更し、「保存」で保存します。「編集を終了」は閲覧への切り替えで、自動保存はしません。</p><p>保存先への再接続と外部変更の反映は「フォルダ」横の同期アイコン、または「⋯」→「同期・再接続」を利用してください。フォルダやファイルの名前変更・削除は右クリックメニューから操作できます。</p><button onClick={() => setHelp(false)}>閉じる</button></DocumentDialog>}
    {pending && <DocumentDialog label="未保存の変更"><h2>変更を保存しますか？</h2><p>移動前に、編集中の文書の扱いを選んでください。</p>
      <button onClick={() => { navigationRequest.current++; setPending(null); }}>キャンセル</button>
      <button disabled={state.saveState === 'saving'} onClick={() => { const action = pending; setPending(null); void Promise.resolve().then(action).catch(report); }}>破棄して移動</button>
      <button className="primary" disabled={state.saveState === 'saving'} onClick={() => { const request = navigationRequest.current; void resolveNavigation('save', session, async () => {
        const saved = session.state;
        await refresh();
        if (request !== navigationRequest.current) return;
        if (!session.isCurrent(saved) || requiresNavigationGuard(session.state)) throw new Error('文書が変更されました。もう一度保存してから移動してください');
        const action = pending; setPending(null); await action();
      }).catch(report); }}>保存して移動</button>
    </DocumentDialog>}
    {deleting && state.document && <DocumentDialog label="文書の削除"><h2>「{state.document.title}」を削除しますか？</h2><p>{state.document.id}</p><p>{storage ? '保存先の記事ファイルと未保存の変更を削除します。この操作は元に戻せません。' : '未保存の変更も削除されます。'}</p><button onClick={() => setDeleting(false)}>キャンセル</button><button className="danger" onClick={() => {

      void deleteCurrentDocument(session).then(() => { setDeleting(false); return refresh(); }).catch(report);
    }}>削除する</button></DocumentDialog>}
  </div>;
}
