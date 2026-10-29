import type { Transaction } from '@tiptap/pm/state';

export function assignIdentity(transaction: Transaction, newId: () => string): void {
  const seen = new Set<string>();
  transaction.doc.descendants((node, position, parent) => {
    if (!['paragraph', 'heading', 'codeBlock', 'bulletList', 'orderedList', 'listItem', 'imageBlock', 'quizBlock', 'table', 'tableCell', 'tableHeader'].includes(node.type.name)) return;
    if (node.type.name === 'paragraph' && ['listItem', 'tableCell', 'tableHeader'].includes(parent?.type.name ?? '')) {
      if (node.attrs.id !== null || Object.keys(node.attrs.metadata as object).length) transaction.setNodeMarkup(position, undefined, { ...node.attrs, id: null, metadata: {} });
      return;
    }
    let id: unknown = node.attrs.id;
    if (typeof id !== 'string' || seen.has(id)) {
      id = newId();
      transaction.setNodeMarkup(position, undefined, { ...node.attrs, id });
    }
    seen.add(id as string);
  });
}
