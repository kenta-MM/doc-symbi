import { useState } from 'react';
import { aiProviders, defaultAiProviderId, findAiProvider } from '../application/ai-providers';
import { loadAiProviderId, saveAiProviderId } from '../platform/ai-preferences';
import { DocumentDialog } from './DocumentDialogs';
import './ai-settings.css';

export function AiSettings({ close }: { close: () => void }) {
  const [providerId, setProviderId] = useState(loadAiProviderId);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const provider = findAiProvider(providerId) ?? findAiProvider(defaultAiProviderId)!;
  return <DocumentDialog label="AI設定" close={close}>
    <div className="ai-settings">
      <h2>AI設定</h2>
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
      <div className="ai-settings-actions"><button onClick={close}>閉じる</button><button className="primary" onClick={() => {
        try { saveAiProviderId(providerId); setMessage(`${provider.name}を保存しました。`); setError(''); }
        catch { setMessage(''); setError('設定を保存できませんでした。ブラウザの保存設定を確認してください。'); }
      }}>設定を保存</button></div>
    </div>
  </DocumentDialog>;
}
