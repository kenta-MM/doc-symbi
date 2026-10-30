import { afterEach, expect, it, vi } from 'vitest';
import { streamAiChat } from '../../src/platform/ai-chat';
import { isLocalRequest } from '../../server/ai-plugin';
import type { IncomingMessage } from 'node:http';

afterEach(() => vi.unstubAllGlobals());

it('accepts only same-origin local requests with the application header', () => {
  const request = (headers: IncomingMessage['headers']) => ({ headers } as IncomingMessage);
  expect(isLocalRequest(request({ host: 'localhost:4173', origin: 'http://localhost:4173', 'x-docsymbi-ai': '1' }))).toBe(true);
  for (const headers of [
    { host: 'localhost:4173' },
    { host: 'example.com', 'x-docsymbi-ai': '1' },
    { host: 'localhost:4173', origin: 'https://example.com', 'x-docsymbi-ai': '1' },
    { host: 'localhost:4173', 'sec-fetch-site': 'cross-site', 'x-docsymbi-ai': '1' },
  ]) expect(isLocalRequest(request(headers))).toBe(false);
});

it('decodes streamed Japanese across byte boundaries and reports completion', async () => {
  const data = new TextEncoder().encode(JSON.stringify({ type: 'delta', text: '文書案', itemId: '1' }) + '\n' + JSON.stringify({ type: 'done', status: 'completed' }) + '\n');
  const body = new ReadableStream({ start(controller) { for (const byte of data) controller.enqueue(new Uint8Array([byte])); controller.close(); } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { headers: { 'Content-Type': 'application/x-ndjson' } })));
  const receive = vi.fn();
  await streamAiChat({ conversationId: 'test', message: '依頼', context: '' }, new AbortController().signal, receive);
  expect(receive).toHaveBeenCalledWith({ type: 'delta', text: '文書案', itemId: '1' });
  expect(receive).toHaveBeenCalledWith({ type: 'done', status: 'completed' });
});

it('does not treat a truncated response as success', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"type":"delta","text":"途中","itemId":"1"}\n', { headers: { 'Content-Type': 'application/x-ndjson' } })));
  await expect(streamAiChat({ conversationId: 'test', message: '依頼', context: '' }, new AbortController().signal, vi.fn())).rejects.toThrow('応答の途中');
});
