import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { EventEmitter } from 'node:events';
import { existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type RpcMessage = { id?: number; method?: string; params?: Record<string, unknown>; result?: unknown; error?: { message: string } };
export class CodexClient {
  private process: ChildProcessWithoutNullStreams | undefined;
  private ready: Promise<void> | undefined;
  private sequence = 0;
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  readonly events = new EventEmitter();
  readonly cwd = join(tmpdir(), 'docsymbi-ai');
  constructor() { this.events.setMaxListeners(100); }
  async start() {
    if (this.ready) return this.ready;
    this.ready = this.initialize().catch(error => { this.dispose(); throw error; });
    return this.ready;
  }
  private async initialize() {
    mkdirSync(this.cwd, { recursive: true });
    const desktopCli = join(process.env.LOCALAPPDATA ?? '', 'Programs', 'OpenAI', 'Codex', 'bin', 'codex.exe');
    const executable = process.env.DOCSYMBI_CODEX_PATH || (process.platform === 'win32' && existsSync(desktopCli) ? desktopCli : 'codex');
    const child = spawn(executable, ['app-server', '--listen', 'stdio://'], { cwd: this.cwd, windowsHide: true, stdio: 'pipe' });
    this.process = child;
    // Drain diagnostic output without exposing local credentials or configuration to the browser.
    child.stderr.on('data', () => {});
    child.stdin.on('error', () => {});
    const fail = (error: Error) => {
      if (this.process !== child) return;
      for (const request of this.pending.values()) request.reject(error);
      this.pending.clear(); this.ready = undefined; this.process = undefined;
      this.events.emit('disconnect', error);
    };
    child.once('error', () => fail(new Error('Codex CLIを起動できません。インストールまたはDOCSYMBI_CODEX_PATHを確認してください。')));
    child.once('exit', () => fail(new Error('Codex CLIとの接続が終了しました。再接続して新しい会話を開始してください。')));
    createInterface({ input: child.stdout }).on('line', line => {
      let message: RpcMessage;
      try { message = JSON.parse(line) as RpcMessage; } catch { return; }
      if (message.id !== undefined && message.method) {
        // The chat UI does not authorize tool execution or interactive tool requests.
        child.stdin.write(JSON.stringify({ id: message.id, error: { code: -32601, message: 'DocSymbi chat does not support this request.' } }) + '\n');
      } else if (message.id !== undefined) {
        const request = this.pending.get(message.id); this.pending.delete(message.id);
        if (message.error) request?.reject(new Error(message.error.message)); else request?.resolve(message.result);
      } else if (message.method) this.events.emit('notification', message.method, message.params ?? {});
    });
    await this.call('initialize', { clientInfo: { name: 'docsymbi', title: 'DocSymbi', version: '0.1.0' } });
    child.stdin.write(JSON.stringify({ method: 'initialized', params: {} }) + '\n');
  }
  call<T = unknown>(method: string, params: unknown): Promise<T> {
    const child = this.process;
    if (!child) return Promise.reject(new Error('Codex CLIに接続されていません。'));
    return new Promise<T>((resolve, reject) => {
      const id = ++this.sequence;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Codexの応答がタイムアウトしました (${method})。`)); }, 30000);
      this.pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value as T); }, reject: error => { clearTimeout(timer); reject(error); } });
      child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
    });
  }
  dispose() {
    const child = this.process;
    this.process = undefined; this.ready = undefined;
    for (const request of this.pending.values()) request.reject(new Error('Codex接続を終了しました。'));
    this.pending.clear(); child?.kill();
  }
}
