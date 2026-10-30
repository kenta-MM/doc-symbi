import { defaultAiProviderId, findAiProvider } from '../application/ai-providers';

const key = 'docsymbi:ai-preferences';

export function loadAiProviderId(): string {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (value && typeof value === 'object' && 'version' in value && value.version === 1 && 'providerId' in value) {
      return findAiProvider(value.providerId)?.id ?? defaultAiProviderId;
    }
  } catch { /* Invalid or unavailable storage falls back to the default. */ }
  return defaultAiProviderId;
}

export function saveAiProviderId(providerId: string): void {
  if (!findAiProvider(providerId)) throw new Error('選択したAIが見つかりません。');
  localStorage.setItem(key, JSON.stringify({ version: 1, providerId }));
}
