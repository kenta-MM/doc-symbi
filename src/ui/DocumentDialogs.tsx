import { useEffect, useRef, type ReactNode } from 'react';
export function DocumentDialog({ label, children, close, className }: { label: string; children: ReactNode; close?: () => void; className?: string }) {
  const section = useRef<HTMLElement>(null), onClose = useRef(close); onClose.current = close;
  useEffect(() => {
    const previous = window.document.activeElement as HTMLElement | null;
    const node = section.current!;
    const focusable = () => [...node.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,textarea,[tabindex="0"]')].filter(element => element.getClientRects().length);
    if (!node.contains(window.document.activeElement)) (focusable()[0] ?? node).focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onClose.current) { event.preventDefault(); onClose.current(); }
      if (event.key === 'Tab') { const items = focusable(); const first = items[0], last = items.at(-1); if (event.shiftKey && window.document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && window.document.activeElement === last) { event.preventDefault(); first?.focus(); } }
    };
    node.addEventListener('keydown', key);
    return () => { node.removeEventListener('keydown', key); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div className="modal-backdrop"><section ref={section} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label} className={`dialog ${className ?? ""}`}>{children}</section></div>;
}
