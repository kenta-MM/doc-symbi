export interface AiConnection { connected: boolean; error?: string; models: { id: string; name: string; isDefault: boolean }[] }
export type AiEvent = { type: 'delta'; text: string; itemId: string } | { type: 'done'; status: string; error?: string } | { type: 'error'; message: string };
const headers = { 'X-DocSymbi-AI': '1', 'Content-Type': 'application/json' };
export async function readAiConnection(signal?: AbortSignal): Promise<AiConnection> {
  const response = await fetch('/api/ai/status', { headers, ...(signal ? { signal } : {}) });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('ローカル接続には npm run dev または npm run preview で起動してください。');
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? 'Codexに接続できません。');
  return value as AiConnection;
}
export async function streamAiChat(input: { conversationId: string; message: string; context: string; model?: string }, signal: AbortSignal, receive: (event: AiEvent) => void) {
  const response = await fetch('/api/ai/chat', { method: 'POST', headers, body: JSON.stringify(input), signal });
  if (!response.ok) { const value = await response.json(); throw new Error(value.error ?? '送信できませんでした。'); }
  if (!response.body || !response.headers.get('content-type')?.includes('application/x-ndjson')) throw new Error('ローカルのAI接続が利用できません。');
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ''; let completed = false;
  try {
    while (true) {
      const chunk = await reader.read(); buffer += decoder.decode(chunk.value, { stream: !chunk.done });
      const lines = buffer.split('\n'); buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line) as AiEvent;
        if (event.type === 'done' || event.type === 'error') completed = true;
        receive(event);
      }
      if (chunk.done) break;
    }
    if (!completed) throw new Error('応答の途中で接続が切れました。');
  } finally { reader.releaseLock(); }
}
