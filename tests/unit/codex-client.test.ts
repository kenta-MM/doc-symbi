import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { spawn } from 'node:child_process';
import { afterEach, expect, it, vi } from 'vitest';
import { CodexClient } from '../../server/codex-client';

vi.mock('node:child_process', () => ({ spawn: vi.fn() }));
const clients: CodexClient[] = [];
afterEach(() => { clients.forEach(client => client.dispose()); clients.length = 0; vi.clearAllMocks(); });
function child() {
  const process = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill: vi.fn(), requests: [] as { id: number; method: string }[] });
  process.stdin.on('data', chunk => {
    const request = JSON.parse(String(chunk));
    process.requests.push(request);
    if (request.method === 'initialize') process.stdout.write(JSON.stringify({ id: request.id, result: {} }) + '\n');
  });
  vi.mocked(spawn).mockReturnValueOnce(process as unknown as ReturnType<typeof spawn>);
  return process;
}

it('does not disconnect a new process when a disposed process exits late', async () => {
  const previous = child(); const next = child(); const client = new CodexClient(); clients.push(client);
  await client.start(); client.dispose(); await client.start();
  previous.emit('exit', 0);
  const response = client.call('account/read', {});
  const id = next.requests.find(request => request.method === 'account/read')!.id;
  next.stdout.write(JSON.stringify({ id, result: { account: null } }) + '\n');
  await expect(response).resolves.toEqual({ account: null });
});

it('rejects pending requests when disposed instead of waiting for a timeout', async () => {
  child(); const client = new CodexClient(); clients.push(client); await client.start();
  const result = client.call('account/read', {});
  const assertion = expect(result).rejects.toThrow('接続を終了');
  client.dispose(); await assertion;
});
