import { useEffect, useState } from 'react';
import type { Document } from '../domain/schema';
import { deriveOutline } from '../domain/outline';
export function Outline({ document, focus }: { document: Document; focus: (id: string) => void }) {
  const entries = deriveOutline(document);
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const headings = Array.from(window.document.querySelectorAll<HTMLElement>('.tiptap [data-heading-id]'));
        const current = headings.filter(heading => heading.getBoundingClientRect().top <= 140).at(-1) ?? headings[0];
        if (current) setSelected(current.dataset.headingId ?? null);
      });
    };
    window.addEventListener('scroll', update, { passive: true, capture: true });
    window.addEventListener('resize', update);
    update();
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); };
  }, [document]);
  const current = entries.some(entry => entry.headingId === selected) ? selected : entries[0]?.headingId;
  return <details className="outline" open><summary>アウトライン</summary>
    {entries.length === 0 ? <p>見出しはまだありません</p> : <nav aria-label="見出し一覧">{entries.map(entry => <button key={entry.headingId} aria-current={current === entry.headingId ? 'location' : undefined} style={{ paddingLeft: `${16 + (entry.level - 1) * 10}px` }} onClick={() => { setSelected(entry.headingId); focus(entry.headingId); }}>{entry.label}</button>)}</nav>}
  </details>;
}
