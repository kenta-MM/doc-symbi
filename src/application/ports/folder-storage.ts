export interface FolderStorage {
  readonly name: string | null;
  readonly supported: boolean;
  readonly warning: string | null;
  restore(): Promise<void>;
  choose(): Promise<void>;
  reconnect(): Promise<void>;
  migrate(): Promise<number>;
}
