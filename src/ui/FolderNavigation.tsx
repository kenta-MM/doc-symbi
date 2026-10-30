import { SidebarResizeHandle } from './SidebarResizeHandle';
import type { DocumentSummary } from '../application/ports/document-repository';
import { creationEvents, type OpenCreationMenu } from './CreationMenu';
import { Icon } from './Icon';
import { useState, type ReactNode } from 'react';
export function FolderNavigation({ folders, documents, open, selected, select, rootName, menu, synchronize, busy, width, resize, move }: {
  move?: ((id: string, path: string, revision: number) => void) | undefined;
  width: number; resize: (width: number) => void;
  synchronize: () => void; busy: boolean;
  documents: DocumentSummary[]; open: (id: string) => void;
  rootName: string; menu: OpenCreationMenu;
  folders: string[]; selected: string; select: (path: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragged, setDragged] = useState<DocumentSummary | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [previousSelected, setPreviousSelected] = useState(selected);
  if (previousSelected !== selected) {
    setPreviousSelected(selected);
    setCollapsed(previous => new Set([...previous].filter(path => (path !== '' || selected === '') && !selected.startsWith(path + '/'))));
  }
  function toggle(path: string) {
    if (path !== selected) { select(path); return; }
    toggleExpanded(path);
  }
  function toggleExpanded(path: string) {
    setCollapsed(previous => { const next = new Set(previous); if (next.has(path)) next.delete(path); else next.add(path); return next; });
  }
  function renderFolder(path: string): ReactNode {
    const depth = path ? path.split('/').length : 0;
    const name = path ? path.split('/').at(-1)! : rootName;
    const childFolders = folders.filter(item => item && item.split('/').slice(0, -1).join('/') === path).sort((a, b) => a.localeCompare(b, 'ja'));
    const files = documents.filter(item => (item.folderPath ?? '') === path).sort((a, b) => a.title.localeCompare(b.title, 'ja'));
    return <div key={path}>
      <div className={`folder-row${selected === path ? ' selected' : ''}${dropTarget === path ? ' drop-target' : ''}`} {...creationEvents(menu, path, path || rootName, 'folder')}
        onDragOver={event => {
          if (!move || busy || !dragged || (dragged.folderPath ?? '') === path) return;
          event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTarget(path);
        }}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null); }}
        onDrop={event => {
          event.preventDefault(); setDropTarget(null);
          if (!move || busy || !dragged || (dragged.folderPath ?? '') === path) return;
          move(dragged.id, path, dragged.revision); setDragged(null);
          setCollapsed(previous => { const next = new Set(previous); next.delete(path); return next; });
        }}>
        <button className="folder-toggle" style={{ marginLeft: 4 + depth * 20 }} aria-label={`${name}を${collapsed.has(path) ? '展開' : '折りたたむ'}`} aria-expanded={!collapsed.has(path)} onClick={() => toggleExpanded(path)}>
          <svg className="folder-chevron" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={collapsed.has(path) ? 'M8 5l5 5-5 5' : 'M5 8l5 5 5-5'} /></svg>
        </button>
        <button className="folder-select" title={path || rootName} aria-label={`▱ ${name}`} aria-expanded={!collapsed.has(path)} aria-current={selected === path ? 'page' : undefined} onClick={() => toggle(path)}>
          <Icon name="folder" /><span>{name}</span>
        </button>
      </div>
      {!collapsed.has(path) && <>{childFolders.map(renderFolder)}{files.map(file => <div className="folder-row tree-file-row" key={file.id} {...creationEvents(menu, path, file.title, 'file', file.id)}>
        <button className="folder-select tree-document" draggable={!!move && !busy} onDragStart={event => {
          if (!move || busy) { event.preventDefault(); return; }
          event.dataTransfer.setData('application/x-docsymbi-document', file.id); event.dataTransfer.effectAllowed = 'move'; setDragged(file);
        }} onDragEnd={() => { setDragged(null); setDropTarget(null); }} style={{ paddingLeft: 38 + (depth + 1) * 20 }} title={file.title} onClick={() => open(file.id)}><Icon name="file" /><span>{file.title}</span></button>
      </div>)}</>}
    </div>;
  }
  return <aside className="document-sidebar library-sidebar">
    <div className="folder-heading"><h2>フォルダ</h2><button className="folder-sync" aria-label="フォルダを同期・再接続" title="フォルダを同期・再接続" disabled={busy} aria-busy={busy} onClick={synchronize}><Icon name="refresh" /></button><button aria-label="選択中のフォルダの作成メニュー" onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); menu({ refresh: true, kind: 'folder', folder: selected, source: selected || rootName, x: rect.left, y: rect.bottom }); }}>⋯</button></div>
    <nav aria-label="フォルダ階層" className="folder-tree" tabIndex={0} {...creationEvents(menu, selected, 'フォルダツリーの空白')}>{renderFolder('')}</nav>
    <SidebarResizeHandle width={width} resize={resize} />
  </aside>;
}
