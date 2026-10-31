export const defaultShortcuts = { save: 'Mod+s', undo: 'Mod+z', redo: 'Mod+Shift+z', bold: 'Mod+b', heading: 'Mod+Alt+1' };
export const shortcutLabels = { save: '保存', undo: '元に戻す', redo: 'やり直す', bold: '太字', heading: '見出し' };
export type ShortcutAction = keyof typeof defaultShortcuts;
export interface Appearance { dark: boolean; shortcuts: typeof defaultShortcuts }
export function loadAppearance(): Appearance {
  try { const value = JSON.parse(localStorage.getItem('docsymbi:appearance') ?? '{}') as Partial<Appearance>; return { dark: value.dark === true, shortcuts: { ...defaultShortcuts, ...value.shortcuts } }; } catch { return { dark: false, shortcuts: { ...defaultShortcuts } }; }
}
export function keyBinding(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>) {
  if (['Control', 'Meta', 'Shift', 'Alt'].includes(event.key)) return '';
  return [event.ctrlKey || event.metaKey ? 'Mod' : '', event.altKey ? 'Alt' : '', event.shiftKey ? 'Shift' : '', event.key.toLowerCase()].filter(Boolean).join('+');
}
export function applyAppearance() { document.documentElement.dataset.theme = loadAppearance().dark ? 'dark' : 'light'; }
export function saveAppearance(value: Appearance) { localStorage.setItem('docsymbi:appearance', JSON.stringify(value)); applyAppearance(); window.dispatchEvent(new Event('docsymbi-appearance')); }
