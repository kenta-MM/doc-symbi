export interface OfflineState { ready: boolean; updateAvailable: boolean; message: string }
export function registerOffline(notify: (state: OfflineState) => void): { update: () => void; dispose: () => void } {
  let registration: ServiceWorkerRegistration | undefined;
  let disposed = false;
  let reloading = false;
  const state: OfflineState = { ready: false, updateAvailable: false, message: 'オフライン利用を準備中' };
  const publish = () => { if (!disposed) notify({ ...state }); };
  async function check() {
    const controller = navigator.serviceWorker.controller;
    if (!controller) return;
    const channel = new MessageChannel();
    const ready = await new Promise<boolean>(resolve => {
      const timeout = setTimeout(() => { channel.port1.close(); resolve(false); }, 5000);
      channel.port1.onmessage = event => { clearTimeout(timeout); channel.port1.close(); resolve(event.data?.ready === true); };
      controller.postMessage({ type: 'CHECK_READY' }, [channel.port2]);
    });
    state.ready = ready; state.message = ready ? 'オフライン利用の準備完了' : '準備が完了していません。接続中に再度開いてください'; publish();
  }
  const changed = () => { if (reloading) location.reload(); else void check(); };
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.addEventListener('controllerchange', changed);
    void navigator.serviceWorker.register('/service-worker.js', { updateViaCache: 'none' }).then(value => {
      registration = value;
      const updateState = () => { state.updateAvailable = Boolean(value.waiting); publish(); };
      updateState();
      value.addEventListener('updatefound', () => { value.installing?.addEventListener('statechange', updateState); });
      return navigator.serviceWorker.ready;
    }).then(() => check()).catch(() => { state.message = 'オフライン準備を確認できません。編集と保存は利用できます'; publish(); });
  } else { state.message = '開発表示ではオフライン準備を行いません'; publish(); }
  return {
    update: () => { if (registration?.waiting) { reloading = true; registration.waiting.postMessage({ type: 'SKIP_WAITING' }); } },
    dispose: () => { disposed = true; if ('serviceWorker' in navigator) navigator.serviceWorker.removeEventListener('controllerchange', changed); },
  };
}
