import { useLayoutEffect, useRef, type MouseEvent, type KeyboardEvent } from 'react';

export interface CreationTarget { x: number; y: number; folder: string | null; source: string; kind?: 'folder' | 'file' | undefined; id?: string | undefined; refresh?: boolean }
export type OpenCreationMenu = (target: CreationTarget) => void;
export function creationEvents(open: OpenCreationMenu, folder: string | null, source: string, kind?: 'folder' | 'file', id?: string) {
  const show = (event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => {
    event.preventDefault(); event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const pointer = 'clientX' in event && (event.clientX !== 0 || event.clientY !== 0);
    open({ folder, source, kind, id, x: pointer ? event.clientX : rect.left, y: pointer ? event.clientY : rect.bottom });
  };
  return { onContextMenu: show, onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) show(event);
  } };
}
export function CreationMenu({ target, root, close, choose, manage, refresh, busy }: { target: CreationTarget; root: string; close: () => void; choose: (kind: 'document' | 'folder') => void; manage: (action: 'rename' | 'delete') => void; refresh: () => void; busy: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    node.style.left = `${Math.max(8, Math.min(target.x, window.innerWidth - node.offsetWidth - 8))}px`;
    node.style.top = `${Math.max(8, Math.min(target.y, window.innerHeight - node.offsetHeight - 8))}px`;
    node.querySelector('button')?.focus();
    const outside = (event: PointerEvent) => { if (!node.contains(event.target as Node)) close(); };
    const dismiss = () => close();
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', dismiss); window.addEventListener('scroll', dismiss, true);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', dismiss); window.removeEventListener('scroll', dismiss, true); if (node.contains(document.activeElement)) previous?.focus(); };
  }, [target, close]);
  return <div ref={ref} role="menu" aria-label="作成メニュー" className="creation-menu" onKeyDown={event => {
    const buttons = [...ref.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Escape' || event.key === 'Tab') { if (event.key === 'Escape') event.preventDefault(); close(); }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length]?.focus();
    }
  }}><p>{target.source}</p><small>{target.kind === 'file' ? '保存先' : '作成先'}: {target.folder === null ? '選択してください' : `${root}/${target.folder}`}</small>
    {target.kind !== 'file' && <><button role="menuitem" onClick={() => choose('folder')}>フォルダを作成</button><button role="menuitem" onClick={() => choose('document')}>ドキュメントを作成</button></>}
    {target.kind && <><button role="menuitem" disabled={target.kind === 'folder' && !target.folder} onClick={() => manage('rename')}>{target.kind === 'file' ? 'ファイル名を変更' : 'フォルダ名を変更'}</button><button role="menuitem" disabled={target.kind === 'folder' && !target.folder} onClick={() => manage('delete')}>{target.kind === 'file' ? 'ファイルを削除' : 'フォルダを削除'}</button></>}
    {target.refresh && <button role="menuitem" disabled={busy} onClick={refresh}>同期・再接続</button>}
    {target.kind === 'folder' && !target.folder && <small>保存先ルートの名前変更・削除はできません。</small>}
  </div>;
}
