import { useEffect, useRef, useState } from 'react';
import { registerOffline, type OfflineState } from '../offline/register';
export function OfflineStatus({ updateSafely }: { updateSafely: (update: () => void) => void }) {
  const [state, setState] = useState<OfflineState>({ ready: false, updateAvailable: false, message: 'オフライン利用を準備中' });
  const update = useRef<() => void>(() => {});
  useEffect(() => { const registration = registerOffline(setState); update.current = registration.update; return registration.dispose; }, []);
  return <div className="offline-status"><span>{state.message}</span>{state.updateAvailable && <button onClick={() => updateSafely(() => update.current())}>更新版を適用</button>}</div>;
}
