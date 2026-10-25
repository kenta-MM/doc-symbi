import { useEffect, useState } from 'react';
import { persistentStorageStatus, requestPersistentStorage } from '../offline/storage-status';
export function StorageStatus() {
  const [persistent, setPersistent] = useState<boolean | null>(null);
  useEffect(() => { void persistentStorageStatus().then(setPersistent).catch(() => setPersistent(false)); }, []);
  return <div className="storage-status"><span>{persistent === null ? '保存領域を確認中' : persistent ? '保存領域の保持が許可されています' : '保存領域の保持は未許可です。大切な文書は取り出して保管してください。'}</span>
    {persistent === false && <button onClick={() => void requestPersistentStorage().then(setPersistent).catch(() => setPersistent(false))}>保持をリクエスト</button>}
  </div>;
}
