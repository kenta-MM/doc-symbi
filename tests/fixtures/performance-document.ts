import type { Document } from '../../src/domain/schema';
import { fixedIds, fixedTime } from '../helpers/deterministic';
export function performanceDocument(): Document {
  const id = fixedIds();
  return { format: 'docsymbi', schemaVersion: 1, id: id(), title: '性能検証 1000ブロック', createdAt: fixedTime, updatedAt: fixedTime, metadata: {},
    blocks: Array.from({ length: 1000 }, (_, index) => {
      const identity = { id: id(), metadata: {} };
      const text = `${index} 日本語の文書`.padEnd(100, '文');
      if (index % 10 === 0) return { ...identity, kind: 'heading' as const, level: 1 + index % 6, text };
      if (index % 10 === 1) return { ...identity, kind: 'code' as const, text };
      if (index % 10 === 2) return { ...identity, kind: 'list' as const, style: 'bullet' as const, items: [{ id: id(), metadata: {}, text, children: [{ kind: 'list' as const, id: id(), metadata: {}, style: 'ordered' as const, items: [{ id: id(), metadata: {}, text: '', children: [] }] }] }] };
      return { ...identity, kind: 'paragraph' as const, text };
    }),
  };
}
