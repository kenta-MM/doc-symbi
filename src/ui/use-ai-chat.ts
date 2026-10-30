import { useEffect, useRef, useState } from 'react';
import { readAiConnection, streamAiChat, type AiConnection } from '../platform/ai-chat';

interface Message { role: 'user' | 'assistant'; text: string }
interface Conversation { id: string; messages: Message[]; error: string; busy: boolean }
const empty: Conversation = { id: '', messages: [], error: '', busy: false };
export function useAiChat(key: string) {
  const [connection, setConnection] = useState<AiConnection>({ connected: false, models: [] });
  const [checking, setChecking] = useState(false);
  const [model, setModel] = useState('');
  const [conversations, setConversations] = useState<Record<string, Conversation>>({});
  const controllers = useRef(new Map<string, AbortController>());
  const connectionController = useRef<AbortController | null>(null);
  async function reconnect() {
    connectionController.current?.abort();
    const controller = new AbortController(); connectionController.current = controller; setChecking(true);
    try { const result = await readAiConnection(controller.signal); setConnection(result); }
    catch (error) { if (!controller.signal.aborted) setConnection({ connected: false, models: [], error: error instanceof Error ? error.message : '接続できません。' }); }
    finally { if (!controller.signal.aborted) setChecking(false); }
  }
  useEffect(() => { void reconnect(); const active = controllers.current; return () => { connectionController.current?.abort(); for (const controller of active.values()) controller.abort(); }; }, []);
  function update(target: string, transform: (value: Conversation) => Conversation) { setConversations(previous => ({ ...previous, [target]: transform(previous[target] ?? empty) })); }
  async function send(message: string, context: string) {
    if (!message.trim() || controllers.current.has(key)) return;
    const controller = new AbortController(); controllers.current.set(key, controller);
    const id = conversations[key]?.id || crypto.randomUUID();
    update(key, value => ({ id, busy: true, error: '', messages: [...value.messages, { role: 'user', text: message }, { role: 'assistant', text: '' }] }));
    const parts = new Map<string, string>();
    try {
      await streamAiChat({ conversationId: id, message, context, ...(model ? { model } : {}) }, controller.signal, event => {
        if (event.type === 'delta') {
          parts.set(event.itemId, (parts.get(event.itemId) ?? '') + event.text);
          update(key, value => ({ ...value, messages: [...value.messages.slice(0, -1), { role: 'assistant', text: [...parts.values()].join('\n\n') }] }));
        } else if (event.type === 'error') update(key, value => ({ ...value, error: event.message }));
        else if (event.status !== 'completed') update(key, value => ({ ...value, error: event.error || (event.status === 'interrupted' ? '生成を停止しました。' : '応答の生成に失敗しました。') }));
      });
    } catch (error) { update(key, value => ({ ...value, error: controller.signal.aborted ? '生成を停止しました。' : error instanceof Error ? error.message : '送信できませんでした。' })); }
    finally { controllers.current.delete(key); update(key, value => ({ ...value, busy: false })); }
  }
  return { connection, checking, reconnect, model, setModel, conversation: conversations[key] ?? empty, send, stop: () => controllers.current.get(key)?.abort(), reset: () => { if (!controllers.current.has(key)) update(key, () => ({ ...empty, id: crypto.randomUUID() })); } };
}
