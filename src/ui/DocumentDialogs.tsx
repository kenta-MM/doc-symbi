import type { ReactNode } from 'react';
export function DocumentDialog({ label, children }: { label: string; children: ReactNode }) {
  return <div className="modal-backdrop"><section role="dialog" aria-modal="true" aria-label={label} className="dialog">{children}</section></div>;
}
