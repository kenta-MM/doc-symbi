const key = 'docsymbi:automatic-input';
export function automaticInputEnabled(): boolean {
  try { return localStorage.getItem(key) !== 'false'; } catch { return true; }
}
export function saveAutomaticInput(enabled: boolean): void {
  try { localStorage.setItem(key, String(enabled)); } catch { /* Keep the current session usable. */ }
}
