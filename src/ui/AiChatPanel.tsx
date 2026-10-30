import { useEffect, useRef, type ReactNode } from 'react';
import { SidebarResizeHandle } from './SidebarResizeHandle';
import './ai-chat.css';
import { useAiChat } from './use-ai-chat';

export function AiChatPanel({ open, tab, selectTab, close, width, resize, providerId, settings, documentTitle, documentId, documentContext, draft, changeDraft, children }: {
  open: boolean; tab: 'chat' | 'properties'; selectTab: (tab: 'chat' | 'properties') => void; close: () => void;
  width: number; resize: (width: number) => void; providerId: string;
  settings: () => void; documentTitle: string | null; documentId: string | null; documentContext: string; draft: string; changeDraft: (text: string) => void; children: ReactNode;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  const chat = useAiChat(JSON.stringify([documentId, providerId]));
  const scroll = useRef<HTMLDivElement>(null);
  const supported = providerId === 'codex';
  const ready = supported && chat.connection.connected;
  const { messages, busy, error: chatError } = chat.conversation;
  useEffect(() => { if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight; }, [messages, busy]);
  function send() { if (!ready || busy || !draft.trim()) return; const message = draft; changeDraft(''); void chat.send(message, documentContext); }
  return <aside id="ai-side-panel" className="ai-side-panel properties-pane" aria-label="AI・文書パネル" hidden={!open}>
    <SidebarResizeHandle width={width} resize={resize} label={tab === 'chat' ? 'AIチャットの幅' : 'ドキュメント情報の幅'} edge="left" />
    <div className="ai-panel-tabs" role="tablist" aria-label="サイドパネル">
      {(['chat', 'properties'] as const).map(value => <button key={value} id={`side-tab-${value}`} role="tab" aria-selected={tab === value} aria-controls={`side-content-${value}`} tabIndex={tab === value ? 0 : -1} onClick={() => selectTab(value)} onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 'chat' : event.key === 'End' ? 'properties' : tab === 'chat' ? 'properties' : 'chat';
        selectTab(next); document.getElementById(`side-tab-${next}`)?.focus();
      }}>{value === 'chat' ? 'AIチャット' : '文書情報'}</button>)}
      <button className="ai-panel-close" aria-label="サイドパネルを閉じる" onClick={close}>×</button>
    </div>
    <div id="side-content-chat" role="tabpanel" aria-labelledby="side-tab-chat" className="ai-chat-content" hidden={tab !== 'chat'}>
      <div className="ai-model-controls">{ready && <select aria-label="AIモデル" value={chat.model} onChange={event => chat.setModel(event.target.value)} disabled={busy}><option value="">Codexの既定モデル</option>{chat.connection.models.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}</select>}<button onClick={chat.reset} disabled={busy || !messages.length}>新しい会話</button></div>
      <div className="ai-chat-scroll" ref={scroll}>
        {messages.length === 0 && <>
        <h2>文書づくりを、AIと一緒に</h2>
        <p>{documentTitle ? '文章の整理や加筆など、この文書について依頼できます。' : '作りたい文書を、いつもの言葉で伝えてください。'}</p>
        </>}
        {!ready && <div className="ai-connection-note"><strong>{supported ? 'Codexに接続' : 'Claude連携は準備中です'}</strong><p>{supported ? chat.connection.error ?? 'ローカルのCodex CLIへの接続を確認しています。' : '設定でCodexを選ぶとチャットを利用できます。'}</p>{supported && <button onClick={() => void chat.reconnect()} disabled={chat.checking}>再接続</button>}<button onClick={settings}>AI設定を開く</button></div>}
        <div className="ai-messages" aria-label="会話履歴">{messages.map((message, index) => <div key={index} className={`ai-message ai-message-${message.role}`}><strong>{message.role === 'user' ? 'あなた' : 'Codex'}</strong><div>{message.text || (busy ? '考えています…' : '応答はありません')}</div></div>)}</div>
        {chatError && <p role="alert">{chatError}</p>}
      </div>
      <div className="ai-composer"><textarea ref={input} aria-label="AIへの依頼" placeholder={documentTitle ? 'この文書について依頼する…' : 'どんな文書を作りますか？'} value={draft} onKeyDown={event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }} onChange={event => changeDraft(event.target.value)} />
        <div className="ai-composer-footer"><span>{busy ? '応答を生成中' : 'Ctrl / ⌘ + Enterで送信'}</span>{busy ? <button onClick={chat.stop}>停止</button> : <button className="ai-send" aria-label="AIに送信" disabled={!ready || !draft.trim()} onClick={send}>↑</button>}</div>
      </div><p className="ai-draft-note">送信時に文書のテキストをAIへ共有します。回答はチャット内に表示されます。</p>
    </div>
    <div id="side-content-properties" role="tabpanel" aria-labelledby="side-tab-properties" className="ai-properties-content" hidden={tab !== 'properties'}>{children}</div>
  </aside>;
}
