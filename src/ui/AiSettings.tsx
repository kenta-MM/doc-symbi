import { loadAppearance, saveAppearance, defaultShortcuts, shortcutLabels, keyBinding, type ShortcutAction } from '../platform/appearance-preferences';
import { useState } from 'react';
import { aiProviders, defaultAiProviderId, findAiProvider } from '../application/ai-providers';
import { loadAiProviderId, saveAiProviderId } from '../platform/ai-preferences';
import { DocumentDialog } from './DocumentDialogs';
import { Icon } from './Icon';
import './ai-settings.css';

export function AiSettings({ close }: { close: () => void }) {
  const [appearance, setAppearance] = useState(loadAppearance);
  const [category, setCategory] = useState('general');
  const [providerId, setProviderId] = useState(loadAiProviderId);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const provider = findAiProvider(providerId) ?? findAiProvider(defaultAiProviderId)!;
  return <DocumentDialog label="設定" close={close} className="app-settings-dialog">
    <header className="app-settings-header"><h2>設定</h2><button className="icon-button" aria-label="設定を閉じる" onClick={close}><Icon name="close" /></button></header>
    <div className="app-settings-body">
      <nav className="app-settings-nav" aria-label="設定カテゴリ"><button type="button" aria-current={category === "general" ? "page" : undefined} onClick={() => setCategory("general")}>表示・ショートカット</button><button type="button" onClick={() => setCategory("ai")} aria-current={category === "ai" ? "page" : undefined} aria-controls="ai-settings-content"><Icon name="ai" />AI</button></nav>
    {category === 'general' && <section className="ai-settings"><h2>表示</h2><label><input type="checkbox" checked={appearance.dark} onChange={event => setAppearance({ ...appearance, dark: event.target.checked })} />ダークモード</label><h2>ショートカットキーの割り当て</h2><p>入力欄を選び、Ctrl（Macは⌘）またはAltを含むキーを押してください。</p>{(Object.keys(defaultShortcuts) as ShortcutAction[]).map(action => <label key={action}>{shortcutLabels[action]}<input aria-label={shortcutLabels[action] + 'のショートカット'} readOnly value={appearance.shortcuts[action]} onKeyDown={event => { if (event.key === 'Tab') return; event.preventDefault(); event.stopPropagation(); const binding = keyBinding(event); if (!binding || (!event.ctrlKey && !event.metaKey && !event.altKey)) return; if (Object.entries(appearance.shortcuts).some(([key, value]) => key !== action && value === binding)) { setError('同じキーが別の操作に割り当てられています'); return; } setAppearance({ ...appearance, shortcuts: { ...appearance.shortcuts, [action]: binding } }); setError(''); }} /></label>)}<button onClick={() => setAppearance({ ...appearance, shortcuts: { ...defaultShortcuts } })}>既定のキーに戻す</button><p>設定とロックはこのブラウザに保存されます。フォルダのロックは配下の文書にも適用されます。</p></section>}
    <section hidden={category !== 'ai'} className="ai-settings" id="ai-settings-content" aria-labelledby="ai-settings-heading">
      <h2 id="ai-settings-heading">AI設定</h2>
      <p>ドキュメント作成に使うAIを選択します。</p>
      <label htmlFor="ai-provider">利用するAI</label>
      <select id="ai-provider" value={providerId} onChange={event => { setProviderId(event.target.value); setMessage(''); setError(''); }}>
        {aiProviders.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <p>{provider.description}</p>
      <p>{providerId === 'codex' ? 'Codex CLIでログイン後、AIチャットの「再接続」で接続できます。接続状態の確認とモデルの選択はチャット欄で行えます。' : 'Claudeの接続機能は準備中です。'}</p>
      <p className="ai-settings-note">AIの選択はこのブラウザに保存されます。チャット送信時に対象文書をAIへ共有します。ログイン情報はCodex CLIで管理します。</p>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
    </div>
      {category !== "ai" && error && <p role="alert">{error}</p>}{category !== "ai" && message && <p role="status">{message}</p>}<footer className="ai-settings-actions"><button onClick={close}>キャンセル</button><button className="primary" onClick={() => {
        try { saveAppearance(appearance); saveAiProviderId(providerId); setMessage(`設定を保存しました。`); setError(''); }
        catch { setMessage(''); setError('設定を保存できませんでした。ブラウザの保存設定を確認してください。'); }
      }}>保存</button></footer>
  </DocumentDialog>;
}
