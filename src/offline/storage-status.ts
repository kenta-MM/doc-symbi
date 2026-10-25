export async function requestPersistentStorage(): Promise<boolean> { return navigator.storage?.persist ? navigator.storage.persist() : false; }
export async function persistentStorageStatus(): Promise<boolean> { return navigator.storage?.persisted ? navigator.storage.persisted() : false; }
