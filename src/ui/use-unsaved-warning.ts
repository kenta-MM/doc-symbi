import { useEffect } from 'react';
export function useUnsavedWarning(enabled: boolean): void {
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (enabled) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [enabled]);
}
