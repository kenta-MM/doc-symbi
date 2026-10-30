/** Provider metadata is independent of UI and future connection adapters. */
export interface AiProviderDefinition {
  id: string;
  name: string;
  description: string;
}

export const aiProviders: readonly AiProviderDefinition[] = [
  { id: 'codex', name: 'Codex', description: 'ローカルのCodex CLIに接続して文書についてチャットできます。' },
  { id: 'claude', name: 'Claude', description: '今後の接続先として選択できます。接続方式は準備中です。' },
];

export const defaultAiProviderId = 'codex';

export function findAiProvider(id: unknown): AiProviderDefinition | undefined {
  return aiProviders.find(provider => provider.id === id);
}
