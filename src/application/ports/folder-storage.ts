export interface FolderStorage {
  readonly name: string | null;
  readonly supported: boolean;
  readonly warning: string | null;
  restore(): Promise<void>;
  choose(): Promise<void>;
  reconnect(): Promise<void>;
  migrate(): Promise<number>;
  folders?(): Promise<string[]>;
  createFolder?(path: string): Promise<void>;
  renameFolder?(path: string, name: string): Promise<void>;
  deleteFolder?(path: string, recursive?: boolean): Promise<void>;
}
