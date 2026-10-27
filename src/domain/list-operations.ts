import type { Block, Document, List, ListItem } from './schema';
import type { EditorCommand } from './commands';
import { editedDocument, type DocumentEnvironment } from './document';
import { equivalent } from './equivalence';

type Location = { list: List; index: number; parent: { list: List; item: ListItem } | null };
function locate(lists: List[], id: string, parent: Location['parent'] = null): Location | undefined {
  for (const list of lists) {
    for (let index = 0; index < list.items.length; index++) {
      const item = list.items[index]!;
      if (item.id === id) return { list, index, parent };
      const nested = locate(item.children, id, { list, item });
      if (nested) return nested;
    }
  }
}
function findList(lists: List[], id: string): List | undefined {
  for (const list of lists) {
    if (list.id === id) return list;
    for (const item of list.items) { const found = findList(item.children, id); if (found) return found; }
  }
}
function cleanLists(list: List): boolean {
  for (const item of list.items) item.children = item.children.filter(cleanLists);
  return list.items.length > 0;
}
export function applyListCommand(document: Document, command: EditorCommand, environment: DocumentEnvironment): Document {
  let blocks: Block[] = structuredClone(document.blocks);
  const lists = blocks.filter((block): block is List => block.kind === 'list');
  if (command.type === 'setListStyle') {
    const list = findList(lists, command.listId);
    if (!list) throw new Error('List not found');
    list.style = command.style;
  } else if (command.type === 'insertListItem') {
    const list = findList(lists, command.listId);
    if (!list || !Number.isInteger(command.index) || command.index < 0 || command.index > list.items.length) throw new Error('Invalid list insertion');
    list.items.splice(command.index, 0, structuredClone(command.item));
  } else if (command.type === 'deleteListItem' || command.type === 'indentListItem' || command.type === 'outdentListItem') {
    const location = locate(lists, command.id);
    if (!location) throw new Error('List item not found');
    const { list, index, parent } = location;
    const item = list.items[index]!;
    if (command.type === 'deleteListItem') list.items.splice(index, 1);
    if (command.type === 'indentListItem') {
      const preceding = list.items[index - 1];
      if (!preceding) return document;
      const last = preceding.children.at(-1);
      // Lists with different metadata cannot be merged silently.
      if (last && last.style === list.style && equivalent(last.metadata, list.metadata)) last.items.push(item);
      else preceding.children.push({ kind: 'list', id: environment.id(), metadata: structuredClone(list.metadata), style: list.style, items: [item] });
      list.items.splice(index, 1);
    }
    if (command.type === 'outdentListItem') {
      if (!parent) return document;
      const parentIndex = parent.list.items.indexOf(parent.item);
      parent.list.items.splice(parentIndex + 1, 0, item);
      list.items.splice(index, 1);
    }
  } else throw new Error('Not a list operation');
  blocks = blocks.filter(block => block.kind !== 'list' || cleanLists(block));
  if (!blocks.length) blocks.push({ kind: 'paragraph', id: environment.id(), metadata: {}, text: '' });
  return equivalent(blocks, document.blocks) ? document : editedDocument(document, { blocks }, environment.clock);
}
