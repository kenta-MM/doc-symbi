export interface Directory extends FileSystemDirectoryHandle {
  values(): AsyncIterableIterator<FileSystemFileHandle | Directory>;
  queryPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
}

// Copy first, verify both trees, then remove the original. Failed copies leave
// the original untouched, including files not owned by DocSymbi.
export async function directoryFingerprint(directory: Directory): Promise<string> {
  const entries: string[] = [];
  for await (const entry of directory.values()) {
    if (entry.kind === 'directory') entries.push(JSON.stringify([entry.name, await directoryFingerprint(entry as Directory)]));
    else {
      const data = await (await entry.getFile()).arrayBuffer();
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)));
      entries.push(JSON.stringify([entry.name, digest]));
    }
  }
  return JSON.stringify(entries.sort());
}
export async function copyDirectory(source: Directory, target: Directory): Promise<void> {
  for await (const entry of source.values()) {
    if (entry.kind === 'directory') await copyDirectory(entry as Directory, await target.getDirectoryHandle(entry.name, { create: true }) as Directory);
    else {
      const file = await entry.getFile();
      const stream = await (await target.getFileHandle(entry.name, { create: true })).createWritable();
      try { await stream.write(file); await stream.close(); }
      catch (error) { await stream.abort().catch(() => undefined); throw error; }
    }
  }
}
