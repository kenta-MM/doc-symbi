import { useEffect, useRef, useState } from 'react';
import { readAiConnection, streamAiChat, type AiConnection } from '../platform/ai-chat';
import type { AiDocumentAction } from '../application/ai-document-actions';

interface Message { role: 'user' | 'assistant'; text: string; action?: AiDocumentAction; baseVersion?: string; applied?: boolean }
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
  async function send(message: string, context: string, baseVersion: string) {
    if (!message.trim() || controllers.current.has(key)) return;
    const controller = new AbortController(); controllers.current.set(key, controller);
    const id = conversations[key]?.id || crypto.randomUUID();
    update(key, value => ({ id, busy: true, error: '', messages: [...value.messages, { role: 'user', text: message }, { role: 'assistant', text: '' }] }));
    const parts = new Map<string, string>();
    let proposal: AiDocumentAction | null = null;
    let completed = false;
    let failed = false;
    try {
      await streamAiChat({ conversationId: id, message, context, ...(model ? { model } : {}) }, controller.signal, event => {
        if (event.type === 'delta') {
          parts.set(event.itemId, (parts.get(event.itemId) ?? '') + event.text);
          update(key, value => ({ ...value, messages: [...value.messages.slice(0, -1), { role: 'assistant', text: [...parts.values()].join('\n\n') }] }));
        } else if (event.type === 'reply') {
          proposal = event.action;
          update(key, value => ({ ...value, messages: [...value.messages.slice(0, -1), { role: 'assistant', text: event.message }] }));
        } else if (event.type === 'error') { failed = true; proposal = null; update(key, value => ({ ...value, error: event.message })); }
        else if (event.status !== 'completed') { failed = true; update(key, value => ({ ...value, error: event.error || (event.status === 'interrupted' ? '生成を停止しました。' : '応答の生成に失敗しました。') })); }
        else completed = true;
      });
      if (completed && !failed && proposal && !controller.signal.aborted) {
        const action: AiDocumentAction = proposal;
        update(key, value => ({ ...value, messages: value.messages.map((item, index) => index === value.messages.length - 1 ? { ...item, action, baseVersion } : item) }));
      }
    } catch (error) { update(key, value => ({ ...value, error: controller.signal.aborted ? '生成を停止しました。' : error instanceof Error ? error.message : '送信できませんでした。' })); }
    finally { controllers.current.delete(key); update(key, value => ({ ...value, busy: false })); }
  }
  return { connection, checking, reconnect, model, setModel, conversation: conversations[key] ?? empty, send,
    markApplied: (index: number) => update(key, value => ({ ...value, messages: value.messages.map((message, i) => i === index ? { ...message, applied: true } : message) })),
    stop: () => controllers.current.get(key)?.abort(), reset: () => { if (!controllers.current.has(key)) update(key, () => ({ ...empty, id: crypto.randomUUID() })); } };
}
