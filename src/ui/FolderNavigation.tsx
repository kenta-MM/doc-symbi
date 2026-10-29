import type { DocumentSummary } from '../application/ports/document-repository';
import { creationEvents, type OpenCreationMenu } from './CreationMenu';
import { Icon } from './Icon';
import { useState, type ReactNode } from 'react';
export function FolderNavigation({ folders, documents, open, selected, select, rootName, menu }: {
  documents: DocumentSummary[]; open: (id: string) => void;
  rootName: string; menu: OpenCreationMenu;
  folders: string[]; selected: string; select: (path: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [previousSelected, setPreviousSelected] = useState(selected);
  if (previousSelected !== selected) {
    setPreviousSelected(selected);
    setCollapsed(previous => new Set([...previous].filter(path => (path !== '' || selected === '') && !selected.startsWith(path + '/'))));
  }
  function toggle(path: string) {
    if (path !== selected) { select(path); return; }
    setCollapsed(previous => { const next = new Set(previous); if (next.has(path)) next.delete(path); else next.add(path); return next; });
  }
  function renderFolder(path: string): ReactNode {
    const depth = path ? path.split('/').length : 0;
    const name = path ? path.split('/').at(-1)! : rootName;
    const childFolders = folders.filter(item => item && item.split('/').slice(0, -1).join('/') === path).sort((a, b) => a.localeCompare(b, 'ja'));
    const files = documents.filter(item => (item.folderPath ?? '') === path).sort((a, b) => a.title.localeCompare(b.title, 'ja'));
    return <div key={path}>
      <div className={`folder-row${selected === path ? ' selected' : ''}`} {...creationEvents(menu, path, path || rootName, 'folder')}>
        <button className="folder-select" style={{ paddingLeft: 8 + depth * 20 }} title={path || rootName} aria-label={`▱ ${name}`} aria-expanded={!collapsed.has(path)} aria-current={selected === path ? 'page' : undefined} onClick={() => toggle(path)}>
          <svg className="folder-chevron" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={collapsed.has(path) ? 'M8 5l5 5-5 5' : 'M5 8l5 5 5-5'} /></svg>
          <Icon name="folder" /><span>{name}</span>
        </button>
      </div>
      {!collapsed.has(path) && <>{childFolders.map(renderFolder)}{files.map(file => <div className="folder-row tree-file-row" key={file.id} {...creationEvents(menu, path, file.title, 'file', file.id)}>
        <button className="folder-select tree-document" style={{ paddingLeft: 38 + (depth + 1) * 20 }} title={file.title} onClick={() => open(file.id)}><Icon name="file" /><span>{file.title}</span></button>
      </div>)}</>}
    </div>;
  }
  return <aside className="document-sidebar library-sidebar">
    <div className="folder-heading"><h2>フォルダ</h2><button aria-label="選択中のフォルダの作成メニュー" onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); menu({ refresh: true, kind: 'folder', folder: selected, source: selected || rootName, x: rect.left, y: rect.bottom }); }}>⋯</button></div>
    <nav aria-label="フォルダ階層" className="folder-tree" tabIndex={0} {...creationEvents(menu, selected, 'フォルダツリーの空白')}>{renderFolder('')}</nav>
  </aside>;
}
