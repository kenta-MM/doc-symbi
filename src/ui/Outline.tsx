import type { Document } from '../domain/schema';
import { deriveOutline } from '../domain/outline';
export function Outline({ document, focus }: { document: Document; focus: (id: string) => void }) {
  const entries = deriveOutline(document);
  return <details className="outline" open><summary>アウトライン</summary>
    {entries.length === 0 ? <p>見出しはまだありません</p> : <nav aria-label="見出し一覧">{entries.map(entry => <button key={entry.headingId} style={{ paddingLeft: `${10 + (entry.level - 1) * 10}px` }} onClick={() => focus(entry.headingId)}>{entry.label}</button>)}</nav>}
  </details>;
}
