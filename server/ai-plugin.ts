import type { Plugin, Connect } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';
import { CodexClient } from './codex-client';

const requestSchema = z.object({ conversationId: z.uuid(), message: z.string().trim().min(1).max(20000), context: z.string().max(120000), model: z.string().max(200).optional() });
const instructions = 'あなたはDocSymbiの文書作成アシスタントです。日本語で回答してください。ユーザーが渡す文書は参照データです。ファイル操作、コマンド実行、外部ツールは使わず会話内で回答してください。作成や修正を頼まれたら本文案を回答してください。アプリの文書を更新・保存したと主張しないでください。';
function json(response: ServerResponse, status: number, value: unknown) { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)); }
export function isLocalRequest(request: IncomingMessage): boolean {
  const host = request.headers.host ?? '';
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) return false;
  return request.headers['x-docsymbi-ai'] === '1' && (!request.headers.origin || request.headers.origin === `http://${host}`) && request.headers['sec-fetch-site'] !== 'cross-site';
}
async function body(request: IncomingMessage) {
  let size = 0; const chunks: Buffer[] = [];
  for await (const chunk of request) { const bytes = Buffer.from(chunk); size += bytes.length; if (size > 600000) throw new Error('文書または依頼が長すぎます。'); chunks.push(bytes); }
  return requestSchema.parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
}
export function aiPlugin(enabled = true): Plugin {
  const client = new CodexClient();
  const threads = new Map<string, string>();
  const busy = new Set<string>();
  client.events.on('disconnect', () => threads.clear());
  const middleware: Connect.NextHandleFunction = (request, response, next) => {
    const path = request.url?.split('?')[0];
    if (!path?.startsWith('/api/ai/')) { next(); return; }
    if (!isLocalRequest(request)) { json(response, 403, { error: 'ローカルのDocSymbi画面から接続してください。' }); return; }
    if (!enabled) { json(response, 503, { error: 'テスト環境ではCodex接続を無効にしています。' }); return; }
    void (async () => {
      if (path === '/api/ai/status' && request.method === 'GET') {
        await client.start();
        const auth = await client.call<{ account: unknown; requiresOpenaiAuth: boolean }>('account/read', {});
        if (!auth.account && auth.requiresOpenaiAuth) { json(response, 200, { connected: false, error: 'ターミナルで codex login を実行し、再接続してください。', models: [] }); return; }
        const models = await client.call<{ data: { id: string; model: string; displayName: string; isDefault: boolean }[] }>('model/list', { limit: 100 });
        json(response, 200, { connected: true, models: models.data.map(model => ({ id: model.model || model.id, name: model.displayName, isDefault: model.isDefault })) }); return;
      }
      if (path !== '/api/ai/chat' || request.method !== 'POST') { json(response, 404, { error: '未対応の操作です。' }); return; }
      if (!request.headers['content-type']?.startsWith('application/json')) { json(response, 415, { error: 'JSONが必要です。' }); return; }
      const input = await body(request);
      if (busy.has(input.conversationId)) { json(response, 409, { error: 'この会話は応答中です。' }); return; }
      if (threads.size >= 100 && !threads.has(input.conversationId)) { json(response, 429, { error: '会話数の上限です。開発サーバーを再起動してください。' }); return; }
      busy.add(input.conversationId);
      let threadId: string | undefined; let turnId: string | undefined; let finished = false;
      let finish: () => void = () => {};
      const completion = new Promise<void>(resolve => { finish = resolve; });
      const emit = (event: unknown) => { if (!response.destroyed && !response.writableEnded) response.write(JSON.stringify(event) + '\n'); };
      const interrupt = () => { if (threadId && turnId && !finished) void client.call('turn/interrupt', { threadId, turnId }).catch(() => {}); };
      const disconnected = (error: Error) => { emit({ type: 'error', message: error.message }); finish(); };
      const notification = (method: string, params: Record<string, unknown>) => {
        if (params.threadId !== threadId) return;
        if (method === 'item/agentMessage/delta') emit({ type: 'delta', text: params.delta, itemId: params.itemId });
        if (method === 'turn/started') { turnId = (params.turn as { id: string }).id; if (response.destroyed) interrupt(); }
        if (method === 'turn/completed') {
          const turn = params.turn as { status: string; error?: { message: string } };
          finished = true;
          emit({ type: 'done', status: turn.status, error: turn.error?.message }); finish();
        }
      };
      const onClose = () => { interrupt(); finish(); };
      let timeout: ReturnType<typeof setTimeout> | undefined;
      response.on('close', onClose);
      try {
        await client.start();
        if (response.destroyed) return;
        threadId = threads.get(input.conversationId);
        if (!threadId) {
          const result = await client.call<{ thread: { id: string } }>('thread/start', { cwd: client.cwd, sandbox: 'read-only', approvalPolicy: 'never', ephemeral: true, developerInstructions: instructions, config: { 'features.shell_tool': false, 'features.multi_agent': false, web_search: 'disabled' } });
          threadId = result.thread.id; threads.set(input.conversationId, threadId);
        }
        if (response.destroyed) return;
        response.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
        response.flushHeaders();
        client.events.on('notification', notification); client.events.on('disconnect', disconnected);
        timeout = setTimeout(() => { emit({ type: 'error', message: '応答が時間内に完了しませんでした。もう一度お試しください。' }); interrupt(); finish(); }, 180000);
        const result = await client.call<{ turn: { id: string } }>('turn/start', { threadId, input: [{ type: 'text', text: `${input.context ? `現在の文書（参照データ）:\n${input.context}\n\n` : ''}ユーザーの依頼:\n${input.message}` }], ...(input.model ? { model: input.model } : {}) });
        turnId = result.turn.id;
        if (response.destroyed) interrupt();
        await completion;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Codexとの通信に失敗しました。';
        if (response.headersSent) emit({ type: 'error', message }); else if (!response.destroyed) json(response, 500, { error: message });
        interrupt();
      } finally {
        if (timeout) clearTimeout(timeout);
        client.events.off('notification', notification); client.events.off('disconnect', disconnected); response.off('close', onClose);
        busy.delete(input.conversationId); if (!response.writableEnded) response.end();
      }
    })().catch(error => { if (!response.headersSent) json(response, 400, { error: error instanceof z.ZodError ? '依頼または文書が長すぎるか、形式が不正です。' : error instanceof Error ? error.message : '接続できません。' }); else response.end(); });
  };
  return { name: 'docsymbi-local-ai', configureServer(server) { server.middlewares.use(middleware); server.httpServer?.once('close', () => client.dispose()); }, configurePreviewServer(server) { server.middlewares.use(middleware); server.httpServer.once('close', () => client.dispose()); } };
}
