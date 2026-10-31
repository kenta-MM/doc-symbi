export interface LockState { documents: string[]; folders: string[] }
/** Separate from document metadata: AI document actions cannot alter these controls. */
export class AccessPolicy {
  paths = new Map<string, string>();
  constructor(private read: () => LockState, private write: (state: LockState) => void) {}
  ownDocument(id: string) { return this.read().documents.includes(id); }
  ownFolder(path: string) { return this.read().folders.includes(path); }
  folderLocked(path: string) { return this.read().folders.some(folder => folder === '' || path === folder || path.startsWith(folder + '/')); }
  documentLocked(id: string) { return this.ownDocument(id) || this.folderLocked(this.paths.get(id) ?? ''); }
  assertDocument(id: string) { if (this.documentLocked(id)) throw new Error('ロックされた文書は読み取り専用です'); }
  assertFolder(path: string, subtree = false) {
    const state = this.read();
    if (this.folderLocked(path) || (subtree && (state.folders.some(folder => path === '' || folder.startsWith(path + '/')) || state.documents.some(id => { const folder = this.paths.get(id); return folder !== undefined && (path === '' || folder === path || folder.startsWith(path + '/')); })))) throw new Error('ロックされたフォルダまたは文書は変更できません');
  }
  toggle(kind: 'documents' | 'folders', target: string) { const state = this.read(); state[kind] = state[kind].includes(target) ? state[kind].filter(value => value !== target) : [...state[kind], target]; this.write(state); }
}
