// JSON object order is not meaningful, array order is.
export function equivalent(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const a = Object.keys(left).sort();
  const b = Object.keys(right).sort();
  if (a.length !== b.length) return false;
  return a.every((key, index) => key === b[index] && equivalent(
    (left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key],
  ));
}
