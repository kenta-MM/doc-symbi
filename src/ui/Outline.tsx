import { useState } from 'react';
import type { Document } from '../domain/schema';
import { deriveOutline } from '../domain/outline';
export function Outline({ document, focus }: { document: Document; focus: (id: string) => void }) {
  const entries = deriveOutline(document);
  const [selected, setSelected] = useState<string | null>(null);
  const current = entries.some(entry => entry.headingId === selected) ? selected : entries[0]?.headingId;
  return <details className="outline" open><summary>アウトライン</summary>
    {entries.length === 0 ? <p>見出しはまだありません</p> : <nav aria-label="見出し一覧">{entries.map(entry => <button key={entry.headingId} aria-current={current === entry.headingId ? 'location' : undefined} style={{ paddingLeft: `${16 + (entry.level - 1) * 10}px` }} onClick={() => { setSelected(entry.headingId); focus(entry.headingId); }}>{entry.label}</button>)}</nav>}
  </details>;
}
