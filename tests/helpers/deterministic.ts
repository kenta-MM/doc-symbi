export const fixedTime = '2026-10-25T00:00:00.000Z';
export function fixedIds() { let count = 0; return () => `00000000-0000-4000-8000-${String(++count).padStart(12, '0')}`; }
export function deepFreeze<T>(value: T): T { if (value && typeof value === 'object') { Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child); } return value; }
